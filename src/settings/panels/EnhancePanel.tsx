import { DEFAULT_FILTERS } from "../../shared/types";
import type { FilterSettings } from "../../shared/types";
import { Section, Slider, pct, times } from "../controls";
import { useStore } from "../store";

const LOOKS: { name: string; f: Partial<FilterSettings> }[] = [
  { name: "None", f: {} },
  { name: "Crisp 4K", f: { sharpen: 0.7, contrast: 1.05, vibrance: 0.15 } },
  { name: "Vivid", f: { saturation: 1.25, vibrance: 0.3, contrast: 1.1 } },
  { name: "Cinematic", f: { contrast: 1.12, saturation: 0.9, temperature: 0.2, vignette: 0.45, grain: 0.25 } },
  { name: "Dreamy", f: { blur: 0.25, brightness: 1.05, saturation: 1.1, vignette: 0.3 } },
  { name: "Dim (focus)", f: { brightness: 0.65, saturation: 0.85, blur: 0.4, vignette: 0.5 } },
];

export function EnhancePanel() {
  const { selected, updatePreset } = useStore();
  const p = selected();
  if (!p) return null;
  const f = p.filters;
  const set = <K extends keyof FilterSettings>(k: K, v: FilterSettings[K]) => updatePreset((x) => { x.filters[k] = v; });

  return (
    <>
      <Section title="Looks">
        <div className="chips">
          {LOOKS.map((l) => (
            <button key={l.name} className="chip" onClick={() => updatePreset((x) => { x.filters = { ...DEFAULT_FILTERS, ...l.f }; })}>{l.name}</button>
          ))}
        </div>
      </Section>
      <Section title="Detail (real-time 4K pipeline)">
        <Slider label="Sharpen (CAS)" value={f.sharpen} min={0} max={1} onChange={(v) => set("sharpen", v)} format={pct} hint="Contrast-adaptive sharpening - restores detail on upscaled video" />
        <Slider label="Render scale" value={p.renderScale} min={0.5} max={1} onChange={(v) => updatePreset((x) => { x.renderScale = v; })} format={pct} hint="Below 100% renders fewer pixels and upscales - big GPU savings at 4K" />
        <Slider label="FPS cap" value={p.fpsCap} min={24} max={144} step={1} onChange={(v) => updatePreset((x) => { x.fpsCap = v; })} />
      </Section>
      <Section title="Color" right={<button className="btn ghost small" onClick={() => updatePreset((x) => { x.filters = { ...DEFAULT_FILTERS }; })}>Reset</button>}>
        <Slider label="Brightness" value={f.brightness} min={0.3} max={1.6} onChange={(v) => set("brightness", v)} format={times} />
        <Slider label="Contrast" value={f.contrast} min={0.5} max={1.6} onChange={(v) => set("contrast", v)} format={times} />
        <Slider label="Saturation" value={f.saturation} min={0} max={2} onChange={(v) => set("saturation", v)} format={times} />
        <Slider label="Vibrance" value={f.vibrance} min={-1} max={1} onChange={(v) => set("vibrance", v)} />
        <Slider label="Gamma" value={f.gamma} min={0.5} max={2} onChange={(v) => set("gamma", v)} />
        <Slider label="Temperature" value={f.temperature} min={-1} max={1} onChange={(v) => set("temperature", v)} format={(v) => (v > 0 ? `warm ${v.toFixed(2)}` : v < 0 ? `cool ${(-v).toFixed(2)}` : "neutral")} />
      </Section>
      <Section title="Overlays">
        <Slider label="Blur" value={f.blur} min={0} max={1} onChange={(v) => set("blur", v)} format={pct} />
        <Slider label="Vignette" value={f.vignette} min={0} max={1} onChange={(v) => set("vignette", v)} format={pct} />
        <Slider label="Vignette softness" value={f.vignetteSoftness} min={0.05} max={1} onChange={(v) => set("vignetteSoftness", v)} format={pct} />
        <Slider label="Film grain" value={f.grain} min={0} max={1} onChange={(v) => set("grain", v)} format={pct} />
      </Section>
    </>
  );
}
