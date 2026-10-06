use crate::media::{self, BakeRequest, ToolStatus};
use crate::state::{AppState, PlaybackState};
use crate::tray;
use crate::wallpaper::{self, MonitorInfo, WallpaperTarget};
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Value {
    state.config_value()
}

#[tauri::command]
pub async fn set_config(app: AppHandle, config: Value) -> Result<(), String> {
    if !config.is_object() {
        return Err("config must be an object".into());
    }
    let st = app.state::<AppState>();
    let old = st.settings();
    st.set_config(config.clone());
    let new = st.settings();
    let _ = app.emit("config-changed", &config);

    let presets_changed = old.presets.len() != new.presets.len()
        || old.presets.iter().zip(new.presets.iter()).any(|(a, b)| a.id != b.id || a.name != b.name);
    if old.display != new.display || presets_changed || old.paused != new.paused {
        let h = app.clone();
        let _ = app.run_on_main_thread(move || {
            wallpaper::sync(&h, false);
            tray::refresh(&h);
        });
    }
    if old.general.autostart != new.general.autostart {
        use tauri_plugin_autostart::ManagerExt;
        let al = app.autolaunch();
        let _ = if new.general.autostart { al.enable() } else { al.disable() };
    }
    Ok(())
}

#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    wallpaper::list_monitors(&app)
}

#[tauri::command]
pub fn get_targets(state: State<'_, AppState>) -> Vec<WallpaperTarget> {
    state.targets.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_playback(state: State<'_, AppState>) -> HashMap<String, PlaybackState> {
    state.playback.lock().unwrap().clone()
}

#[tauri::command]
pub async fn reattach(app: AppHandle) {
    let h = app.clone();
    let _ = app.run_on_main_thread(move || wallpaper::sync(&h, true));
}

#[tauri::command]
pub async fn set_paused(app: AppHandle, paused: bool) {
    let v = app.state::<AppState>().modify(|c| c["paused"] = json!(paused));
    let _ = app.emit("config-changed", &v);
    let h = app.clone();
    let _ = app.run_on_main_thread(move || tray::refresh(&h));
}

#[tauri::command]
pub fn tool_status(app: AppHandle) -> ToolStatus {
    media::tool_status(&app)
}

#[tauri::command]
pub fn import_url(app: AppHandle, url: String) -> Result<String, String> {
    let url = url.trim().to_string();
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Please enter an http(s) URL".into());
    }
    media::import_url(&app, url)
}

#[tauri::command]
pub fn bake_video(app: AppHandle, request: BakeRequest) -> Result<String, String> {
    media::bake(&app, request)
}

#[tauri::command]
pub fn cancel_job(app: AppHandle, id: String) {
    media::cancel(&app, &id);
}

#[tauri::command]
pub fn open_folder(app: AppHandle, which: String) -> Result<(), String> {
    let st = app.state::<AppState>();
    let dir = if which == "tools" { st.tools_dir.clone() } else { st.library_dir.clone() };
    let _ = std::fs::create_dir_all(&dir);
    #[cfg(windows)]
    let prog = "explorer";
    #[cfg(target_os = "macos")]
    let prog = "open";
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let prog = "xdg-open";
    std::process::Command::new(prog).arg(dir).spawn().map(|_| ()).map_err(|e| e.to_string())
}
