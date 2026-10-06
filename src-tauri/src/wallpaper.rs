//! Creates one wallpaper webview window per display (or one spanning window),
//! embeds them behind the desktop icons and keeps them in sync with config.

use crate::desktop;
use crate::state::AppState;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const BROWSER_ARGS: &str = "--autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,CalculateNativeWinOcclusion";

#[derive(Clone, Copy, Serialize, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

impl Rect {
    pub fn intersects(&self, o: &Rect) -> bool {
        self.x < o.x + o.w && o.x < self.x + self.w && self.y < o.y + o.h && o.y < self.y + self.h
    }
    pub fn union(&self, o: &Rect) -> Rect {
        let x = self.x.min(o.x);
        let y = self.y.min(o.y);
        let r = (self.x + self.w).max(o.x + o.w);
        let b = (self.y + self.h).max(o.y + o.h);
        Rect { x, y, w: r - x, h: b - y }
    }
}

#[derive(Clone, Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub rect: Rect,
    pub scale: f64,
    pub primary: bool,
}

#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperTarget {
    pub label: String,
    pub preset_id: String,
    pub rect: Rect,
    pub monitors: Vec<MonitorInfo>,
    pub attach_mode: String,
    #[serde(skip)]
    pub hwnd: isize,
    #[serde(skip)]
    pub parent: isize,
}

pub fn list_monitors(app: &AppHandle) -> Vec<MonitorInfo> {
    let primary = app.primary_monitor().ok().flatten();
    let monitors = app.available_monitors().unwrap_or_default();
    monitors
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let pos = m.position();
            let size = m.size();
            let is_primary = primary
                .as_ref()
                .map(|p| p.position() == pos && p.size() == size)
                .unwrap_or(i == 0);
            let name = m.name().cloned().unwrap_or_else(|| format!("Display {}", i + 1));
            MonitorInfo {
                id: name.clone(),
                name,
                rect: Rect { x: pos.x, y: pos.y, w: size.width as i32, h: size.height as i32 },
                scale: m.scale_factor(),
                primary: is_primary,
            }
        })
        .collect()
}

fn desired(app: &AppHandle) -> Vec<WallpaperTarget> {
    let st = app.state::<AppState>();
    let s = st.settings();
    let mons = list_monitors(app);
    if mons.is_empty() {
        return vec![];
    }
    let mk = |label: String, preset_id: String, rect: Rect, monitors: Vec<MonitorInfo>| WallpaperTarget {
        label,
        preset_id,
        rect,
        monitors,
        attach_mode: String::new(),
        hwnd: 0,
        parent: 0,
    };
    match s.display.layout.as_str() {
        "span" => {
            let bbox = mons.iter().skip(1).fold(mons[0].rect, |acc, m| acc.union(&m.rect));
            vec![mk("wallpaper-span".into(), s.resolve_preset("span"), bbox, mons.clone())]
        }
        "clone" => mons
            .iter()
            .enumerate()
            .map(|(i, m)| mk(format!("wallpaper-{i}"), s.default_preset(), m.rect, vec![m.clone()]))
            .collect(),
        _ => mons
            .iter()
            .enumerate()
            .map(|(i, m)| mk(format!("wallpaper-{i}"), s.resolve_preset(&m.id), m.rect, vec![m.clone()]))
            .collect(),
    }
}

fn create_window(app: &AppHandle, label: &str) -> tauri::Result<WebviewWindow> {
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("wallpaper.html".into()))
        .title("AquaWall Wallpaper")
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .shadow(false);
    #[cfg(windows)]
    let builder = builder.additional_browser_args(BROWSER_ARGS);
    builder.build()
}

#[cfg(windows)]
fn hwnd_of(w: &WebviewWindow) -> isize {
    w.hwnd().map(|h| h.0 as isize).unwrap_or(0)
}
#[cfg(not(windows))]
fn hwnd_of(_w: &WebviewWindow) -> isize {
    0
}

/// Reconcile wallpaper windows with config + connected displays.
/// Must run on the main thread.
pub fn sync(app: &AppHandle, force_attach: bool) {
    let st = app.state::<AppState>();
    let mut want = desired(app);
    let previous = st.targets.lock().unwrap().clone();

    for (label, w) in app.webview_windows() {
        if label.starts_with("wallpaper-") && !want.iter().any(|t| t.label == label) {
            desktop::detach(hwnd_of(&w));
            let _ = w.destroy();
        }
    }

    for t in want.iter_mut() {
        let (win, created) = match app.get_webview_window(&t.label) {
            Some(w) => (w, false),
            None => match create_window(app, &t.label) {
                Ok(w) => (w, true),
                Err(e) => {
                    eprintln!("[aquawall] failed to create {}: {e}", t.label);
                    continue;
                }
            },
        };
        t.hwnd = hwnd_of(&win);
        let prev = previous.iter().find(|p| p.label == t.label);
        let unchanged = !created
            && !force_attach
            && prev.map(|p| p.rect == t.rect && p.hwnd == t.hwnd && desktop::is_alive(p.hwnd, p.parent)) == Some(true);
        if unchanged {
            let p = prev.unwrap();
            t.attach_mode = p.attach_mode.clone();
            t.parent = p.parent;
            continue;
        }
        if cfg!(windows) {
            let res = desktop::attach(t.hwnd, &t.rect);
            t.attach_mode = res.mode.to_string();
            t.parent = res.parent;
        } else {
            let _ = win.set_position(tauri::PhysicalPosition::new(t.rect.x, t.rect.y));
            let _ = win.set_size(tauri::PhysicalSize::new(t.rect.w as u32, t.rect.h as u32));
            let _ = win.set_always_on_bottom(true);
            let _ = win.show();
            t.attach_mode = "fallback".into();
        }
    }

    // Every wallpaper window must sit between the icons and the static
    // wallpaper - re-assert the full stack (fixes windows hiding each other).
    let hwnds: Vec<isize> = want.iter().filter(|t| t.attach_mode != "fallback").map(|t| t.hwnd).collect();
    desktop::restack(&hwnds);

    *st.targets.lock().unwrap() = want.clone();
    let _ = app.emit("targets-changed", &want);
}

/// Schedule a sync on the main thread from any thread.
pub fn request_sync(app: &AppHandle, force_attach: bool) {
    let h = app.clone();
    let _ = app.run_on_main_thread(move || sync(&h, force_attach));
}

/// Detach all wallpaper windows and restore the static wallpaper.
pub fn shutdown(app: &AppHandle) {
    let st = app.state::<AppState>();
    let targets = std::mem::take(&mut *st.targets.lock().unwrap());
    for t in targets {
        desktop::detach(t.hwnd);
        if let Some(w) = app.get_webview_window(&t.label) {
            let _ = w.destroy();
        }
    }
    desktop::refresh_wallpaper();
}
