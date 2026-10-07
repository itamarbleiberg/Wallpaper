import type { ReactNode } from "react";
import type { Preset, WaterSettings, VideoSettings, FilterSettings, EffectsSettings, TransformSettings } from "@shared/types";
import { DEFAULT_FILTERS, DEFAULT_GRADE, DEFAULT_TRANSFORM, LUTS } from "@shared/types";
import { SHADER_LIBRARY } from "@engine/shaderLibrary";
import { Color, Row, Seg, Select, Slider, Toggle, pct, times } from "./ui";

export type Upd = (fn: (p: Preset) => void) => void;

export function PanelFor({ p, upd }: { p: Preset; upd: Upd }) {
  if (p.kind === "water") return <WaterPanel w={p.water} p={p} upd={upd} />;
  if (p.kind === "video") return <VideoPanel v={p.video} pp={p} upd={upd} />;
  if (p.kind === "image") return <ImagePanel p={p} upd={upd} />;
  return <ShaderPanel p={p} upd={upd} />;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div className="w-group"><h4>{title}</h4>{children}</div>;
}

function WaterPanel({ w, p, upd }: { w: WaterSettings; p: Preset; upd: Upd }) {
  const set = <K extends keyof WaterSettings>(k: K, v: WaterSettings[K]) => upd((x) => { x.water[k] = v; });
  return (
    <>
      <Group title="Interaction">
        <Slider label="Mouse sensitivity" value={w.mouseSensitivity} min={0} max={3} onChange={(v) => set("mouseSensitivity", v)} format={times} />
        <Slider label="Ripple size" value={w.rippleSize} min={0.2} max={3} onChange={(v) => set("rippleSize", v)} format={times} />
        <Row label="Click effect"><Seg value={w.clickEffect} onChange={(v) => set("clickEffect", v)} options={[{ value: "splash", label: "Splash" }, { value: "ring", label: "Shockwave" }, { value: "bubbles", label: "Bubbles" }]} /></Row>
        <Slider label="Wave height" value={w.waveIntensity} min={0} max={3} onChange={(v) => set("waveIntensity", v)} format={times} />
        <Slider label="Wave speed" value={w.waveSpeed} min={0.2} max={3} onChange={(v) => set("waveSpeed", v)} format={times} />
        <Slider label="Rain drops" value={w.ambientDrops} min={0} max={12} step={0.1} onChange={(v) => set("ambientDrops", v)} format={(v) => `${v.toFixed(1)}/s`} />
      </Group>
      <Group title="Water & light">
        <Slider label="Clarity" value={w.clarity} min={0} max={1} onChange={(v) => set("clarity", v)} format={pct} />
        <Slider label="Depth" value={w.lightingDepth} min={0} max={1} onChange={(v) => set("lightingDepth", v)} format={pct} />
        <Slider label="Caustics" value={w.caustics} min={0} max={2} onChange={(v) => set("caustics", v)} format={times} />
        <Slider label="Sun glints" value={w.specular} min={0} max={2} onChange={(v) => set("specular", v)} format={times} />
        <Slider label="Underwater lights" value={w.poolLights} min={0} max={2} onChange={(v) => set("poolLights", v)} format={times} />
        <Color label="Water tint" value={w.waterColor} onChange={(v) => set("waterColor", v)} />
        <Color label="Deep color" value={w.deepColor} onChange={(v) => set("deepColor", v)} />
      </Group>
      <Group title="Floor & life">
        <Row label="Floor"><Seg value={w.floorStyle} onChange={(v) => set("floorStyle", v)} options={[{ value: "tiles", label: "Tiles" }, { value: "mosaic", label: "Mosaic" }, { value: "pebbles", label: "Pebbles" }, { value: "sand", label: "Sand" }, { value: "plain", label: "Plain" }]} /></Row>
        <Slider label="Density" value={w.tileScale} min={3} max={40} step={1} onChange={(v) => set("tileScale", v)} />
        <Color label="Floor color" value={w.tileColor} onChange={(v) => set("tileColor", v)} />
        <Slider label="Koi fish" value={w.koi} min={0} max={8} step={1} onChange={(v) => set("koi", v)} />
        <Slider label="Lily pads" value={w.lilyPads} min={0} max={12} step={1} onChange={(v) => set("lilyPads", v)} />
      </Group>
      <EffectsGroup p={p} upd={upd} />
      <StylizeGroup p={p} upd={upd} />
      <ColorGroup p={p} upd={upd} />
      <TransformGroup p={p} upd={upd} />
      <EnhanceGroup p={p} upd={upd} />
    </>
  );
}

function VideoPanel({ v, pp, upd }: { v: VideoSettings; pp: Preset; upd: Upd }) {
  const set = <K extends keyof VideoSettings>(k: K, val: VideoSettings[K]) => upd((x) => { x.video[k] = val; });
  return (
    <>
      <Group title="Playback">
        <Row label="Loop"><Seg value={v.loopMode} onChange={(m) => set("loopMode", m)} options={[{ value: "loop", label: "Loop" }, { value: "pingpong", label: "Ping-pong" }, { value: "crossfade", label: "Crossfade" }]} /></Row>
        <Slider label="Speed" value={v.speed} min={0.25} max={4} step={0.05} onChange={(x) => set("speed", x)} format={times} />
        <Toggle label="Frame blending" value={v.frameBlend} onChange={(x) => set("frameBlend", x)} />
        <Select label="Fit" value={v.fit} onChange={(x) => set("fit", x)} options={[{ value: "cover", label: "Fill" }, { value: "contain", label: "Fit" }, { value: "stretch", label: "Stretch" }]} />
        <Slider label="Opacity" value={v.opacity} min={0} max={1} onChange={(x) => set("opacity", x)} format={pct} />
        <Toggle label="Mute" value={v.muted} onChange={(x) => set("muted", x)} />
        {!v.muted && <Slider label="Volume" value={v.volume} min={0} max={1} onChange={(x) => set("volume", x)} format={pct} />}
      </Group>
      <StylizeGroup p={pp} upd={upd} />
      <ColorGroup p={pp} upd={upd} />
      <TransformGroup p={pp} upd={upd} />
      <EnhanceGroup p={pp} upd={upd} />
    </>
  );
}

function ImagePanel({ p, upd }: { p: Preset; upd: Upd }) {
  const i = p.image;
  return (
    <>
      <Group title="Image">
        <Select label="Fit" value={i.fit} onChange={(v) => upd((x) => { x.image.fit = v; })} options={[{ value: "cover", label: "Fill" }, { value: "contain", label: "Fit" }, { value: "stretch", label: "Stretch" }]} />
        <Slider label="Ken Burns motion" value={i.kenBurns} min={0} max={1} onChange={(v) => upd((x) => { x.image.kenBurns = v; })} format={pct} />
      </Group>
      <EffectsGroup p={p} upd={upd} />
      <StylizeGroup p={p} upd={upd} />
      <ColorGroup p={p} upd={upd} />
      <TransformGroup p={p} upd={upd} />
      <EnhanceGroup p={p} upd={upd} />
    </>
  );
}

function ShaderPanel({ p, upd }: { p: Preset; upd: Upd }) {
  const s = p.shader;
  return (
    <>
      <Group title="Shader">
        <Select label="Scene" value={s.builtinId || "custom"} onChange={(id) => upd((x) => { const b = SHADER_LIBRARY.find((y) => y.id === id); if (b) { x.shader.builtinId = b.id; x.shader.code = b.code; } })} options={[{ value: "custom", label: "— Custom —" }, ...SHADER_LIBRARY.map((b) => ({ value: b.id, label: b.name }))]} />
        <Slider label="Speed" value={s.speed} min={0} max={3} onChange={(v) => upd((x) => { x.shader.speed = v; })} format={times} />
        <Toggle label="Follow mouse" value={s.mouse} onChange={(v) => upd((x) => { x.shader.mouse = v; })} />
      </Group>
      <EffectsGroup p={p} upd={upd} />
      <StylizeGroup p={p} upd={upd} />
      <ColorGroup p={p} upd={upd} />
      <TransformGroup p={p} upd={upd} />
      <EnhanceGroup p={p} upd={upd} />
    </>
  );
}

function EffectsGroup({ p, upd }: { p: Preset; upd: Upd }) {
  const e = p.effects;
  const setR = <K extends keyof EffectsSettings["ripples"]>(k: K, v: EffectsSettings["ripples"][K]) => upd((x) => { x.effects.ripples[k] = v; });
  const setT = <K extends keyof EffectsSettings["trail"]>(k: K, v: EffectsSettings["trail"][K]) => upd((x) => { x.effects.trail[k] = v; });
  return (
    <Group title="Effects">
      {p.kind !== "water" && (
        <>
          <Toggle label="Water ripples" value={e.ripples.enabled} onChange={(v) => setR("enabled", v)} hint="Make any wallpaper react like water" />
          {e.ripples.enabled && <Slider label="Ripple strength" value={e.ripples.strength} min={0} max={3} onChange={(v) => setR("strength", v)} format={times} />}
        </>
      )}
      <Toggle label="Cursor trail" value={e.trail.enabled} onChange={(v) => setT("enabled", v)} />
      {e.trail.enabled && (
        <>
          <Row label="Trail style"><Seg value={e.trail.style} onChange={(v) => setT("style", v)} options={[{ value: "particles", label: "Sparks" }, { value: "light", label: "Light" }, { value: "both", label: "Both" }]} /></Row>
          <Toggle label="Rainbow" value={e.trail.rainbow} onChange={(v) => setT("rainbow", v)} />
          {!e.trail.rainbow && <Color label="Trail color" value={e.trail.color} onChange={(v) => setT("color", v)} />}
        </>
      )}
      <Slider label="Mouse parallax" value={e.parallax} min={0} max={1} onChange={(v) => upd((x) => { x.effects.parallax = v; })} format={pct} />
    </Group>
  );
}

function EnhanceGroup({ p, upd }: { p: Preset; upd: Upd }) {
  const f = p.filters;
  const set = <K extends keyof FilterSettings>(k: K, v: FilterSettings[K]) => upd((x) => { x.filters[k] = v; });
  return (
    <Group title="Enhance">
      <Slider label="Sharpen" value={f.sharpen} min={0} max={1} onChange={(v) => set("sharpen", v)} format={pct} />
      <Slider label="Brightness" value={f.brightness} min={0.3} max={1.6} onChange={(v) => set("brightness", v)} format={times} />
      <Slider label="Contrast" value={f.contrast} min={0.5} max={1.6} onChange={(v) => set("contrast", v)} format={times} />
      <Slider label="Saturation" value={f.saturation} min={0} max={2} onChange={(v) => set("saturation", v)} format={times} />
      <Slider label="Vignette" value={f.vignette} min={0} max={1} onChange={(v) => set("vignette", v)} format={pct} />
      <button className="w-reset" onClick={() => upd((x) => { x.filters = { ...DEFAULT_FILTERS }; })}>Reset color</button>
    </Group>
  );
}

function ColorGroup({ p, upd }: { p: Preset; upd: Upd }) {
  const g = p.grade;
  const setW = (which: "lift" | "gamma" | "gain", ch: "r" | "g" | "b" | "master", v: number) => upd((x) => { x.grade[which][ch] = v; x.grade.enabled = true; });
  return (
    <Group title="Color grade">
      <Toggle label="Enable grade" value={g.enabled} onChange={(v) => upd((x) => { x.grade.enabled = v; })} />
      {g.enabled && (
        <>
          <Select label="Creative LUT" value={g.lut} onChange={(v) => upd((x) => { x.grade.lut = v; })} options={LUTS.map((l) => ({ value: l.id, label: l.name }))} />
          {g.lut && <Slider label="LUT amount" value={g.lutAmount} min={0} max={1} onChange={(v) => upd((x) => { x.grade.lutAmount = v; })} format={pct} />}
          <Slider label="Shadows (lift)" value={g.lift.master} min={-0.5} max={0.5} onChange={(v) => setW("lift", "master", v)} />
          <Slider label="Mids (gamma)" value={g.gamma.master} min={-0.5} max={0.5} onChange={(v) => setW("gamma", "master", v)} />
          <Slider label="Highlights (gain)" value={g.gain.master} min={-0.5} max={0.5} onChange={(v) => setW("gain", "master", v)} />
          <Slider label="Warm / cool" value={g.gain.b} min={-0.4} max={0.4} onChange={(v) => { setW("gain", "b", v); upd((x) => { x.grade.gain.r = -v * 0.6; }); }} />
          <Slider label="Hue rotate" value={g.hue} min={-180} max={180} step={1} onChange={(v) => upd((x) => { x.grade.hue = v; x.grade.enabled = true; })} format={(v) => `${v}°`} />
          <button className="w-reset" onClick={() => upd((x) => { x.grade = { ...DEFAULT_GRADE, enabled: true }; })}>Reset grade</button>
        </>
      )}
    </Group>
  );
}

function TransformGroup({ p, upd }: { p: Preset; upd: Upd }) {
  const t = p.transform;
  const set = <K extends keyof TransformSettings>(k: K, v: TransformSettings[K]) => upd((x) => { x.transform[k] = v; x.transform.enabled = true; });
  return (
    <Group title="Transform & crop">
      <Toggle label="Enable transform" value={t.enabled} onChange={(v) => upd((x) => { x.transform.enabled = v; })} />
      {t.enabled && (
        <>
          <Slider label="Zoom" value={t.zoom} min={0.2} max={4} onChange={(v) => set("zoom", v)} format={times} />
          <Slider label="Position X" value={t.posX} min={-1} max={1} onChange={(v) => set("posX", v)} />
          <Slider label="Position Y" value={t.posY} min={-1} max={1} onChange={(v) => set("posY", v)} />
          <Slider label="Rotation" value={t.rotate} min={-180} max={180} step={1} onChange={(v) => set("rotate", v)} format={(v) => `${v}°`} />
          <Toggle label="Flip horizontal" value={t.flipH} onChange={(v) => set("flipH", v)} />
          <Slider label="Crop left" value={t.cropL} min={0} max={0.9} onChange={(v) => set("cropL", v)} format={pct} />
          <Slider label="Crop right" value={t.cropR} min={0} max={0.9} onChange={(v) => set("cropR", v)} format={pct} />
          <Slider label="Feather" value={t.cropFeather} min={0} max={0.3} onChange={(v) => set("cropFeather", v)} format={pct} />
          <button className="w-reset" onClick={() => upd((x) => { x.transform = { ...DEFAULT_TRANSFORM, enabled: true }; })}>Reset transform</button>
        </>
      )}
    </Group>
  );
}

function StylizeGroup({ p, upd }: { p: Preset; upd: Upd }) {
  const e = p.effects;
  return (
    <Group title="Stylize">
      <Slider label="Bloom / glow" value={e.bloom} min={0} max={1} onChange={(v) => upd((x) => { x.effects.bloom = v; })} format={pct} />
      <Slider label="Chromatic aberration" value={e.chromatic} min={0} max={1} onChange={(v) => upd((x) => { x.effects.chromatic = v; })} format={pct} />
      <Row label="Symmetry"><Seg value={e.mirror} onChange={(v) => upd((x) => { x.effects.mirror = v; })} options={[{ value: "none", label: "None" }, { value: "x", label: "X" }, { value: "y", label: "Y" }, { value: "quad", label: "Quad" }, { value: "kaleido", label: "Kaleido" }]} /></Row>
      <Toggle label="Motion auto-pan" value={p.motion.enabled} onChange={(v) => upd((x) => { x.motion.enabled = v; })} hint="Slow looping camera move" />
    </Group>
  );
}
