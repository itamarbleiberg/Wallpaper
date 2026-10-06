use crate::automation;
use crate::desktop;
use crate::hotkeys;
use crate::media::{self, BakeRequest, ToolStatus};
use crate::state::{AppState, PlaybackState};
use crate::tray;
use crate::wallpaper::{self, MonitorInfo, WallpaperTarget};
use base64::Engine;
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Value {
    state.config_value()
}

#[tauri::command]
pub async fn set_config(app: AppHandle, config: Value) -> Result<Vec<String>, String> {
    if !config.is_object() {
        return Err("config must be an object".into());
    }
    let st = app.state::<AppState>();
    let old = st.settings();
    st.set_config(config.clone());
    let new = st.settings();
    let _ = app.emit("config-changed", &config);

    let presets_changed = old.presets.len() != new.presets.len()
        || old
            .presets
            .iter()
            .zip(new.presets.iter())
            .any(|(a, b)| a.id != b.id || a.name != b.name || a.favorite != b.favorite);
    if old.display != new.display || presets_changed || old.paused != new.paused || old.muted != new.muted {
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
    let mut errors = vec![];
    if old.hotkeys != new.hotkeys {
        errors = hotkeys::apply(&app);
    }
    Ok(errors)
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
pub fn diagnostics(state: State<'_, AppState>) -> Vec<String> {
    let t: Vec<(String, isize)> = state.targets.lock().unwrap().iter().map(|t| (t.label.clone(), t.hwnd)).collect();
    desktop::diagnostics(&t)
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
pub async fn step_wallpaper(app: AppHandle, dir: i32) {
    automation::step(&app, dir);
}

#[tauri::command]
pub fn hotkey_errors(app: AppHandle) -> Vec<String> {
    hotkeys::apply(&app)
}

#[tauri::command]
pub fn list_window_apps() -> Vec<String> {
    desktop::list_window_apps()
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

fn open_path(path: &std::path::Path) -> Result<(), String> {
    #[cfg(windows)]
    let prog = "explorer";
    #[cfg(target_os = "macos")]
    let prog = "open";
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let prog = "xdg-open";
    std::process::Command::new(prog).arg(path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_folder(app: AppHandle, which: String) -> Result<(), String> {
    let st = app.state::<AppState>();
    let dir = match which.as_str() {
        "tools" => st.tools_dir.clone(),
        "screenshots" => screenshots_dir(&app),
        _ => st.library_dir.clone(),
    };
    let _ = std::fs::create_dir_all(&dir);
    open_path(&dir)
}

fn screenshots_dir(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .picture_dir()
        .map(|p| p.join("AquaWall"))
        .unwrap_or_else(|_| app.state::<AppState>().library_dir.join("screenshots"))
}

/// Save a PNG data URL. purpose: "screenshot" (Pictures\AquaWall) or
/// "wallpaper" (also set as the static Windows wallpaper).
#[tauri::command]
pub fn save_image(app: AppHandle, data_url: String, purpose: String) -> Result<String, String> {
    let b64 = data_url.split_once(',').map(|(_, b)| b).unwrap_or(&data_url);
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64.trim()).map_err(|e| e.to_string())?;
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let st = app.state::<AppState>();
    let (dir, name) = if purpose == "wallpaper" {
        (st.library_dir.join("static"), format!("aquawall-static-{ts}.png"))
    } else {
        (screenshots_dir(&app), format!("AquaWall {ts}.png"))
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    if purpose == "wallpaper" {
        // Unique file names force Windows to refresh; drop the old ones.
        if let Ok(rd) = std::fs::read_dir(&dir) {
            for e in rd.flatten() {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
    let path = dir.join(name);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    let p = path.to_string_lossy().to_string();
    if purpose == "wallpaper" {
        if !desktop::set_static_wallpaper(&p) {
            return Err("Windows refused to set the static wallpaper".into());
        }
        let h = app.clone();
        // Explorer may rebuild its wallpaper layer - re-assert our stack.
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(800));
            wallpaper::request_sync(&h, true);
        });
    } else {
        let _ = open_path(&dir);
    }
    Ok(p)
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 20 * 1024 * 1024 {
        return Err("File is too large".into());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}
