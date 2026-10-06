//! Playlist rotation, time-of-day schedule and next/previous switching.

use crate::config::parse_hhmm;
use crate::desktop;
use crate::state::AppState;
use crate::tray;
use crate::wallpaper;
use serde_json::json;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Make `id` the wallpaper on every display.
pub fn set_active(app: &AppHandle, id: &str) {
    let id = id.to_string();
    let v = app.state::<AppState>().modify(move |c| {
        if !c.get("display").map(|d| d.is_object()).unwrap_or(false) {
            c["display"] = json!({});
        }
        c["display"]["defaultPresetId"] = json!(id);
        c["display"]["assignments"] = json!({});
    });
    let _ = app.emit("config-changed", &v);
    let h = app.clone();
    let _ = app.run_on_main_thread(move || {
        wallpaper::sync(&h, false);
        tray::refresh(&h);
    });
}

fn rand_index(n: usize, avoid: usize) -> usize {
    if n <= 1 {
        return 0;
    }
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(7);
    let mut x = seed ^ 0x9E37_79B9_7F4A_7C15;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    let mut i = (x % n as u64) as usize;
    if i == avoid {
        i = (i + 1) % n;
    }
    i
}

/// Step through the cycle list. `dir` = +1 next, -1 previous, 0 random.
pub fn step(app: &AppHandle, dir: i32) {
    let s = app.state::<AppState>().settings();
    let list = s.cycle_list();
    if list.is_empty() {
        return;
    }
    let cur = s.default_preset();
    let idx = list.iter().position(|i| *i == cur);
    let n = list.len();
    let next = match (dir, idx) {
        (0, i) => rand_index(n, i.unwrap_or(usize::MAX)),
        (_, None) => 0,
        (d, Some(i)) => ((i as i64 + d as i64).rem_euclid(n as i64)) as usize,
    };
    set_active(app, &list[next]);
}

pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_switch = Instant::now();
        let mut last_slot: Option<String> = None;
        loop {
            std::thread::sleep(Duration::from_secs(5));
            let s = app.state::<AppState>().settings();
            if s.paused {
                continue;
            }
            // Time-of-day schedule wins over the playlist.
            if s.schedule.enabled && !s.schedule.slots.is_empty() {
                let now = desktop::local_minutes();
                let mut slots: Vec<(u32, String)> = s
                    .schedule
                    .slots
                    .iter()
                    .filter_map(|sl| parse_hhmm(&sl.start).map(|m| (m, sl.preset_id.clone())))
                    .collect();
                slots.sort();
                // The active slot is the last one that started before now
                // (wrapping around midnight).
                let active = slots.iter().rev().find(|(m, _)| *m <= now).or_else(|| slots.last()).map(|(_, id)| id.clone());
                if let Some(id) = active {
                    if last_slot.as_ref() != Some(&id) {
                        last_slot = Some(id.clone());
                        if s.default_preset() != id && s.presets.iter().any(|p| p.id == id) {
                            set_active(&app, &id);
                        }
                    }
                }
                continue;
            }
            last_slot = None;
            if s.playlist.enabled {
                let interval = Duration::from_secs_f64((s.playlist.interval_min.max(0.25)) * 60.0);
                if last_switch.elapsed() >= interval {
                    last_switch = Instant::now();
                    step(&app, if s.playlist.shuffle { 0 } else { 1 });
                }
            } else {
                last_switch = Instant::now();
            }
        }
    });
}
