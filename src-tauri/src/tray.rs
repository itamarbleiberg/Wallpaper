//! System tray: pause/resume, mute, next/previous, quick preset switching,
//! settings, re-attach, exit.

use crate::automation;
use crate::hotkeys;
use crate::state::AppState;
use crate::wallpaper;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

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
    let mute = CheckMenuItem::with_id(app, "mute", "Mute wallpaper audio", true, s.muted, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", "Next wallpaper", true, None::<&str>)?;
    let prev = MenuItem::with_id(app, "prev", "Previous wallpaper", true, None::<&str>)?;
    let random = MenuItem::with_id(app, "random", "Surprise me", true, None::<&str>)?;

    let mut favs: Vec<CheckMenuItem<Wry>> = vec![];
    let mut all: Vec<CheckMenuItem<Wry>> = vec![];
    for p in &s.presets {
        let name = if p.name.is_empty() { p.id.clone() } else { p.name.clone() };
        if p.favorite {
            favs.push(CheckMenuItem::with_id(app, format!("fav:{}", p.id), format!("★ {name}"), true, p.id == active, None::<&str>)?);
        }
        all.push(CheckMenuItem::with_id(app, format!("preset:{}", p.id), name, true, p.id == active, None::<&str>)?);
    }
    let refs: Vec<&dyn IsMenuItem<Wry>> = all.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
    let presets = Submenu::with_id_and_items(app, "presets", "All wallpapers", true, &refs)?;
    let settings = MenuItem::with_id(app, "settings", "Open AquaWall...", true, None::<&str>)?;
    let reattach = MenuItem::with_id(app, "reattach", "Re-attach to desktop", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Exit AquaWall", true, None::<&str>)?;
    let sep = || PredefinedMenuItem::separator(app);

    let menu = Menu::with_items(app, &[&settings, &sep()?, &pause, &mute, &next, &prev, &random, &sep()?])?;
    for f in &favs {
        menu.append(f)?;
    }
    if !favs.is_empty() {
        menu.append(&sep()?)?;
    }
    menu.append_items(&[&presets, &sep()?, &reattach, &quit])?;
    Ok(menu)
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("AquaWall")
        .menu(&menu)
        .on_menu_event(|app, event| on_menu(app, event.id().as_ref()))
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => show_settings(tray.app_handle()),
            TrayIconEvent::Click { button: MouseButton::Middle, button_state: MouseButtonState::Up, .. } => {
                automation::step(tray.app_handle(), 1)
            }
            _ => {}
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

fn on_menu(app: &AppHandle, id: &str) {
    match id {
        "pause" => hotkeys::toggle(app, "paused"),
        "mute" => hotkeys::toggle(app, "muted"),
        "next" => automation::step(app, 1),
        "prev" => automation::step(app, -1),
        "random" => automation::step(app, 0),
        "settings" => show_settings(app),
        "reattach" => wallpaper::sync(app, true),
        "quit" => {
            wallpaper::shutdown(app);
            app.exit(0);
        }
        other => {
            if let Some(pid) = other.strip_prefix("preset:").or_else(|| other.strip_prefix("fav:")) {
                automation::set_active(app, pid);
            }
        }
    }
}
