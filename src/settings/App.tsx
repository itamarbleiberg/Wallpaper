import { useEffect, useRef, useState, type ReactElement } from "react";
import { invoke, videoUrlResolver } from "../shared/ipc";
import { Icon } from "./icons";
import { useStore, type Page } from "./store";
import { setThumbUrlResolver } from "./thumbs";
import { captureForSave } from "./pages/EditorPage";
import { GalleryPage } from "./pages/GalleryPage";
import { EditorPage } from "./pages/EditorPage";
import { WidgetsPage } from "./pages/WidgetsPage";
import { AutomationPage } from "./pages/AutomationPage";
import { DisplaysPage } from "./pages/DisplaysPage";
import { PerformancePage } from "./pages/PerformancePage";
import { SettingsPage } from "./pages/SettingsPage";

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "gallery", label: "Gallery", icon: "gallery" },
  { id: "editor", label: "Customize", icon: "edit" },
  { id: "widgets", label: "Widgets", icon: "widgets" },
  { id: "automation", label: "Automation", icon: "automation" },
  { id: "displays", label: "Displays", icon: "displays" },
  { id: "performance", label: "Performance", icon: "performance" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const PAGES: Record<Page, () => ReactElement | null> = {
  gallery: GalleryPage,
  editor: EditorPage,
  widgets: WidgetsPage,
  automation: AutomationPage,
  displays: DisplaysPage,
  performance: PerformancePage,
  settings: SettingsPage,
};

export function App() {
  const { config, page, go, init, toast, undo, redo, past, future } = useStore();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    videoUrlResolver().then(setThumbUrlResolver);
    init().catch((e) => setErr(String(e)));
  }, [init]);

  // Global undo / redo (ignored while typing in a field).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [undo, redo]);

  // Keep the regular Windows wallpaper in sync with the live one.
  const lastSynced = useRef<string | null>(null);
  const activeId = config?.display.defaultPresetId;
  const syncOn = config?.general.syncStaticWallpaper;
  useEffect(() => {
    const st = useStore.getState();
    if (!syncOn || !activeId || !st.config || lastSynced.current === activeId) return;
    lastSynced.current = activeId;
    const p = st.config.presets.find((x) => x.id === activeId);
    if (!p) return;
    const t = setTimeout(async () => {
      try {
        await invoke("save_image", { dataUrl: await captureForSave(p, st.monitors), purpose: "wallpaper" });
      } catch { /* not fatal */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [activeId, syncOn]);

  useEffect(() => {
    if (config) document.documentElement.style.setProperty("--accent", config.general.accent || "#3fc2ff");
  }, [config?.general.accent]);

  if (err) return <div className="boot"><Icon name="info" size={28} /><p>AquaWall could not start</p><code>{err}</code></div>;
  if (!config) return <div className="boot"><div className="spinner" /><p>Loading AquaWall…</p></div>;

  const Current = PAGES[page];
  const active = config.presets.find((p) => p.id === config.display.defaultPresetId);

  return (
    <div className="shell">
      <nav className="rail">
        <div className="brand">
          <div className="brand-mark"><Icon name="water" size={20} /></div>
          <div className="brand-text"><b>AquaWall</b><span>Live wallpapers</span></div>
        </div>
        <div className="nav-list">
          {NAV.map((n) => (
            <button key={n.id} className={`nav ${page === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
            </button>
          ))}
        </div>
        <div className="rail-foot">
          <div className="now">
            <span className={`dot ${config.paused ? "off" : "on"}`} />
            <div>
              <small>{config.paused ? "Paused" : "On your desktop"}</small>
              <b title={active?.name}>{active?.name ?? "—"}</b>
            </div>
          </div>
          <div className="transport">
            <button title="Previous wallpaper" onClick={() => invoke("step_wallpaper", { dir: -1 })}><Icon name="prev" size={15} /></button>
            <button title={config.paused ? "Resume" : "Pause"} className="big" onClick={() => invoke("set_paused", { paused: !config.paused })}>
              <Icon name={config.paused ? "play" : "pause"} size={16} />
            </button>
            <button title="Next wallpaper" onClick={() => invoke("step_wallpaper", { dir: 1 })}><Icon name="next" size={15} /></button>
            <button title="Surprise me" onClick={() => invoke("step_wallpaper", { dir: 0 })}><Icon name="shuffle" size={15} /></button>
          </div>
          <div className="undo-row">
            <button disabled={!past.length} onClick={undo} title="Undo (Ctrl+Z)"><Icon name="undo" size={14} /> Undo</button>
            <button disabled={!future.length} onClick={redo} title="Redo (Ctrl+Y)"><Icon name="redo" size={14} /> Redo</button>
          </div>
        </div>
      </nav>
      <main className="main">
        <Current />
      </main>
      {toast && <div className={`toast ${toast.kind}`}><Icon name={toast.kind === "error" ? "info" : "check"} size={16} />{toast.msg}</div>}
    </div>
  );
}
