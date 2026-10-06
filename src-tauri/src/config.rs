//! Typed, read-only view over the JSON config.
//!
//! The frontend owns the full schema (src/shared/types.ts). Rust only needs a
//! handful of fields, so it deserializes them leniently with defaults and keeps
//! the raw `serde_json::Value` as the source of truth.

use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub presets: Vec<PresetRef>,
    pub library: Vec<LibraryRef>,
    pub display: Display,
    pub performance: Performance,
    pub general: General,
    pub widgets: WidgetsRef,
    pub paused: bool,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct PresetRef {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub video: VideoRef,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct VideoRef {
    pub path: String,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct LibraryRef {
    pub path: String,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Display {
    /// "independent" | "clone" | "span"
    pub layout: String,
    /// monitor id (or "span") -> preset id
    pub assignments: HashMap<String, String>,
    pub default_preset_id: String,
}

impl Default for Display {
    fn default() -> Self {
        Self {
            layout: "independent".into(),
            assignments: HashMap::new(),
            default_preset_id: "builtin-pool".into(),
        }
    }
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Performance {
    /// "pause" | "mute" | "none"
    pub on_fullscreen: String,
    /// "pause" | "mute" | "none"
    pub on_maximized: String,
    /// "pause" | "throttle" | "none"
    pub on_battery: String,
    pub battery_threshold: u8,
    pub pause_on_battery_saver: bool,
    pub poll_ms: u64,
    pub cursor_hz: u32,
}

impl Default for Performance {
    fn default() -> Self {
        Self {
            on_fullscreen: "pause".into(),
            on_maximized: "none".into(),
            on_battery: "throttle".into(),
            battery_threshold: 100,
            pause_on_battery_saver: true,
            poll_ms: 750,
            cursor_hz: 120,
        }
    }
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct General {
    pub autostart: bool,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct WidgetsRef {
    pub visualizer: Enabled,
    pub sysmon: Enabled,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Enabled {
    pub enabled: bool,
}

impl Settings {
    pub fn from_value(v: &Value) -> Self {
        serde_json::from_value(v.clone()).unwrap_or_default()
    }

    pub fn default_preset(&self) -> String {
        if self.presets.iter().any(|p| p.id == self.display.default_preset_id) {
            return self.display.default_preset_id.clone();
        }
        self.presets
            .first()
            .map(|p| p.id.clone())
            .unwrap_or_else(|| "builtin-pool".into())
    }

    pub fn resolve_preset(&self, key: &str) -> String {
        match self.display.assignments.get(key) {
            Some(id) if self.presets.iter().any(|p| &p.id == id) => id.clone(),
            _ => self.default_preset(),
        }
    }
}
