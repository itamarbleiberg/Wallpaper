//! Non-Windows stubs so the project still compiles for UI development on
//! macOS/Linux. Wallpaper windows become plain always-on-bottom windows.

use super::{AttachResult, CpuSample, ForegroundState, PowerState, SysStats};
use crate::wallpaper::Rect;
use tauri::AppHandle;

pub fn attach(_hwnd: isize, _rect: &Rect) -> AttachResult {
    AttachResult { mode: "fallback", parent: 0 }
}
pub fn keep_bottom(_hwnd: isize) {}
pub fn detach(_hwnd: isize) {}
pub fn is_alive(_hwnd: isize, _parent: isize) -> bool {
    true
}
pub fn refresh_wallpaper() {}
pub fn foreground_state() -> Option<ForegroundState> {
    None
}
pub fn d3d_fullscreen() -> bool {
    false
}
pub fn power() -> PowerState {
    PowerState::default()
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
