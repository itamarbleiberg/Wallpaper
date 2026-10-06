//! System tray: pause/resume, quick preset switching, settings, exit.

use crate::state::AppState;
use crate::wallpaper;
use serde_json::{json, Value};
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};

const TRAY_ID: &str = "aquawall-tray";

pub fn show_settings(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let s = app.state::<AppState>().settings();
    let active = s.default_preset();
    let pause = CheckMenuItem::with_id(app, "pause", "Pause wallpaper", true, s.paused, None::<&str>)?;
    let mut items: Vec<CheckMenuItem<Wry>> = vec![];
    for p in &s.presets {
        let name = if p.name.is_empty() { p.id.clone() } else { p.name.clone() };
        items.push(CheckMenuItem::with_id(app, format!("preset:{}", p.id), name, true, p.id == active, None::<&str>)?);
    }
    let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
    let presets = Submenu::with_id_and_items(app, "presets", "Switch wallpaper", true, &refs)?;
    let settings = MenuItem::with_id(app, "settings", "Open settings...", true, None::<&str>)?;
    let reattach = MenuItem::with_id(app, "reattach", "Re-attach to desktop", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Exit AquaWall", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    Menu::with_items(app, &[&pause, &presets, &sep1, &settings, &reattach, &sep2, &quit])
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("AquaWall")
        .menu(&menu)
        .on_menu_event(|app, event| on_menu(app, event.id().as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
                show_settings(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

pub fn refresh(app: &AppHandle) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), build_menu(app)) {
        let _ = tray.set_menu(Some(menu));
    }
}

pub fn set_tooltip(app: &AppHandle, text: &str) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(text));
    }
}

fn apply_config_change(app: &AppHandle, f: impl FnOnce(&mut Value)) {
    let v = app.state::<AppState>().modify(f);
    let _ = app.emit("config-changed", &v);
    wallpaper::sync(app, false);
    refresh(app);
}

fn on_menu(app: &AppHandle, id: &str) {
    match id {
        "pause" => apply_config_change(app, |c| {
            let p = c.get("paused").and_then(|v| v.as_bool()).unwrap_or(false);
            c["paused"] = json!(!p);
        }),
        "settings" => show_settings(app),
        "reattach" => wallpaper::sync(app, true),
        "quit" => {
            wallpaper::shutdown(app);
            app.exit(0);
        }
        other => {
            if let Some(pid) = other.strip_prefix("preset:") {
                let pid = pid.to_string();
                apply_config_change(app, move |c| {
                    if !c.get("display").map(|d| d.is_object()).unwrap_or(false) {
                        c["display"] = json!({});
                    }
                    c["display"]["defaultPresetId"] = json!(pid);
                    c["display"]["assignments"] = json!({});
                });
            }
        }
    }
}
