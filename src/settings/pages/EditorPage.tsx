import { useState } from "react";
import { exportText, invoke } from "../../shared/ipc";
import type { Category, Preset } from "../../shared/types";
import { CATEGORY_LABEL } from "../../shared/types";
import { Button, LazyInput } from "../controls";
import { Icon } from "../icons";
import { Preview } from "../Preview";
import { useStore } from "../store";
import {
  WaterInteraction, WaterLight, WaterFloor, VideoClip, VideoPlayback, VideoBake,
  ImageTab, ShaderCode, EffectsTab, EnhanceTab, captureForSave, type Upd,
} from "./editorPanels";
import { ColorInspector, TransformInspector, ChromaInspector, MotionInspector, FxInspector } from "../editor/inspectors";

export { captureForSave };

/** Resolve-style "pages" across the top of the editor. */
type EdPage = "media" | "edit" | "transform" | "color" | "effects" | "enhance";
const PAGES: { id: EdPage; label: string; icon: string }[] = [
  { id: "media", label: "Source", icon: "gallery" },
  { id: "edit", label: "Edit", icon: "edit" },
  { id: "transform", label: "Transform", icon: "monitor" },
  { id: "color", label: "Color", icon: "sparkle" },
  { id: "effects", label: "Effects", icon: "water" },
  { id: "enhance", label: "Enhance", icon: "image" },
];

// Which "Source/Edit" sub-panels each wallpaper kind gets.
function SourcePanel({ p, upd }: { p: Preset; upd: Upd }) {
  if (p.kind === "water") return <WaterInteraction w={p.water} upd={upd} />;
  if (p.kind === "video") return <VideoClip p={p} upd={upd} />;
  if (p.kind === "image") return <ImageTab p={p} upd={upd} />;
  return <ShaderCode p={p} upd={upd} />;
}
function EditPanel({ p, upd }: { p: Preset; upd: Upd }) {
  if (p.kind === "water") return <><WaterLight w={p.water} upd={upd} /><WaterFloor w={p.water} upd={upd} /></>;
  if (p.kind === "video") return <><VideoPlayback v={p.video} upd={upd} /><VideoBake p={p} /></>;
  if (p.kind === "image") return <MotionInspector p={p} upd={upd} />;
  return <MotionInspector p={p} upd={upd} />;
}

export function EditorPage() {
  const { selected, updatePreset, applyPreset, config, monitors, go, duplicate, remove, resetPreset, toggleFavorite, notify } = useStore();
  const [page, setPage] = useState<EdPage>("media");
  const [showScopes, setShowScopes] = useState(false);
  const p = selected();
  if (!p || !config) return null;
  const upd: Upd = updatePreset;
  const onDesktop = config.display.defaultPresetId === p.id || Object.values(config.display.assignments).includes(p.id);

  const save = async (purpose: "screenshot" | "wallpaper") => {
    try {
      await invoke("save_image", { dataUrl: await captureForSave(p, monitors), purpose });
      notify(purpose === "wallpaper" ? "Set as your Windows wallpaper (lock screen & Task View too)" : "Screenshot saved to Pictures\\AquaWall");
    } catch (e) {
      notify(String(e), "error");
    }
  };
  const exportPreset = async () => {
    const { builtin: _b, ...rest } = p;
    const ok = await exportText(`${p.name.replace(/[^\w -]+/g, "")}.aquawall`, JSON.stringify({ aquawall: 3, presets: [rest] }, null, 2), "aquawall");
    if (ok) notify("Wallpaper exported");
  };

  const inspector = (() => {
    switch (page) {
      case "media": return <SourcePanel p={p} upd={upd} />;
      case "edit": return <EditPanel p={p} upd={upd} />;
      case "transform": return <><TransformInspector p={p} upd={upd} /><ChromaInspector p={p} upd={upd} /></>;
      case "color": return <ColorInspector p={p} upd={upd} />;
      case "effects": return <><EffectsTab p={p} upd={upd} /><FxInspector p={p} upd={upd} /></>;
      default: return <EnhanceTab p={p} upd={upd} />;
    }
  })();

  return (
    <div className="resolve">
      {/* top bar: title + page tabs */}
      <header className="rv-top">
        <div className="rv-title">
          <Button kind="ghost" icon="prev" small onClick={() => go("gallery")} />
          {p.builtin ? <h2>{p.name}</h2> : <LazyInput value={p.name} onCommit={(v) => upd((x) => { x.name = v.trim() || "Untitled"; })} />}
          <button className={`fav inline ${p.favorite ? "on" : ""}`} onClick={() => toggleFavorite(p.id)} title="Favorite"><Icon name="star" size={16} filled={p.favorite} /></button>
          {!p.builtin && (
            <select className="select slim" value={p.category} onChange={(e) => upd((x) => { x.category = e.target.value as Category; })}>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          )}
        </div>
        <div className="rv-pages">
          {PAGES.map((pg) => (
            <button key={pg.id} className={page === pg.id ? "active" : ""} onClick={() => setPage(pg.id)}>
              <Icon name={pg.icon} size={15} /> {pg.label}
            </button>
          ))}
        </div>
        <select className="rv-jump select slim" value={p.id} onChange={(e) => useStore.getState().select(e.target.value)} title="Switch wallpaper">
          {config.presets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </header>

      {/* main: viewer + inspector */}
      <div className="rv-body">
        <section className="rv-viewer">
          <div className="rv-stage">
            <Preview preset={p} />
          </div>
          <div className="rv-under">
            <div className="rv-actions">
              <Button kind="primary" icon="check" onClick={() => applyPreset(p.id)}>{onDesktop ? "On your desktop" : "Set as wallpaper"}</Button>
              {config.display.layout === "independent" && monitors.length > 1 && (
                <select className="select slim" value="" onChange={(e) => e.target.value && applyPreset(p.id, e.target.value)}>
                  <option value="">Apply to one display…</option>
                  {monitors.map((m, i) => <option key={m.id} value={m.id}>Display {i + 1}{m.primary ? " (main)" : ""}</option>)}
                </select>
              )}
              <span className="spacer" />
              <Button small icon="camera" onClick={() => save("screenshot")} title="Save a screenshot">Shot</Button>
              <Button small icon="monitor" onClick={() => save("wallpaper")} title="Set as the static Windows wallpaper">Set static</Button>
              <Button small icon="download" onClick={exportPreset} title="Export .aquawall">Export</Button>
              <Button small icon="copy" onClick={() => duplicate(p.id)} title="Duplicate">Copy</Button>
              <Button small icon="reset" onClick={() => resetPreset(p.id)} title="Reset to defaults">Reset</Button>
              {!p.builtin && <Button small kind="danger" icon="trash" onClick={() => remove(p.id)} title="Delete" />}
              <button className={`rv-scopes-btn ${showScopes ? "on" : ""}`} onClick={() => setShowScopes((s) => !s)} title="Toggle scope">⌗</button>
            </div>
            {showScopes && <Scope preset={p} />}
          </div>
        </section>
        <aside className="rv-inspector">
          <div className="rv-inspector-head"><Icon name={PAGES.find((x) => x.id === page)!.icon} size={15} /> {PAGES.find((x) => x.id === page)!.label}</div>
          <div className="rv-inspector-body">{inspector}</div>
        </aside>
      </div>
    </div>
  );
}

/** A lightweight luminance "waveform-ish" readout under the viewer. */
function Scope({ preset }: { preset: Preset }) {
  return (
    <div className="rv-scope">
      <div className="rv-scope-grad" />
      <span className="rv-scope-label">Preview reference · {preset.kind}</span>
    </div>
  );
}
