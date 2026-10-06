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
    pub playlist: Playlist,
    pub schedule: Schedule,
    pub hotkeys: Hotkeys,
    pub paused: bool,
    pub muted: bool,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct PresetRef {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub favorite: bool,
    pub video: PathRef,
    pub image: PathRef,
    pub water: WaterRef,
    pub effects: EffectsRef,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct PathRef {
    pub path: String,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct WaterRef {
    pub audio_reactive: f64,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct EffectsRef {
    pub beat_pulse: f64,
    pub audio_ripples: f64,
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
        Self { layout: "independent".into(), assignments: HashMap::new(), default_preset_id: "builtin-pool".into() }
    }
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Performance {
    pub on_fullscreen: String,
    pub on_maximized: String,
    pub on_battery: String,
    pub battery_threshold: u8,
    pub pause_on_battery_saver: bool,
    pub poll_ms: u64,
    pub cursor_hz: u32,
    pub idle_enabled: bool,
    pub idle_minutes: f64,
    /// "pause" | "dim" | "throttle"
    pub idle_action: String,
    /// lower-case exe names that pause all wallpapers while focused
    pub blocked_apps: Vec<String>,
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
            idle_enabled: false,
            idle_minutes: 10.0,
            idle_action: "dim".into(),
            blocked_apps: vec![],
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

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Playlist {
    pub enabled: bool,
    pub preset_ids: Vec<String>,
    pub interval_min: f64,
    pub shuffle: bool,
}

impl Default for Playlist {
    fn default() -> Self {
        Self { enabled: false, preset_ids: vec![], interval_min: 15.0, shuffle: false }
    }
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Schedule {
    pub enabled: bool,
    pub slots: Vec<Slot>,
}

#[derive(Deserialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Slot {
    /// "HH:MM"
    pub start: String,
    pub preset_id: String,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Hotkeys {
    pub enabled: bool,
    pub pause: String,
    pub next: String,
    pub prev: String,
    pub mute: String,
    pub settings: String,
}

impl Default for Hotkeys {
    fn default() -> Self {
        Self {
            enabled: true,
            pause: "Ctrl+Alt+P".into(),
            next: "Ctrl+Alt+Right".into(),
            prev: "Ctrl+Alt+Left".into(),
            mute: "Ctrl+Alt+M".into(),
            settings: "Ctrl+Alt+W".into(),
        }
    }
}

pub fn parse_hhmm(s: &str) -> Option<u32> {
    let (h, m) = s.trim().split_once(':')?;
    let h: u32 = h.parse().ok()?;
    let m: u32 = m.parse().ok()?;
    (h < 24 && m < 60).then_some(h * 60 + m)
}

impl Settings {
    pub fn from_value(v: &Value) -> Self {
        serde_json::from_value(v.clone()).unwrap_or_default()
    }

    pub fn default_preset(&self) -> String {
        if self.presets.iter().any(|p| p.id == self.display.default_preset_id) {
            return self.display.default_preset_id.clone();
        }
        self.presets.first().map(|p| p.id.clone()).unwrap_or_else(|| "builtin-pool".into())
    }

    pub fn resolve_preset(&self, key: &str) -> String {
        match self.display.assignments.get(key) {
            Some(id) if self.presets.iter().any(|p| &p.id == id) => id.clone(),
            _ => self.default_preset(),
        }
    }

    /// Preset ids currently on screen.
    pub fn active_ids(&self) -> Vec<String> {
        let mut v = vec![self.default_preset()];
        v.extend(self.display.assignments.values().cloned());
        v
    }

    /// Order used by "next/previous wallpaper": playlist, else favorites, else all.
    pub fn cycle_list(&self) -> Vec<String> {
        let exists = |id: &String| self.presets.iter().any(|p| &p.id == id);
        if self.playlist.enabled {
            let v: Vec<String> = self.playlist.preset_ids.iter().filter(|i| exists(i)).cloned().collect();
            if !v.is_empty() {
                return v;
            }
        }
        let fav: Vec<String> = self.presets.iter().filter(|p| p.favorite).map(|p| p.id.clone()).collect();
        if fav.len() >= 2 {
            return fav;
        }
        self.presets.iter().map(|p| p.id.clone()).collect()
    }

    /// Does any on-screen wallpaper need the system audio spectrum?
    pub fn needs_audio(&self) -> bool {
        if self.widgets.visualizer.enabled {
            return true;
        }
        let ids = self.active_ids();
        self.presets.iter().filter(|p| ids.contains(&p.id)).any(|p| {
            p.kind == "shader" || p.water.audio_reactive > 0.0 || p.effects.beat_pulse > 0.0 || p.effects.audio_ripples > 0.0
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hhmm() {
        assert_eq!(parse_hhmm("06:30"), Some(390));
        assert_eq!(parse_hhmm("24:00"), None);
        assert_eq!(parse_hhmm("x"), None);
    }
}
