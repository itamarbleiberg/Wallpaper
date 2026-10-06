//! System-wide hotkeys (pause, next/previous wallpaper, mute, open settings).

use crate::automation;
use crate::state::AppState;
use crate::tray;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Default)]
pub struct HotkeyMap(pub Mutex<HashMap<u32, String>>);

pub fn plugin() -> tauri::plugin::TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app: &AppHandle, shortcut: &Shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let id = shortcut.id();
            let action = app.try_state::<HotkeyMap>().and_then(|m| m.0.lock().unwrap().get(&id).cloned());
            if let Some(a) = action {
                let h = app.clone();
                let _ = app.run_on_main_thread(move || run(&h, &a));
            }
        })
        .build()
}

pub fn run(app: &AppHandle, action: &str) {
    match action {
        "pause" => toggle(app, "paused"),
        "mute" => toggle(app, "muted"),
        "next" => automation::step(app, 1),
        "prev" => automation::step(app, -1),
        "settings" => tray::show_settings(app),
        _ => {}
    }
}

pub fn toggle(app: &AppHandle, key: &'static str) {
    let v = app.state::<AppState>().modify(|c| {
        let cur = c.get(key).and_then(|v| v.as_bool()).unwrap_or(false);
        c[key] = json!(!cur);
    });
    let _ = app.emit("config-changed", &v);
    let h = app.clone();
    let _ = app.run_on_main_thread(move || tray::refresh(&h));
}

/// (Re-)register shortcuts from config. Returns human-readable errors.
pub fn apply(app: &AppHandle) -> Vec<String> {
    let s = app.state::<AppState>().settings();
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let map = app.state::<HotkeyMap>();
    let mut m = map.0.lock().unwrap();
    m.clear();
    let mut errors = vec![];
    if !s.hotkeys.enabled {
        return errors;
    }
    let k = &s.hotkeys;
    for (action, combo) in [("pause", &k.pause), ("next", &k.next), ("prev", &k.prev), ("mute", &k.mute), ("settings", &k.settings)] {
        let combo = combo.trim();
        if combo.is_empty() {
            continue;
        }
        match combo.parse::<Shortcut>() {
            Ok(sc) => {
                let id = sc.id();
                match gs.register(sc) {
                    Ok(()) => {
                        m.insert(id, action.to_string());
                    }
                    Err(e) => errors.push(format!("{combo}: {e}")),
                }
            }
            Err(e) => errors.push(format!("{combo}: {e}")),
        }
    }
    errors
}
