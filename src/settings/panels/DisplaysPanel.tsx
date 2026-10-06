import { invoke } from "../../shared/ipc";
import { Section, Segmented } from "../controls";
import { useStore } from "../store";

const MODE_LABEL: Record<string, string> = {
  "workerw": "Behind icons (WorkerW)",
  "progman-24h2": "Behind icons (Windows 11 24H2+)",
  "progman": "Behind icons (Progman)",
  "fallback": "Fallback: bottom-most window",
  "browser": "Browser preview",
};

export function DisplaysPanel() {
  const { config, monitors, targets, update, applyPreset } = useStore();
  if (!config) return null;
  const layout = config.display.layout;

  const minX = Math.min(0, ...monitors.map((m) => m.rect.x));
  const minY = Math.min(0, ...monitors.map((m) => m.rect.y));
  const maxX = Math.max(1, ...monitors.map((m) => m.rect.x + m.rect.w));
  const maxY = Math.max(1, ...monitors.map((m) => m.rect.y + m.rect.h));
  const W = maxX - minX, H = maxY - minY;

  const presetFor = (key: string) => config.display.assignments[key] ?? config.display.defaultPresetId;
  const presetSelect = (key: string | undefined) => (
    <select value={key ? presetFor(key) : config.display.defaultPresetId} onChange={(e) => applyPreset(e.target.value, key)}>
      {config.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );

  return (
    <>
      <Section title="Multi-monitor layout">
        <Segmented
          value={layout}
          onChange={(v) => update((c) => { c.display.layout = v; }, true)}
          options={[
            { value: "independent", label: "Independent per display" },
            { value: "clone", label: "Same on every display" },
            { value: "span", label: "Span across displays" },
          ]}
        />
        <div className="monitor-map" style={{ aspectRatio: `${W} / ${H}` }}>
          {monitors.map((m) => (
            <div
              key={m.id}
              className={`monitor ${m.primary ? "primary" : ""}`}
              style={{ left: `${((m.rect.x - minX) / W) * 100}%`, top: `${((m.rect.y - minY) / H) * 100}%`, width: `${(m.rect.w / W) * 100}%`, height: `${(m.rect.h / H) * 100}%` }}
            >
              <b>{m.name.replace(/^\\\\\.\\/, "")}</b>
              <span className="mono small">{m.rect.w}×{m.rect.h} @ {Math.round(m.scale * 100)}%</span>
              {layout === "independent" && presetSelect(m.id)}
              {m.primary && <span className="small dim">Primary</span>}
            </div>
          ))}
        </div>
        {layout !== "independent" && (
          <div className="row"><span className="row-label">Wallpaper</span>{presetSelect(layout === "span" ? "span" : undefined)}</div>
        )}
        <div className="dim small">Use the Fit option of a video wallpaper (Fill / Fit / Stretch) to control how it scales on each display.</div>
      </Section>
      <Section title="Desktop integration" right={<button className="btn small" onClick={() => invoke("reattach")}>Re-attach now</button>}>
        {targets.map((t) => (
          <div key={t.label} className="row">
            <span className="row-label mono">{t.label}</span>
            <span className={t.attachMode === "fallback" ? "warn-text" : "ok-text"}>{MODE_LABEL[t.attachMode] ?? t.attachMode}</span>
          </div>
        ))}
        <p className="dim small">AquaWall places its renderer between the wallpaper and your desktop icons. If Explorer restarts, it re-attaches automatically. In fallback mode the wallpaper may cover desktop icons.</p>
      </Section>
    </>
  );
}
