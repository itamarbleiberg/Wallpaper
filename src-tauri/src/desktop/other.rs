//! Non-Windows stubs so the project still compiles for UI development on
//! macOS/Linux. Wallpaper windows become plain always-on-bottom windows.

use super::{AttachResult, CpuSample, ForegroundState, PowerState, SysStats};
use crate::wallpaper::Rect;
use tauri::AppHandle;

pub fn attach(_hwnd: isize, _rect: &Rect) -> AttachResult {
    AttachResult { mode: "fallback", parent: 0 }
}
pub fn restack(_hwnds: &[isize]) {}
pub fn keep_bottom(_hwnd: isize) {}
pub fn detach(_hwnd: isize) {}
pub fn is_alive(_hwnd: isize, _parent: isize) -> bool {
    true
}
pub fn refresh_wallpaper() {}
pub fn set_static_wallpaper(_path: &str) -> bool {
    false
}
pub fn foreground_state() -> Option<ForegroundState> {
    None
}
pub fn list_window_apps() -> Vec<String> {
    vec![]
}
pub fn d3d_fullscreen() -> bool {
    false
}
pub fn power() -> PowerState {
    PowerState::default()
}
pub fn idle_seconds() -> u64 {
    0
}
pub fn local_minutes() -> u32 {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    ((secs / 60) % 1440) as u32
}
pub fn cursor(app: &AppHandle) -> Option<(i32, i32, bool)> {
    app.cursor_position().ok().map(|p| (p.x as i32, p.y as i32, false))
}
pub fn over_desktop(_x: i32, _y: i32, _own: &[isize]) -> bool {
    true
}
pub fn sys_stats(_prev: &mut CpuSample) -> SysStats {
    SysStats::default()
}
pub fn diagnostics(windows: &[(String, isize)]) -> Vec<String> {
    windows.iter().map(|(l, _)| format!("{l}: non-Windows fallback window")).collect()
}
