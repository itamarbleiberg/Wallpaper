use crate::config::Settings;
use crate::wallpaper::WallpaperTarget;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Child;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

#[derive(Clone, Serialize, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub paused: bool,
    pub muted: bool,
    pub throttle: bool,
    pub dim: bool,
    pub reason: String,
}

pub type JobHandle = Arc<Mutex<Option<Child>>>;

pub struct AppState {
    pub config: Mutex<Value>,
    pub config_path: PathBuf,
    pub library_dir: PathBuf,
    pub tools_dir: PathBuf,
    pub targets: Mutex<Vec<WallpaperTarget>>,
    pub playback: Mutex<HashMap<String, PlaybackState>>,
    pub jobs: Mutex<HashMap<String, JobHandle>>,
    pub all_paused: AtomicBool,
    pub cursor_hz: AtomicU32,
    pub audio_enabled: AtomicBool,
    pub sysmon_enabled: AtomicBool,
}

impl AppState {
    pub fn load(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let config_dir = app.path().app_config_dir()?;
        let data_dir = app.path().app_data_dir()?;
        let library_dir = data_dir.join("library");
        let tools_dir = data_dir.join("bin");
        std::fs::create_dir_all(&config_dir)?;
        std::fs::create_dir_all(&library_dir)?;
        let _ = std::fs::create_dir_all(&tools_dir);
        let config_path = config_dir.join("config.json");
        let config = std::fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .filter(|v| v.is_object())
            .unwrap_or_else(|| Value::Object(Default::default()));

        let st = Self {
            config: Mutex::new(config),
            config_path,
            library_dir,
            tools_dir,
            targets: Mutex::new(Vec::new()),
            playback: Mutex::new(HashMap::new()),
            jobs: Mutex::new(HashMap::new()),
            all_paused: AtomicBool::new(false),
            cursor_hz: AtomicU32::new(120),
            audio_enabled: AtomicBool::new(false),
            sysmon_enabled: AtomicBool::new(false),
        };
        st.refresh_flags();
        Ok(st)
    }

    pub fn settings(&self) -> Settings {
        Settings::from_value(&self.config.lock().unwrap())
    }

    pub fn config_value(&self) -> Value {
        self.config.lock().unwrap().clone()
    }

    pub fn set_config(&self, v: Value) {
        *self.config.lock().unwrap() = v;
        self.refresh_flags();
        self.save();
    }

    /// Mutate the raw JSON config in place (used by the tray menu).
    pub fn modify(&self, f: impl FnOnce(&mut Value)) -> Value {
        let v = {
            let mut c = self.config.lock().unwrap();
            if !c.is_object() {
                *c = Value::Object(Default::default());
            }
            f(&mut c);
            c.clone()
        };
        self.refresh_flags();
        self.save();
        v
    }

    pub fn refresh_flags(&self) {
        let s = self.settings();
        self.cursor_hz
            .store(s.performance.cursor_hz.clamp(15, 240), Ordering::Relaxed);
        self.audio_enabled.store(s.needs_audio(), Ordering::Relaxed);
        self.sysmon_enabled
            .store(s.widgets.sysmon.enabled, Ordering::Relaxed);
    }

    pub fn save(&self) {
        let text = match serde_json::to_string_pretty(&*self.config.lock().unwrap()) {
            Ok(t) => t,
            Err(_) => return,
        };
        let tmp = self.config_path.with_extension("json.tmp");
        if std::fs::write(&tmp, text).is_ok() {
            let _ = std::fs::rename(&tmp, &self.config_path);
        }
    }

    /// Paths the custom `wallvid://` protocol is allowed to serve.
    pub fn is_media_allowed(&self, path: &std::path::Path) -> bool {
        let canon = match std::fs::canonicalize(path) {
            Ok(p) => p,
            Err(_) => return false,
        };
        if let Ok(lib) = std::fs::canonicalize(&self.library_dir) {
            if canon.starts_with(&lib) {
                return true;
            }
        }
        let s = self.settings();
        let same = |p: &str| {
            !p.is_empty()
                && std::fs::canonicalize(p)
                    .map(|c| c == canon)
                    .unwrap_or(false)
        };
        s.library.iter().any(|l| same(&l.path))
            || s.presets.iter().any(|p| same(&p.video.path) || same(&p.image.path))
    }
}
