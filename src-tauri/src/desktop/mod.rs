//! Platform layer: desktop embedding, foreground/fullscreen detection, power,
//! idle time, cursor polling and CPU/RAM sampling.

use crate::wallpaper::Rect;

#[cfg(windows)]
mod win;
#[cfg(windows)]
pub use win::*;

#[cfg(not(windows))]
mod other;
#[cfg(not(windows))]
pub use other::*;

#[derive(Clone, Debug)]
pub struct AttachResult {
    /// "workerw" | "progman-24h2" | "progman" | "fallback"
    pub mode: &'static str,
    pub parent: isize,
}

#[derive(Clone, Debug)]
pub struct ForegroundState {
    pub monitor: Rect,
    pub fullscreen: bool,
    pub maximized: bool,
    /// lower-case executable name, e.g. "photoshop.exe"
    pub exe: String,
}

#[derive(Clone, Debug, Default)]
pub struct PowerState {
    pub on_battery: bool,
    pub percent: u8,
    pub saver: bool,
    pub has_battery: bool,
}

#[derive(Clone, Debug, Default)]
pub struct CpuSample {
    pub idle: u64,
    pub total: u64,
}

#[derive(Clone, Debug, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SysStats {
    pub cpu: f32,
    pub mem: f32,
    pub mem_used_gb: f32,
    pub mem_total_gb: f32,
    pub battery: Option<u8>,
    pub charging: bool,
}
