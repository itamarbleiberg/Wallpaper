//! Windows implementation.
//!
//! Desktop embedding works by asking Progman to spawn the "WorkerW" layer that
//! sits between the wallpaper bitmap and the desktop icons (undocumented
//! message 0x052C), then re-parenting our webview windows into it.
//!
//! Two shell layouts exist:
//!  * Legacy (Win10 / Win11 before 24H2): after 0x052C the icons
//!    (SHELLDLL_DefView) live in a top-level WorkerW, and a *sibling* WorkerW
//!    right behind it is the wallpaper layer. We become children of that one.
//!  * Win11 24H2+: Progman keeps SHELLDLL_DefView and the WorkerW as its own
//!    children. Our windows become children of Progman, stacked between
//!    DefView (icons, top) and WorkerW (static wallpaper, bottom). Progman
//!    uses WS_EX_NOREDIRECTIONBITMAP, so our children must be WS_EX_LAYERED.
//!
//! Multi-monitor z-order: every wallpaper window is inserted directly below
//! DefView and the WorkerW is then pushed to the *bottom* of Progman's
//! children. (Placing WorkerW "below the window just attached" would put it
//! above every previously attached window and hide them - that was the
//! "only my second monitor works" bug.)

use super::{AttachResult, CpuSample, ForegroundState, PowerState, SysStats};
use crate::wallpaper::Rect;
use std::ptr::{null, null_mut};
use tauri::AppHandle;
use windows_sys::Win32::Foundation::{CloseHandle, BOOL, FILETIME, HWND, LPARAM, POINT, RECT, SYSTEMTIME};
use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows_sys::Win32::System::SystemInformation::{GetLocalTime, GetTickCount, GlobalMemoryStatusEx, MEMORYSTATUSEX};
use windows_sys::Win32::System::Threading::{
    GetCurrentProcessId, GetSystemTimes, OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, GetLastInputInfo, LASTINPUTINFO, VK_LBUTTON};
use windows_sys::Win32::UI::Shell::{SHQueryUserNotificationState, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN};
use windows_sys::Win32::UI::WindowsAndMessaging::*;

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

unsafe fn find(parent: HWND, after: HWND, class: &str) -> HWND {
    let c = wide(class);
    FindWindowExW(parent, after, c.as_ptr(), null())
}

unsafe fn class_name(hwnd: HWND) -> String {
    let mut buf = [0u16; 256];
    let n = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
    if n <= 0 {
        return String::new();
    }
    String::from_utf16_lossy(&buf[..n as usize])
}

struct Host {
    parent: HWND,
    mode: &'static str,
    defview: HWND,
    workerw: HWND,
}

unsafe extern "system" fn enum_find_workerw(top: HWND, lparam: LPARAM) -> BOOL {
    let defview = find(top, null_mut(), "SHELLDLL_DefView");
    if !defview.is_null() {
        let worker = find(null_mut(), top, "WorkerW");
        if !worker.is_null() {
            *(lparam as *mut HWND) = worker;
            return 0;
        }
    }
    1
}

unsafe fn find_host() -> Option<Host> {
    let progman = find(null_mut(), null_mut(), "Progman");
    if progman.is_null() {
        return None;
    }
    let mut res: usize = 0;
    SendMessageTimeoutW(progman, 0x052C, 0xD, 0x1, SMTO_NORMAL, 1000, &mut res);
    SendMessageTimeoutW(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &mut res);

    let defview = find(progman, null_mut(), "SHELLDLL_DefView");
    if !defview.is_null() {
        let workerw = find(progman, null_mut(), "WorkerW");
        if !workerw.is_null() {
            return Some(Host { parent: progman, mode: "progman-24h2", defview, workerw });
        }
    }

    let mut worker: HWND = null_mut();
    EnumWindows(Some(enum_find_workerw), &mut worker as *mut HWND as LPARAM);
    if !worker.is_null() {
        return Some(Host { parent: worker, mode: "workerw", defview: null_mut(), workerw: worker });
    }

    if !defview.is_null() {
        return Some(Host { parent: progman, mode: "progman", defview, workerw: null_mut() });
    }
    None
}

/// Embed `hwnd_i` behind the desktop icons and size it to `rect` (physical
/// screen pixels). Falls back to a bottom-most popup if embedding fails.
pub fn attach(hwnd_i: isize, rect: &Rect) -> AttachResult {
    unsafe {
        let hwnd = hwnd_i as HWND;
        if let Some(host) = find_host() {
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
            let new_style = (style
                & !(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX))
                | WS_CHILD;
            SetWindowLongPtrW(hwnd, GWL_STYLE, new_style as isize);

            let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            let mut new_ex = (ex & !WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
            if host.mode == "progman-24h2" {
                new_ex |= WS_EX_LAYERED;
            }
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex as isize);
            if new_ex & WS_EX_LAYERED != 0 {
                SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
            }

            if !SetParent(hwnd, host.parent).is_null() || GetParent(hwnd) == host.parent {
                let mut pr: RECT = std::mem::zeroed();
                GetWindowRect(host.parent, &mut pr);
                let insert_after = if host.defview.is_null() { HWND_TOP } else { host.defview };
                SetWindowPos(
                    hwnd,
                    insert_after,
                    rect.x - pr.left,
                    rect.y - pr.top,
                    rect.w,
                    rect.h,
                    SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
                );
                if host.mode == "progman-24h2" && !host.workerw.is_null() {
                    // Static wallpaper goes to the very bottom so it never
                    // covers any of our (possibly several) wallpaper windows.
                    SetWindowPos(host.workerw, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                }
                return AttachResult { mode: host.mode, parent: host.parent as isize };
            }
            SetWindowLongPtrW(hwnd, GWL_STYLE, ((new_style & !WS_CHILD) | WS_POPUP) as isize);
        }
        fallback(hwnd, rect);
        AttachResult { mode: "fallback", parent: 0 }
    }
}

/// Re-assert the stacking order of all wallpaper windows after a sync:
/// icons on top, then every wallpaper window, then the static WorkerW.
pub fn restack(hwnds: &[isize]) {
    unsafe {
        let progman = find(null_mut(), null_mut(), "Progman");
        if progman.is_null() {
            return;
        }
        let defview = find(progman, null_mut(), "SHELLDLL_DefView");
        let workerw = find(progman, null_mut(), "WorkerW");
        if defview.is_null() || workerw.is_null() {
            return; // legacy layout: siblings inside one WorkerW never overlap
        }
        let mut after = defview;
        for h in hwnds {
            let h = *h as HWND;
            if GetParent(h) == progman {
                SetWindowPos(h, after, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                after = h;
            }
        }
        SetWindowPos(workerw, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    }
}

unsafe fn fallback(hwnd: HWND, rect: &Rect) {
    let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ((ex & !WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) as isize);
    SetWindowPos(hwnd, HWND_BOTTOM, rect.x, rect.y, rect.w, rect.h, SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
}

pub fn keep_bottom(hwnd: isize) {
    unsafe {
        SetWindowPos(hwnd as HWND, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    }
}

pub fn detach(hwnd: isize) {
    unsafe {
        let h = hwnd as HWND;
        if IsWindow(h) == 0 {
            return;
        }
        ShowWindow(h, SW_HIDE);
        SetParent(h, null_mut());
    }
}

pub fn is_alive(hwnd: isize, parent: isize) -> bool {
    unsafe {
        let h = hwnd as HWND;
        if IsWindow(h) == 0 {
            return false;
        }
        if parent == 0 {
            return true;
        }
        IsWindow(parent as HWND) != 0 && GetParent(h) == parent as HWND
    }
}

fn current_wallpaper() -> Vec<u16> {
    let mut buf = vec![0u16; 520];
    unsafe {
        SystemParametersInfoW(SPI_GETDESKWALLPAPER, buf.len() as u32, buf.as_mut_ptr() as *mut _, 0);
    }
    buf
}

pub fn refresh_wallpaper() {
    let mut buf = current_wallpaper();
    unsafe {
        SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, buf.as_mut_ptr() as *mut _, SPIF_SENDCHANGE);
    }
}

/// Set the regular Windows (static) wallpaper - used to keep the lock
/// screen / startup / Task View wallpaper matching the live one.
pub fn set_static_wallpaper(path: &str) -> bool {
    let mut w = wide(path);
    unsafe { SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, w.as_mut_ptr() as *mut _, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE) != 0 }
}

const SHELL_CLASSES: &[&str] = &[
    "Progman",
    "WorkerW",
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "Windows.UI.Core.CoreWindow",
    "XamlExplorerHostIslandWindow",
    "NotifyIconOverflowWindow",
    "TopLevelWindowForOverflowXamlIsland",
    "ForegroundStaging",
    "MultitaskingViewFrame",
];

unsafe fn process_name(pid: u32) -> String {
    let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
    if h.is_null() {
        return String::new();
    }
    let mut buf = [0u16; 1024];
    let mut len = buf.len() as u32;
    let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut len);
    CloseHandle(h);
    if ok == 0 {
        return String::new();
    }
    let full = String::from_utf16_lossy(&buf[..len as usize]);
    full.rsplit(['\\', '/']).next().unwrap_or("").to_ascii_lowercase()
}

unsafe fn is_cloaked(h: HWND) -> bool {
    let mut cloaked: u32 = 0;
    DwmGetWindowAttribute(h, DWMWA_CLOAKED as _, &mut cloaked as *mut u32 as *mut _, 4) == 0 && cloaked != 0
}

pub fn foreground_state() -> Option<ForegroundState> {
    unsafe {
        let fg = GetForegroundWindow();
        if fg.is_null() || IsWindowVisible(fg) == 0 || is_cloaked(fg) {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(fg, &mut pid);
        if pid == GetCurrentProcessId() {
            return None;
        }
        let cls = class_name(fg);
        if SHELL_CLASSES.iter().any(|c| *c == cls) {
            return None;
        }
        // Click-through overlays (game bars, recording HUDs) are not "apps".
        let ex = GetWindowLongPtrW(fg, GWL_EXSTYLE) as u32;
        if ex & WS_EX_TRANSPARENT != 0 || ex & WS_EX_TOOLWINDOW != 0 && ex & WS_EX_TOPMOST != 0 {
            return None;
        }
        let mut wr: RECT = std::mem::zeroed();
        if GetWindowRect(fg, &mut wr) == 0 {
            return None;
        }
        let hmon = MonitorFromWindow(fg, MONITOR_DEFAULTTONEAREST);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(hmon, &mut mi) == 0 {
            return None;
        }
        let m = mi.rcMonitor;
        let fullscreen = wr.left <= m.left && wr.top <= m.top && wr.right >= m.right && wr.bottom >= m.bottom;
        Some(ForegroundState {
            monitor: Rect { x: m.left, y: m.top, w: m.right - m.left, h: m.bottom - m.top },
            fullscreen,
            maximized: IsZoomed(fg) != 0,
            exe: process_name(pid),
        })
    }
}

unsafe extern "system" fn enum_apps(h: HWND, lparam: LPARAM) -> BOOL {
    let out = &mut *(lparam as *mut Vec<String>);
    if IsWindowVisible(h) == 0 || is_cloaked(h) || GetWindowTextLengthW(h) == 0 {
        return 1;
    }
    let ex = GetWindowLongPtrW(h, GWL_EXSTYLE) as u32;
    if ex & WS_EX_TOOLWINDOW != 0 {
        return 1;
    }
    let mut pid = 0u32;
    GetWindowThreadProcessId(h, &mut pid);
    if pid == GetCurrentProcessId() {
        return 1;
    }
    let name = process_name(pid);
    if !name.is_empty() && name != "explorer.exe" && !out.contains(&name) {
        out.push(name);
    }
    1
}

/// Executable names of apps that currently have visible windows.
pub fn list_window_apps() -> Vec<String> {
    let mut v: Vec<String> = vec![];
    unsafe {
        EnumWindows(Some(enum_apps), &mut v as *mut Vec<String> as LPARAM);
    }
    v.sort();
    v
}

pub fn d3d_fullscreen() -> bool {
    unsafe {
        let mut state = 0;
        if SHQueryUserNotificationState(&mut state) != 0 {
            return false;
        }
        state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_PRESENTATION_MODE
    }
}

pub fn power() -> PowerState {
    unsafe {
        let mut s: SYSTEM_POWER_STATUS = std::mem::zeroed();
        if GetSystemPowerStatus(&mut s) == 0 {
            return PowerState::default();
        }
        PowerState {
            on_battery: s.ACLineStatus == 0,
            percent: if s.BatteryLifePercent == 255 { 100 } else { s.BatteryLifePercent },
            saver: s.SystemStatusFlag == 1,
            has_battery: s.BatteryFlag != 128 && s.BatteryFlag != 255,
        }
    }
}

/// Seconds since the last keyboard/mouse input (system wide).
pub fn idle_seconds() -> u64 {
    unsafe {
        let mut lii = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
        if GetLastInputInfo(&mut lii) == 0 {
            return 0;
        }
        (GetTickCount().wrapping_sub(lii.dwTime) / 1000) as u64
    }
}

/// Minutes since local midnight.
pub fn local_minutes() -> u32 {
    unsafe {
        let mut st: SYSTEMTIME = std::mem::zeroed();
        GetLocalTime(&mut st);
        st.wHour as u32 * 60 + st.wMinute as u32
    }
}

pub fn cursor(_app: &AppHandle) -> Option<(i32, i32, bool)> {
    unsafe {
        let mut p = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut p) == 0 {
            return None;
        }
        let down = (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) != 0;
        Some((p.x, p.y, down))
    }
}

pub fn over_desktop(x: i32, y: i32, own: &[isize]) -> bool {
    unsafe {
        let h = WindowFromPoint(POINT { x, y });
        if h.is_null() {
            return false;
        }
        let root = GetAncestor(h, GA_ROOT);
        if own.iter().any(|o| *o as HWND == root || *o as HWND == h) {
            return true;
        }
        let cls = class_name(root);
        cls == "Progman" || cls == "WorkerW"
    }
}

fn ft(f: &FILETIME) -> u64 {
    ((f.dwHighDateTime as u64) << 32) | f.dwLowDateTime as u64
}

pub fn sys_stats(prev: &mut CpuSample) -> SysStats {
    unsafe {
        let mut idle: FILETIME = std::mem::zeroed();
        let mut kernel: FILETIME = std::mem::zeroed();
        let mut user: FILETIME = std::mem::zeroed();
        let mut cpu = 0.0;
        if GetSystemTimes(&mut idle, &mut kernel, &mut user) != 0 {
            let idle_t = ft(&idle);
            let total = ft(&kernel) + ft(&user);
            let di = idle_t.saturating_sub(prev.idle);
            let dt = total.saturating_sub(prev.total);
            if prev.total != 0 && dt > 0 {
                cpu = (1.0 - di as f64 / dt as f64).clamp(0.0, 1.0) as f32 * 100.0;
            }
            prev.idle = idle_t;
            prev.total = total;
        }
        let mut ms: MEMORYSTATUSEX = std::mem::zeroed();
        ms.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        let (mut used, mut total) = (0.0f32, 0.0f32);
        if GlobalMemoryStatusEx(&mut ms) != 0 {
            total = ms.ullTotalPhys as f32 / 1_073_741_824.0;
            used = (ms.ullTotalPhys - ms.ullAvailPhys) as f32 / 1_073_741_824.0;
        }
        let p = power();
        SysStats {
            cpu,
            mem: if total > 0.0 { used / total * 100.0 } else { 0.0 },
            mem_used_gb: used,
            mem_total_gb: total,
            battery: if p.has_battery { Some(p.percent) } else { None },
            charging: !p.on_battery,
        }
    }
}

/// Human-readable dump of how each wallpaper window is embedded.
pub fn diagnostics(windows: &[(String, isize)]) -> Vec<String> {
    let mut out = vec![];
    unsafe {
        for (label, hwnd) in windows {
            let h = *hwnd as HWND;
            if IsWindow(h) == 0 {
                out.push(format!("{label}: window handle is gone"));
                continue;
            }
            let parent = GetParent(h);
            let mut r: RECT = std::mem::zeroed();
            GetWindowRect(h, &mut r);
            out.push(format!(
                "{label}: parent={} visible={} screen=({},{} {}x{}) layered={}",
                if parent.is_null() { "none".to_string() } else { class_name(parent) },
                IsWindowVisible(h) != 0,
                r.left,
                r.top,
                r.right - r.left,
                r.bottom - r.top,
                (GetWindowLongPtrW(h, GWL_EXSTYLE) as u32 & WS_EX_LAYERED) != 0
            ));
        }
        // Z-order of the host's children (top -> bottom).
        let progman = find(null_mut(), null_mut(), "Progman");
        if !progman.is_null() {
            let mut names = vec![];
            let mut c = GetWindow(progman, GW_CHILD);
            while !c.is_null() && names.len() < 16 {
                let tag = windows.iter().find(|(_, w)| *w as HWND == c).map(|(l, _)| l.clone());
                names.push(tag.unwrap_or_else(|| class_name(c)));
                c = GetWindow(c, GW_HWNDNEXT);
            }
            out.push(format!("Progman children (top->bottom): {}", names.join(" > ")));
        }
    }
    out
}
