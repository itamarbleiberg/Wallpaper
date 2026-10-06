//! CPU / RAM sampler for the system monitor widget (runs only when enabled).

use crate::desktop::{self, CpuSample};
use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        let mut prev = CpuSample::default();
        loop {
            std::thread::sleep(Duration::from_millis(1000));
            let st = app.state::<AppState>();
            if !st.sysmon_enabled.load(Ordering::Relaxed) || st.all_paused.load(Ordering::Relaxed) {
                continue;
            }
            let stats = desktop::sys_stats(&mut prev);
            let _ = app.emit("sys-stats", stats);
        }
    });
}
