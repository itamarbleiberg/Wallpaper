import { useEffect, useState } from "react";
import { invoke } from "../shared/ipc";
import { Preview } from "./Preview";
import { useStore, type Tab } from "./store";
import { LibraryPanel } from "./panels/LibraryPanel";
import { WaterPanel } from "./panels/WaterPanel";
import { VideoPanel } from "./panels/VideoPanel";
import { ShaderPanel } from "./panels/ShaderPanel";
import { EffectsPanel } from "./panels/EffectsPanel";
import { EnhancePanel } from "./panels/EnhancePanel";
import { WidgetsPanel } from "./panels/WidgetsPanel";
import { DisplaysPanel } from "./panels/DisplaysPanel";
import { PerformancePanel } from "./panels/PerformancePanel";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "library", label: "Library", icon: "▦" },
  { id: "water", label: "Water", icon: "≋" },
  { id: "video", label: "Video", icon: "▶" },
  { id: "shader", label: "Shader", icon: "✦" },
  { id: "effects", label: "Effects", icon: "✺" },
  { id: "enhance", label: "Enhance", icon: "◐" },
  { id: "widgets", label: "Widgets", icon: "◷" },
  { id: "displays", label: "Displays", icon: "▭" },
  { id: "performance", label: "Performance", icon: "⚡" },
];

export function App() {
  const { config, tab, setTab, init, selectedId, select, applyPreset, toast } = useStore();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    init().catch((e) => setErr(String(e)));
  }, [init]);

  if (err) return <div className="boot">Failed to start: {err}</div>;
  if (!config) return <div className="boot">Loading AquaWall…</div>;
  const preset = config.presets.find((p) => p.id === selectedId) ?? config.presets[0];

  const Panel = {
    library: LibraryPanel, water: WaterPanel, video: VideoPanel, shader: ShaderPanel, effects: EffectsPanel,
    enhance: EnhancePanel, widgets: WidgetsPanel, displays: DisplaysPanel, performance: PerformancePanel,
  }[tab];

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand"><span className="logo">◉</span> AquaWall</div>
        {TABS.map((t) => (
          <button key={t.id} className={`nav ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>{t.label}
          </button>
        ))}
        <div className="sidebar-foot">
          <button className={`btn block ${config.paused ? "primary" : "ghost"}`} onClick={() => invoke("set_paused", { paused: !config.paused })}>
            {config.paused ? "▶ Resume wallpaper" : "❚❚ Pause wallpaper"}
          </button>
        </div>
      </nav>

      <main className="content">
        <header className="topbar">
          <select className="preset-select" value={preset.id} onChange={(e) => select(e.target.value)}>
            {config.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="dim small">Editing changes apply live</span>
          <span className="spacer" />
          <button className="btn primary" onClick={() => applyPreset(preset.id)}>Set as wallpaper (all displays)</button>
        </header>
        <div className="panel"><Panel /></div>
      </main>

      <aside className="side-preview">
        <Preview preset={preset} />
        <div className="preview-meta">
          <b>{preset.name}</b>
          <span className="dim small">{preset.kind === "water" ? "Interactive water pool" : preset.kind === "video" ? "Video wallpaper" : "Shader wallpaper"}</span>
        </div>
      </aside>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
