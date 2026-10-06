import type { EffectsSettings } from "../../shared/types";
import { Color, Section, Segmented, Slider, Toggle, pct, times } from "../controls";
import { useStore } from "../store";

export function EffectsPanel() {
  const { selected, updatePreset } = useStore();
  const p = selected();
  if (!p) return null;
  const r = p.effects.ripples;
  const t = p.effects.trail;
  const setR = <K extends keyof EffectsSettings["ripples"]>(k: K, v: EffectsSettings["ripples"][K]) => updatePreset((x) => { x.effects.ripples[k] = v; });
  const setT = <K extends keyof EffectsSettings["trail"]>(k: K, v: EffectsSettings["trail"][K]) => updatePreset((x) => { x.effects.trail[k] = v; });

  return (
    <>
      <Section title="Water ripples over this wallpaper">
        {p.kind === "water" ? (
          <p className="dim small">The pool wallpaper already reacts to your cursor. Tune it in the Water tab.</p>
        ) : (
          <>
            <Toggle label="Enable interactive ripples" value={r.enabled} onChange={(v) => setR("enabled", v)} />
            {r.enabled && (
              <>
                <Slider label="Strength" value={r.strength} min={0} max={3} onChange={(v) => setR("strength", v)} format={times} />
                <Slider label="Ripple size" value={r.size} min={0.2} max={3} onChange={(v) => setR("size", v)} format={times} />
                <Slider label="Persistence" value={r.persistence} min={0} max={1} onChange={(v) => setR("persistence", v)} format={pct} />
                <Slider label="Refraction" value={r.refraction} min={0} max={2} onChange={(v) => setR("refraction", v)} format={times} />
                <Slider label="Glints" value={r.specular} min={0} max={2} onChange={(v) => setR("specular", v)} format={times} />
              </>
            )}
          </>
        )}
      </Section>
      <Section title="Mouse trail">
        <Toggle label="Enable cursor trail" value={t.enabled} onChange={(v) => setT("enabled", v)} />
        {t.enabled && (
          <>
            <div className="row"><span className="row-label">Style</span>
              <Segmented value={t.style} onChange={(v) => setT("style", v)} options={[{ value: "particles", label: "Particles" }, { value: "light", label: "Light trail" }, { value: "both", label: "Both" }]} />
            </div>
            <Color label="Color" value={t.color} onChange={(v) => setT("color", v)} />
            <Toggle label="Rainbow" value={t.rainbow} onChange={(v) => setT("rainbow", v)} />
            <Slider label="Size" value={t.size} min={0.2} max={3} onChange={(v) => setT("size", v)} format={times} />
            <Slider label="Particle amount" value={t.amount} min={0} max={2} onChange={(v) => setT("amount", v)} format={times} />
            <Slider label="Trail length" value={t.length} min={0.1} max={2} onChange={(v) => setT("length", v)} format={(v) => `${v.toFixed(1)} s`} />
          </>
        )}
      </Section>
    </>
  );
}
