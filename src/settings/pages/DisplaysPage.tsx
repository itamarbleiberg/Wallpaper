import { useState } from "react";
import { invoke } from "../../shared/ipc";
import { Button, Card, Note, Segmented } from "../controls";
import { Icon } from "../icons";
import { useStore } from "../store";
import { Thumb } from "./GalleryPage";

const MODE_LABEL: Record<string, string> = {
  "workerw": "Behind icons (WorkerW)",
  "progman-24h2": "Behind icons (Windows 11 24H2+)",
  "progman": "Behind icons (Progman)",
  "fallback": "Fallback: bottom window (may cover icons)",
  "browser": "Browser preview",
};

export function DisplaysPage() {
  const { config, monitors, targets, playback, update, applyPreset, notify } = useStore();
  const [diag, setDiag] = useState<string[] | null>(null);
  if (!config) return null;
  const layout = config.display.layout;

  const minX = Math.min(...monitors.map((m) => m.rect.x), 0);
  const minY = Math.min(...monitors.map((m) => m.rect.y), 0);
  const maxX = Math.max(...monitors.map((m) => m.rect.x + m.rect.w), 1);
  const maxY = Math.max(...monitors.map((m) => m.rect.y + m.rect.h), 1);
  const W = maxX - minX, H = maxY - minY;

  const presetIdFor = (key?: string) => (key && config.display.assignments[key]) || config.display.defaultPresetId;
  const targetFor = (monitorId: string) => targets.find((t) => t.monitors.some((m) => m.id === monitorId));

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Displays</h1><p>{monitors.length} display{monitors.length === 1 ? "" : "s"} detected. Choose how wallpapers spread across them.</p></div>
        <Button icon="reset" onClick={async () => { await invoke("reattach"); notify("Re-attached to the desktop"); }}>Re-attach now</Button>
      </header>

      <Card title="Layout" icon="displays">
        <Segmented value={layout} onChange={(v) => update((c) => { c.display.layout = v; }, { immediate: true })} options={[
          { value: "independent", label: "Different on each display" },
          { value: "clone", label: "Same on every display" },
          { value: "span", label: "One image across all" },
        ]} />
        <div className="monitor-map" style={{ aspectRatio: `${W} / ${H}` }}>
          {monitors.map((m, i) => {
            const t = targetFor(m.id);
            const pb = t ? playback[t.label] : undefined;
            const pid = layout === "independent" ? presetIdFor(m.id) : layout === "span" ? presetIdFor("span") : config.display.defaultPresetId;
            const preset = config.presets.find((p) => p.id === pid) ?? config.presets[0];
            return (
              <div key={m.id} className={`monitor ${m.primary ? "primary" : ""}`} style={{ left: `${((m.rect.x - minX) / W) * 100}%`, top: `${((m.rect.y - minY) / H) * 100}%`, width: `${(m.rect.w / W) * 100}%`, height: `${(m.rect.h / H) * 100}%` }}>
                <div className="monitor-bg"><Thumb preset={preset} /></div>
                <div className="monitor-info">
                  <b>{i + 1}{m.primary ? " · Main" : ""}</b>
                  <span>{m.rect.w}×{m.rect.h} · {Math.round(m.scale * 100)}%</span>
                  {layout === "independent" && (
                    <select className="select slim" value={pid} onChange={(e) => applyPreset(e.target.value, m.id)}>
                      {config.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  {pb?.paused && <span className="state-pill"><Icon name="pause" size={11} /> {pb.reason || "paused"}</span>}
                  {!pb?.paused && pb?.reason && <span className="state-pill">{pb.reason}</span>}
                </div>
              </div>
            );
          })}
        </div>
        {layout !== "independent" && (
          <div className="inline-row">
            <span className="muted">Wallpaper:</span>
            <select className="select" value={presetIdFor(layout === "span" ? "span" : undefined)} onChange={(e) => applyPreset(e.target.value, layout === "span" ? "span" : undefined)}>
              {config.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </Card>

      <Card title="Desktop integration" icon="monitor" subtitle="How each wallpaper window is attached behind your icons" right={<Button small onClick={async () => setDiag(await invoke<string[]>("diagnostics"))}>Run diagnostics</Button>}>
        {targets.map((t) => (
          <div key={t.label} className="status-row">
            <span className={`dot ${t.attachMode === "fallback" ? "warn" : "on"}`} />
            <b>{t.monitors.map((m) => `Display ${monitors.findIndex((x) => x.id === m.id) + 1}`).join(" + ")}</b>
            <span className="muted">{MODE_LABEL[t.attachMode] ?? t.attachMode}</span>
            <span className="spacer" />
            <span className="mono tiny">{t.rect.w}×{t.rect.h} at {t.rect.x},{t.rect.y}</span>
          </div>
        ))}
        {targets.some((t) => t.attachMode === "fallback") && <Note kind="warn">One display is in fallback mode. Click <b>Re-attach now</b>. If that doesn't help, restart Explorer from Task Manager.</Note>}
        {diag && <pre className="diag">{diag.join("\n")}</pre>}
      </Card>
    </div>
  );
}
