//! Performance watchdog: pauses/mutes/throttles wallpapers while fullscreen or
//! maximized apps are focused or the laptop is on battery, keeps the windows
//! embedded after explorer.exe restarts, and reacts to display changes.

use crate::desktop;
use crate::state::{AppState, PlaybackState};
use crate::tray;
use crate::wallpaper::{self, MonitorInfo};
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

fn apply(action: &str, label: &str, st: &mut PlaybackState, reasons: &mut Vec<String>) {
    match action {
        "pause" => st.paused = true,
        "mute" => st.muted = true,
        "throttle" => st.throttle = true,
        _ => return,
    }
    reasons.push(label.to_string());
}

pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last: HashMap<String, PlaybackState> = HashMap::new();
        let mut last_monitors: Vec<MonitorInfo> = wallpaper::list_monitors(&app);
        let mut tick: u64 = 0;
        loop {
            let st = app.state::<AppState>();
            let s = st.settings();
            std::thread::sleep(Duration::from_millis(s.performance.poll_ms.clamp(250, 5000)));
            tick += 1;

            let fg = desktop::foreground_state();
            let d3d = desktop::d3d_fullscreen();
            let pw = desktop::power();
            let targets = st.targets.lock().unwrap().clone();
            let p = &s.performance;

            let mut states = HashMap::new();
            for t in &targets {
                let mut ps = PlaybackState { paused: s.paused, ..Default::default() };
                let mut reasons = vec![];
                if s.paused {
                    reasons.push("paused manually".to_string());
                }
                if let Some(f) = &fg {
                    if f.monitor.intersects(&t.rect) {
                        if f.fullscreen || d3d {
                            apply(&p.on_fullscreen, "fullscreen app", &mut ps, &mut reasons);
                        } else if f.maximized {
                            apply(&p.on_maximized, "maximized app", &mut ps, &mut reasons);
                        }
                    }
                }
                if pw.on_battery && pw.percent <= p.battery_threshold {
                    apply(&p.on_battery, "on battery", &mut ps, &mut reasons);
                }
                if pw.saver && p.pause_on_battery_saver {
                    apply("pause", "battery saver", &mut ps, &mut reasons);
                }
                ps.reason = reasons.join(", ");
                if t.attach_mode == "fallback" && !ps.paused {
                    desktop::keep_bottom(t.hwnd);
                }
                states.insert(t.label.clone(), ps);
            }

            let all_paused = !states.is_empty() && states.values().all(|s| s.paused);
            st.all_paused.store(all_paused, Ordering::Relaxed);
            if states != last {
                *st.playback.lock().unwrap() = states.clone();
                let _ = app.emit("playback", &states);
                let tip = match states.values().find(|s| s.paused) {
                    Some(s) if all_paused => format!("AquaWall - paused ({})", s.reason),
                    _ => "AquaWall - running".to_string(),
                };
                tray::set_tooltip(&app, &tip);
                last = states;
            }

            // Every ~3 s: detect lost embedding (explorer restart) or display changes.
            if tick % 4 == 0 {
                let lost = targets.iter().any(|t| !desktop::is_alive(t.hwnd, t.parent));
                let monitors = wallpaper::list_monitors(&app);
                let changed = monitors != last_monitors;
                if changed {
                    last_monitors = monitors;
                }
                if lost || changed {
                    wallpaper::request_sync(&app, true);
                }
            }
        }
    });
}
