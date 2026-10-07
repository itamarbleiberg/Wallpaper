import type { ChromaSettings, GradeSettings, MotionSettings, Preset, TransformSettings } from "../../shared/types";
import { DEFAULT_CHROMA, DEFAULT_GRADE, DEFAULT_MOTION, DEFAULT_TRANSFORM, LUTS } from "../../shared/types";
import { Button, Card, Color, Field, Note, Segmented, Select, Slider, Toggle, pct, times } from "../controls";
import { ColorWheel } from "./ColorWheel";

type Upd = (fn: (p: Preset) => void) => void;

export function ColorInspector({ p, upd }: { p: Preset; upd: Upd }) {
  const g = p.grade;
  const set = <K extends keyof GradeSettings>(k: K, v: GradeSettings[K]) => upd((x) => { x.grade[k] = v; });
  return (
    <>
      <Card title="Color grade" icon="sparkle" subtitle="Primary wheels, like DaVinci Resolve" right={<Toggle label="" value={g.enabled} onChange={(v) => set("enabled", v)} />}>
        {g.enabled && (
          <>
            <div className="wheels">
              <ColorWheel label="Lift" value={g.lift} onChange={(w) => set("lift", w)} />
              <ColorWheel label="Gamma" value={g.gamma} onChange={(w) => set("gamma", w)} />
              <ColorWheel label="Gain" value={g.gain} onChange={(w) => set("gain", w)} />
              <ColorWheel label="Offset" value={g.offset} onChange={(w) => set("offset", w)} />
            </div>
            <Slider label="Hue rotate" value={g.hue} min={-180} max={180} step={1} onChange={(v) => set("hue", v)} format={(v) => `${v}°`} />
            <Slider label="Tint" value={g.tint} min={-1} max={1} onChange={(v) => set("tint", v)} format={(v) => (v > 0 ? `magenta ${v.toFixed(2)}` : v < 0 ? `green ${(-v).toFixed(2)}` : "0")} />
            <Slider label="Highlights" value={g.highlights} min={-1} max={1} onChange={(v) => set("highlights", v)} />
            <Slider label="Shadows" value={g.shadows} min={-1} max={1} onChange={(v) => set("shadows", v)} />
            <Button small kind="ghost" icon="reset" onClick={() => upd((x) => { x.grade = { ...DEFAULT_GRADE, enabled: true }; })}>Reset wheels</Button>
          </>
        )}
      </Card>
      <Card title="Creative LUT" icon="image">
        <Select label="LUT" value={g.lut} onChange={(v) => upd((x) => { x.grade.lut = v; x.grade.enabled = true; })} options={LUTS.map((l) => ({ value: l.id, label: l.name }))} />
        {g.lut && <Slider label="Amount" value={g.lutAmount} min={0} max={1} onChange={(v) => set("lutAmount", v)} format={pct} />}
        <div className="lut-strip">
          {LUTS.filter((l) => l.id).map((l) => (
            <button key={l.id} className={`lut-chip ${g.lut === l.id ? "on" : ""}`} onClick={() => upd((x) => { x.grade.lut = l.id; x.grade.enabled = true; })}>{l.name}</button>
          ))}
        </div>
      </Card>
    </>
  );
}

export function TransformInspector({ p, upd }: { p: Preset; upd: Upd }) {
  const t = p.transform;
  const set = <K extends keyof TransformSettings>(k: K, v: TransformSettings[K]) => upd((x) => { x.transform[k] = v; });
  return (
    <>
      <Card title="Transform" icon="monitor" subtitle="Zoom, pan, rotate — reframe any wallpaper" right={<Toggle label="" value={t.enabled} onChange={(v) => set("enabled", v)} />}>
        {t.enabled && (
          <>
            <Slider label="Zoom" value={t.zoom} min={0.2} max={4} onChange={(v) => set("zoom", v)} format={times} />
            <Slider label="Position X" value={t.posX} min={-1} max={1} onChange={(v) => set("posX", v)} />
            <Slider label="Position Y" value={t.posY} min={-1} max={1} onChange={(v) => set("posY", v)} />
            <Slider label="Rotation" value={t.rotate} min={-180} max={180} step={1} onChange={(v) => set("rotate", v)} format={(v) => `${v}°`} />
            <Toggle label="Flip horizontal" value={t.flipH} onChange={(v) => set("flipH", v)} />
            <Toggle label="Flip vertical" value={t.flipV} onChange={(v) => set("flipV", v)} />
          </>
        )}
      </Card>
      <Card title="Crop" icon="scissors" subtitle="Trim edges with a soft feather">
        <Slider label="Left" value={t.cropL} min={0} max={0.9} onChange={(v) => set("cropL", v)} format={pct} />
        <Slider label="Right" value={t.cropR} min={0} max={0.9} onChange={(v) => set("cropR", v)} format={pct} />
        <Slider label="Top" value={t.cropT} min={0} max={0.9} onChange={(v) => set("cropT", v)} format={pct} />
        <Slider label="Bottom" value={t.cropB} min={0} max={0.9} onChange={(v) => set("cropB", v)} format={pct} />
        <Slider label="Feather" value={t.cropFeather} min={0} max={0.3} onChange={(v) => set("cropFeather", v)} format={pct} />
        {(t.cropL || t.cropR || t.cropT || t.cropB) ? <Button small kind="ghost" icon="reset" onClick={() => upd((x) => { Object.assign(x.transform, { cropL: 0, cropR: 0, cropT: 0, cropB: 0 }); })}>Clear crop</Button> : null}
      </Card>
    </>
  );
}

export function ChromaInspector({ p, upd }: { p: Preset; upd: Upd }) {
  const c = p.chroma;
  const set = <K extends keyof ChromaSettings>(k: K, v: ChromaSettings[K]) => upd((x) => { x.chroma[k] = v; });
  return (
    <Card title="Chroma key" icon="code" subtitle="Remove a green/blue screen and replace the background" right={<Toggle label="" value={c.enabled} onChange={(v) => set("enabled", v)} />}>
      {c.enabled ? (
        <>
          <Color label="Key color" value={c.color} onChange={(v) => set("color", v)} />
          <div className="chips compact">{["#00ff00", "#00e000", "#0066ff", "#0000ff"].map((k) => <button key={k} className="chip" style={{ background: k, color: "#000" }} onClick={() => set("color", k)}>pick</button>)}</div>
          <Slider label="Similarity" value={c.similarity} min={0} max={1} onChange={(v) => set("similarity", v)} format={pct} />
          <Slider label="Smoothness" value={c.smoothness} min={0} max={1} onChange={(v) => set("smoothness", v)} format={pct} />
          <Slider label="Spill suppression" value={c.spill} min={0} max={1} onChange={(v) => set("spill", v)} format={pct} />
          <Color label="Backdrop" value={c.backdrop} onChange={(v) => set("backdrop", v)} />
          <Button small kind="ghost" icon="reset" onClick={() => upd((x) => { x.chroma = { ...DEFAULT_CHROMA, enabled: true, color: c.color }; })}>Reset key</Button>
        </>
      ) : <p className="muted small">Best for green-screen clips you've imported. Keys out the chosen color and fills behind it.</p>}
    </Card>
  );
}

export function MotionInspector({ p, upd }: { p: Preset; upd: Upd }) {
  const m = p.motion;
  const set = <K extends keyof MotionSettings>(k: K, v: MotionSettings[K]) => upd((x) => { x.motion[k] = v; });
  return (
    <Card title="Motion keyframes" icon="automation" subtitle="A gentle cinematic auto-pan/zoom that loops" right={<Toggle label="" value={m.enabled} onChange={(v) => set("enabled", v)} />}>
      {m.enabled ? (
        <>
          <Slider label="Loop length" value={m.loop} min={4} max={120} step={1} onChange={(v) => set("loop", v)} format={(v) => `${v}s`} />
          <Select label="Easing" value={m.easing} onChange={(v) => set("easing", v)} options={[{ value: "linear", label: "Linear" }, { value: "smooth", label: "Smooth" }, { value: "bounce", label: "Bounce" }]} />
          <div className="kf-list">
            {m.keys.map((kf, i) => (
              <div className="kf-row" key={i}>
                <span className="kf-i">#{i + 1}</span>
                <label>zoom <input className="num" type="number" step="0.05" value={kf.zoom} onChange={(e) => upd((x) => { x.motion.keys[i].zoom = Number(e.target.value); })} /></label>
                <label>x <input className="num" type="number" step="0.02" value={kf.posX} onChange={(e) => upd((x) => { x.motion.keys[i].posX = Number(e.target.value); })} /></label>
                <label>y <input className="num" type="number" step="0.02" value={kf.posY} onChange={(e) => upd((x) => { x.motion.keys[i].posY = Number(e.target.value); })} /></label>
                <label>rot <input className="num" type="number" step="1" value={kf.rotate} onChange={(e) => upd((x) => { x.motion.keys[i].rotate = Number(e.target.value); })} /></label>
                {m.keys.length > 2 && <button className="kf-del" onClick={() => upd((x) => { x.motion.keys.splice(i, 1); })}>✕</button>}
              </div>
            ))}
          </div>
          <div className="row-actions">
            <Button small icon="plus" onClick={() => upd((x) => { const last = x.motion.keys[x.motion.keys.length - 1]; x.motion.keys.push({ ...last }); })}>Add keyframe</Button>
            <Button small kind="ghost" icon="reset" onClick={() => upd((x) => { x.motion = { ...DEFAULT_MOTION, enabled: true }; })}>Reset</Button>
          </div>
          <Note>Tip: keyframes drive the Transform block over time — set zoom just above 1 and small x/y for a slow drift.</Note>
        </>
      ) : <p className="muted small">Turn on for a slow, looping camera move — great for photos and static shaders.</p>}
    </Card>
  );
}

export function FxInspector({ p, upd }: { p: Preset; upd: Upd }) {
  const e = p.effects;
  return (
    <Card title="Stylize" icon="sparkle" subtitle="Glow, lens and symmetry">
      <Slider label="Bloom / glow" value={e.bloom} min={0} max={1} onChange={(v) => upd((x) => { x.effects.bloom = v; })} format={pct} hint="Soft glow on bright areas" />
      <Slider label="Chromatic aberration" value={e.chromatic} min={0} max={1} onChange={(v) => upd((x) => { x.effects.chromatic = v; })} format={pct} hint="Color fringing toward the edges, like a real lens" />
      <Field label="Symmetry">
        <Segmented value={e.mirror} onChange={(v) => upd((x) => { x.effects.mirror = v; })} options={[{ value: "none", label: "None" }, { value: "x", label: "Mirror X" }, { value: "y", label: "Mirror Y" }, { value: "quad", label: "Quad" }, { value: "kaleido", label: "Kaleido" }]} />
      </Field>
      <Slider label="Music brightness" value={e.audioBright} min={0} max={1} onChange={(v) => upd((x) => { x.effects.audioBright = v; })} format={pct} hint="Brightness pumps with the bass of whatever's playing" />
      <Button small kind="ghost" icon="reset" onClick={() => upd((x) => { x.effects.bloom = 0; x.effects.chromatic = 0; x.effects.mirror = "none"; x.effects.audioBright = 0; })}>Reset stylize</Button>
    </Card>
  );
}

export function needsTransformReset(_t: TransformSettings): boolean {
  return false;
}

export { DEFAULT_TRANSFORM };
