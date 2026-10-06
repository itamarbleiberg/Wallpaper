import { DEFAULT_WATER } from "../../shared/types";
import type { WaterSettings } from "../../shared/types";
import { Color, Section, Segmented, Slider, pct, times } from "../controls";
import { useStore } from "../store";

export function WaterPanel() {
  const { selected, updatePreset } = useStore();
  const p = selected();
  if (!p) return null;
  if (p.kind !== "water") return <Section title="Water"><p className="dim">Select an interactive water wallpaper (e.g. “Interactive Pool”) in the Library to edit it. For ripples on videos and shaders, use the Effects tab.</p></Section>;
  const w = p.water;
  const set = <K extends keyof WaterSettings>(k: K, v: WaterSettings[K]) => updatePreset((x) => { x.water[k] = v; });

  return (
    <>
      <Section title="Interaction" right={<button className="btn ghost small" onClick={() => updatePreset((x) => { x.water = { ...DEFAULT_WATER }; })}>Reset to defaults</button>}>
        <Slider label="Mouse sensitivity" value={w.mouseSensitivity} min={0} max={3} onChange={(v) => set("mouseSensitivity", v)} format={times} hint="How strongly cursor movement disturbs the water" />
        <Slider label="Ripple size" value={w.rippleSize} min={0.2} max={3} onChange={(v) => set("rippleSize", v)} format={times} />
        <Slider label="Wave intensity" value={w.waveIntensity} min={0} max={3} onChange={(v) => set("waveIntensity", v)} format={times} hint="Visual height/steepness of waves" />
        <Slider label="Wave / ripple speed" value={w.waveSpeed} min={0.2} max={3} onChange={(v) => set("waveSpeed", v)} format={times} />
        <Slider label="Ripple persistence" value={w.persistence} min={0} max={1} onChange={(v) => set("persistence", v)} format={pct} hint="How long ripples keep travelling before calming down" />
        <Slider label="Ambient rain drops" value={w.ambientDrops} min={0} max={5} step={0.1} onChange={(v) => set("ambientDrops", v)} format={(v) => `${v.toFixed(1)}/s`} />
      </Section>
      <Section title="Light & optics">
        <Slider label="Water clarity" value={w.clarity} min={0} max={1} onChange={(v) => set("clarity", v)} format={pct} />
        <Slider label="Refraction" value={w.refraction} min={0} max={2} onChange={(v) => set("refraction", v)} format={times} />
        <Slider label="Light caustics" value={w.caustics} min={0} max={2} onChange={(v) => set("caustics", v)} format={times} />
        <Slider label="Lighting depth" value={w.lightingDepth} min={0} max={1} onChange={(v) => set("lightingDepth", v)} format={pct} hint="Pool depth: deeper = stronger refraction, more absorption" />
        <Slider label="Sun glints" value={w.specular} min={0} max={2} onChange={(v) => set("specular", v)} format={times} />
        <Slider label="Sky reflection" value={w.reflection} min={0} max={1} onChange={(v) => set("reflection", v)} format={pct} />
        <Slider label="Wall shadow" value={w.edgeShadow} min={0} max={1} onChange={(v) => set("edgeShadow", v)} format={pct} />
      </Section>
      <Section title="Pool floor & colors">
        <div className="row"><span className="row-label">Floor</span>
          <Segmented value={w.floorStyle} onChange={(v) => set("floorStyle", v)} options={[{ value: "tiles", label: "Tiles" }, { value: "sand", label: "Sand" }, { value: "plain", label: "Plain" }]} />
        </div>
        <Slider label="Tile density" value={w.tileScale} min={3} max={30} step={1} onChange={(v) => set("tileScale", v)} />
        <Color label="Water tint" value={w.waterColor} onChange={(v) => set("waterColor", v)} />
        <Color label="Deep color" value={w.deepColor} onChange={(v) => set("deepColor", v)} />
        <Color label="Tile / sand" value={w.tileColor} onChange={(v) => set("tileColor", v)} />
        <Color label="Grout / detail" value={w.groutColor} onChange={(v) => set("groutColor", v)} />
      </Section>
      <Section title="Quality">
        <Slider label="Simulation resolution" value={w.simResolution} min={0.15} max={0.6} onChange={(v) => set("simResolution", v)} format={pct} hint="Higher = finer ripples, more GPU" />
        <Slider label="Render scale" value={p.renderScale} min={0.5} max={1} onChange={(v) => updatePreset((x) => { x.renderScale = v; })} format={pct} />
        <Slider label="FPS cap" value={p.fpsCap} min={24} max={144} step={1} onChange={(v) => updatePreset((x) => { x.fpsCap = v; })} />
      </Section>
    </>
  );
}
