//! Windows implementation.
//!
//! Desktop embedding works by asking Progman to spawn the "WorkerW" layer that
//! sits between the wallpaper bitmap and the desktop icons (undocumented
//! message 0x052C), then re-parenting our webview window into it.
//!
//! Two shell layouts exist:
//!  * Legacy (Win10 / Win11 before 24H2): after 0x052C the icons
//!    (SHELLDLL_DefView) live in a top-level WorkerW, and a *sibling* WorkerW
//!    right behind it is the wallpaper layer. We become a child of that one.
//!  * Win11 24H2+: Progman keeps SHELLDLL_DefView and the WorkerW as its own
//!    children. We become a child of Progman, inserted in the z-order between
//!    DefView (icons, on top) and WorkerW (static wallpaper, below). Progman
//!    uses WS_EX_NOREDIRECTIONBITMAP, so our child must be WS_EX_LAYERED.
//!
//! If none of this works we fall back to a borderless window pinned to the
//! bottom of the z-order (covers icons but still behaves like a wallpaper).

use super::{AttachResult, CpuSample, ForegroundState, PowerState, SysStats};
use crate::wallpaper::Rect;
use std::ptr::{null, null_mut};
use tauri::AppHandle;
use windows_sys::Win32::Foundation::{BOOL, FILETIME, HWND, LPARAM, POINT, RECT};
use windows_sys::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows_sys::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
use windows_sys::Win32::System::Threading::{GetCurrentProcessId, GetSystemTimes};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
use windows_sys::Win32::UI::Shell::{
    SHQueryUserNotificationState, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
};
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
        // The wallpaper WorkerW is the next WorkerW sibling after the icon host.
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
    // Ask Progman to create the WorkerW layer. Different Windows builds react
    // to different parameters, so send both known variants.
    let mut res: usize = 0;
    SendMessageTimeoutW(progman, 0x052C, 0xD, 0x1, SMTO_NORMAL, 1000, &mut res);
    SendMessageTimeoutW(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &mut res);

    // Windows 11 24H2+ layout.
    let defview = find(progman, null_mut(), "SHELLDLL_DefView");
    if !defview.is_null() {
        let workerw = find(progman, null_mut(), "WorkerW");
        if !workerw.is_null() {
            return Some(Host { parent: progman, mode: "progman-24h2", defview, workerw });
        }
    }

    // Legacy layout.
    let mut worker: HWND = null_mut();
    EnumWindows(Some(enum_find_workerw), &mut worker as *mut HWND as LPARAM);
    if !worker.is_null() {
        return Some(Host { parent: worker, mode: "workerw", defview: null_mut(), workerw: worker });
    }

    // Icons still in Progman but no WorkerW: draw as a Progman child behind DefView.
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
                    // Keep the static-wallpaper WorkerW below us.
                    SetWindowPos(host.workerw, hwnd, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                }
                return AttachResult { mode: host.mode, parent: host.parent as isize };
            }
            // SetParent failed: restore a top-level style before falling back.
            SetWindowLongPtrW(hwnd, GWL_STYLE, ((new_style & !WS_CHILD) | WS_POPUP) as isize);
        }
        fallback(hwnd, rect);
        AttachResult { mode: "fallback", parent: 0 }
    }
}

unsafe fn fallback(hwnd: HWND, rect: &Rect) {
    let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
    SetWindowLongPtrW(
        hwnd,
        GWL_EXSTYLE,
        ((ex & !WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) as isize,
    );
    SetWindowPos(
        hwnd,
        HWND_BOTTOM,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
    );
}

/// Re-assert bottom-most z-order (only used in fallback mode).
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

/// True while our window and its desktop parent still exist (explorer.exe
/// restarts destroy the WorkerW/Progman windows).
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

/// Repaint the normal static wallpaper (removes the last live frame on exit).
pub fn refresh_wallpaper() {
    unsafe {
        let mut buf = [0u16; 520];
        SystemParametersInfoW(SPI_GETDESKWALLPAPER, buf.len() as u32, buf.as_mut_ptr() as *mut _, 0);
        SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, buf.as_mut_ptr() as *mut _, SPIF_SENDCHANGE);
    }
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
];

pub fn foreground_state() -> Option<ForegroundState> {
    unsafe {
        let fg = GetForegroundWindow();
        if fg.is_null() || IsWindowVisible(fg) == 0 {
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
        })
    }
}

/// Exclusive-fullscreen D3D games and presentation mode.
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
        }
    }
}

/// Global cursor position in physical pixels + left button state. Wallpaper
/// windows sit behind the icons and never receive mouse input themselves.
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

/// Is the cursor over the desktop (icons / wallpaper) rather than an app window?
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
            let total = ft(&kernel) + ft(&user); // kernel time includes idle
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
        SysStats {
            cpu,
            mem: if total > 0.0 { used / total * 100.0 } else { 0.0 },
            mem_used_gb: used,
            mem_total_gb: total,
        }
    }
}
