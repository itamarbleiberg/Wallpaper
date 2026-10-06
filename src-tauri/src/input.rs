//! Global cursor polling. Embedded wallpaper windows never receive mouse
//! messages, so we poll the cursor and broadcast it to the wallpaper webviews.

use crate::desktop;
use crate::state::AppState;
use serde::Serialize;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Copy, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
struct CursorPayload {
    x: i32,
    y: i32,
    down: bool,
    over_desktop: bool,
}

pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last: Option<CursorPayload> = None;
        loop {
            let st = app.state::<AppState>();
            let hz = st.cursor_hz.load(Ordering::Relaxed).max(15);
            std::thread::sleep(Duration::from_micros(1_000_000 / hz as u64));
            if st.all_paused.load(Ordering::Relaxed) {
                continue;
            }
            let Some((x, y, down)) = desktop::cursor(&app) else { continue };
            let own: Vec<isize> = st.targets.lock().unwrap().iter().map(|t| t.hwnd).collect();
            let p = CursorPayload { x, y, down, over_desktop: desktop::over_desktop(x, y, &own) };
            if last != Some(p) {
                let _ = app.emit("cursor", p);
                last = Some(p);
            }
        }
    });
}
