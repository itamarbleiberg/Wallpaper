import { useEffect, useState } from "react";
import { invoke, pickImageFile, pickVideoFile, videoUrlResolver } from "../../shared/ipc";
import type { EffectsSettings, FilterSettings, ImageSettings, Preset, VideoSettings, WaterSettings } from "../../shared/types";
import { DEFAULT_FILTERS } from "../../shared/types";
import { SHADER_LIBRARY } from "../../engine/shaderLibrary";
import { Button, Card, Color, Field, Note, Progress, Segmented, Select, Slider, Toggle, pct, times } from "../controls";
import { Timeline } from "../Timeline";
import { useStore } from "../store";
import { renderStill } from "../thumbs";
import { activePreview } from "../Preview";

export type Upd = (fn: (p: Preset) => void) => void;

// ------------------------------------------------------------------ water

export const PALETTES: Partial<WaterSettings>[] = [
  { waterColor: "#1b8fb3", deepColor: "#063a5c", tileColor: "#d9f1f7", groutColor: "#7fb8c9" },
  { waterColor: "#2bb5a8", deepColor: "#0b5e66", tileColor: "#f3e6c4", groutColor: "#c9b27a" },
  { waterColor: "#4b1d7a", deepColor: "#07041a", tileColor: "#3a3f6b", groutColor: "#13142b" },
  { waterColor: "#2f6f5e", deepColor: "#0e2a24", tileColor: "#8c8b74", groutColor: "#3d3a2c" },
  { waterColor: "#3fd0e0", deepColor: "#0b6d8a", tileColor: "#ffffff", groutColor: "#9ad6e6" },
  { waterColor: "#0f5fa8", deepColor: "#03142e", tileColor: "#ffd9a8", groutColor: "#b5714a" },
  { waterColor: "#d94f8a", deepColor: "#2a0820", tileColor: "#ffe3ef", groutColor: "#b26a8c" },
];

export function WaterInteraction({ w, upd }: { w: WaterSettings; upd: Upd }) {
  const set = <K extends keyof WaterSettings>(k: K, v: WaterSettings[K]) => upd((p) => { p.water[k] = v; });
  return (
    <>
      <Card title="Cursor" icon="water" subtitle="How your mouse disturbs the water">
        <Slider label="Mouse sensitivity" value={w.mouseSensitivity} min={0} max={3} onChange={(v) => set("mouseSensitivity", v)} format={times} />
        <Slider label="Ripple size" value={w.rippleSize} min={0.2} max={3} onChange={(v) => set("rippleSize", v)} format={times} />
        <Field label="Click effect" hint="What happens when you click the desktop">
          <Segmented value={w.clickEffect} onChange={(v) => set("clickEffect", v)} options={[{ value: "splash", label: "Splash" }, { value: "ring", label: "Shockwave" }, { value: "bubbles", label: "Bubbles" }]} />
        </Field>
      </Card>
      <Card title="Waves" icon="automation">
        <Slider label="Wave height" value={w.waveIntensity} min={0} max={3} onChange={(v) => set("waveIntensity", v)} format={times} hint="How steep and visible waves look" />
        <Slider label="Wave speed" value={w.waveSpeed} min={0.2} max={3} onChange={(v) => set("waveSpeed", v)} format={times} />
        <Slider label="Ripple persistence" value={w.persistence} min={0} max={1} onChange={(v) => set("persistence", v)} format={pct} hint="How long ripples keep travelling" />
        <Slider label="Rain drops" value={w.ambientDrops} min={0} max={12} step={0.1} onChange={(v) => set("ambientDrops", v)} format={(v) => `${v.toFixed(1)}/s`} hint="Random drops landing on the water" />
      </Card>
    </>
  );
}

export function WaterLight({ w, upd }: { w: WaterSettings; upd: Upd }) {
  const set = <K extends keyof WaterSettings>(k: K, v: WaterSettings[K]) => upd((p) => { p.water[k] = v; });
  return (
    <>
      <Card title="Water" icon="water">
        <Slider label="Clarity" value={w.clarity} min={0} max={1} onChange={(v) => set("clarity", v)} format={pct} />
        <Slider label="Depth" value={w.lightingDepth} min={0} max={1} onChange={(v) => set("lightingDepth", v)} format={pct} hint="Deeper water bends and absorbs more light" />
        <Slider label="Refraction" value={w.refraction} min={0} max={2} onChange={(v) => set("refraction", v)} format={times} />
        <Color label="Water tint" value={w.waterColor} onChange={(v) => set("waterColor", v)} />
        <Color label="Deep color" value={w.deepColor} onChange={(v) => set("deepColor", v)} />
      </Card>
      <Card title="Light" icon="sparkle">
        <Slider label="Caustics" value={w.caustics} min={0} max={2} onChange={(v) => set("caustics", v)} format={times} hint="Dancing light on the floor" />
        <Slider label="Sun glints" value={w.specular} min={0} max={2} onChange={(v) => set("specular", v)} format={times} />
        <Slider label="Sky reflection" value={w.reflection} min={0} max={1} onChange={(v) => set("reflection", v)} format={pct} />
        <Slider label="Wall shadow" value={w.edgeShadow} min={0} max={1} onChange={(v) => set("edgeShadow", v)} format={pct} />
        <Slider label="Underwater lights" value={w.poolLights} min={0} max={2} onChange={(v) => set("poolLights", v)} format={times} hint="Lamps along the pool walls - great at night" />
        {w.poolLights > 0 && <Color label="Light color" value={w.lightColor} onChange={(v) => set("lightColor", v)} />}
      </Card>
    </>
  );
}

export function WaterFloor({ w, upd }: { w: WaterSettings; upd: Upd }) {
  const set = <K extends keyof WaterSettings>(k: K, v: WaterSettings[K]) => upd((p) => { p.water[k] = v; });
  return (
    <>
      <Card title="Floor" icon="gallery" right={<Button small icon="shuffle" onClick={() => upd((p) => { Object.assign(p.water, PALETTES[Math.floor(Math.random() * PALETTES.length)]); })}>Random colors</Button>}>
        <Field label="Style">
          <Segmented value={w.floorStyle} onChange={(v) => set("floorStyle", v)} options={[{ value: "tiles", label: "Tiles" }, { value: "mosaic", label: "Mosaic" }, { value: "pebbles", label: "Pebbles" }, { value: "sand", label: "Sand" }, { value: "plain", label: "Plain" }]} />
        </Field>
        <Slider label={w.floorStyle === "pebbles" ? "Stone density" : "Tile density"} value={w.tileScale} min={3} max={40} step={1} onChange={(v) => set("tileScale", v)} />
        <Color label={w.floorStyle === "pebbles" ? "Stone color" : w.floorStyle === "sand" ? "Sand color" : "Tile color"} value={w.tileColor} onChange={(v) => set("tileColor", v)} />
        <Color label="Grout / detail" value={w.groutColor} onChange={(v) => set("groutColor", v)} />
      </Card>
      <Card title="Pond life" icon="sparkle" subtitle="Koi swim away from your cursor, and lily pads drift when you push them">
        <Slider label="Koi fish" value={w.koi} min={0} max={8} step={1} onChange={(v) => set("koi", v)} />
        {w.koi > 0 && <Slider label="Koi speed" value={w.koiSpeed} min={0.2} max={3} onChange={(v) => set("koiSpeed", v)} format={times} />}
        <Slider label="Lily pads" value={w.lilyPads} min={0} max={12} step={1} onChange={(v) => set("lilyPads", v)} />
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ video

export function VideoClip({ p, upd }: { p: Preset; upd: Upd }) {
  const [resolve, setResolve] = useState<((s: string) => string) | null>(null);
  const { previewError, update, notify } = useStore();
  useEffect(() => { videoUrlResolver().then((r) => setResolve(() => r)); }, []);
  const v = p.video;
  const changeFile = async () => {
    const f = await pickVideoFile();
    if (!f) return;
    await update((c) => {
      const pr = c.presets.find((x) => x.id === p.id)!;
      Object.assign(pr.video, { path: f, inPoint: 0, outPoint: null });
      if (!c.library.some((l) => l.path === f)) c.library.push({ id: `m-${Date.now()}`, name: f.split(/[\\/]/).pop() ?? f, path: f, source: "file", addedAt: Date.now() });
    }, { immediate: true });
    notify("Video replaced");
  };
  return (
    <>
      <Card title="Source" icon="video" right={<Button small icon="folder" onClick={changeFile}>Replace video…</Button>}>
        <div className="path-line mono" title={v.path}>{v.path || "No file"}</div>
        {previewError.video && <Note kind="error">{previewError.video}</Note>}
      </Card>
      {v.path && resolve && (
        <Card title="Trim & loop points" icon="edit">
          <Timeline
            src={resolve(v.path)}
            inPoint={v.inPoint}
            outPoint={v.outPoint}
            speed={v.speed}
            onChange={({ inPoint, outPoint }) => upd((x) => { x.video.inPoint = Math.round(inPoint * 100) / 100; x.video.outPoint = outPoint == null ? null : Math.round(outPoint * 100) / 100; })}
          />
        </Card>
      )}
    </>
  );
}

export function VideoPlayback({ v, upd }: { v: VideoSettings; upd: Upd }) {
  const set = <K extends keyof VideoSettings>(k: K, val: VideoSettings[K]) => upd((x) => { x.video[k] = val; });
  return (
    <>
      <Card title="Looping" icon="automation">
        <Field label="Loop mode">
          <Segmented value={v.loopMode} onChange={(m) => set("loopMode", m)} options={[{ value: "loop", label: "Seamless loop" }, { value: "pingpong", label: "Ping-pong" }, { value: "crossfade", label: "Crossfade" }]} />
        </Field>
        {v.loopMode === "crossfade" && <Slider label="Crossfade length" value={v.crossfade} min={0.1} max={3} onChange={(x) => set("crossfade", x)} format={(x) => `${x.toFixed(2)} s`} />}
        {v.loopMode === "pingpong" && <Note>Live ping-pong plays backwards by seeking, which can stutter on some files. Use <b>Bake 4K</b> for perfectly smooth playback.</Note>}
        <Slider label="Speed" value={v.speed} min={0.25} max={4} step={0.05} onChange={(x) => set("speed", x)} format={times} />
        <div className="chips compact">{[0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map((s) => <button key={s} className={`chip ${Math.abs(v.speed - s) < 0.001 ? "active" : ""}`} onClick={() => set("speed", s)}>{s}×</button>)}</div>
        <Toggle label="Frame blending" value={v.frameBlend} onChange={(x) => set("frameBlend", x)} hint="Smooths slow motion by blending frames in real time" />
      </Card>
      <Card title="Picture & sound" icon="volume">
        <Select label="Fit" value={v.fit} onChange={(x) => set("fit", x)} options={[{ value: "cover", label: "Fill (crop)" }, { value: "contain", label: "Fit (letterbox)" }, { value: "stretch", label: "Stretch" }]} />
        <Slider label="Opacity" value={v.opacity} min={0} max={1} onChange={(x) => set("opacity", x)} format={pct} />
        <Toggle label="High-quality upscaling" value={v.bicubic} onChange={(x) => set("bicubic", x)} hint="Sharper bicubic sampling for low-res videos on 4K screens" />
        <Toggle label="Mute" value={v.muted} onChange={(x) => set("muted", x)} />
        {!v.muted && <Slider label="Volume" value={v.volume} min={0} max={1} onChange={(x) => set("volume", x)} format={pct} />}
      </Card>
    </>
  );
}

type Interp = "none" | "blend" | "motion";
type Upscale = "none" | "1440p" | "4k";
type Encoder = "x264" | "nvenc" | "qsv" | "amf";

export function VideoBake({ p }: { p: Preset }) {
  const { tools, jobs, startJob, update, notify, videoTime } = useStore();
  const [o, setO] = useState({ interpolation: "none" as Interp, upscale: "4k" as Upscale, sharpen: 0.4, encoder: "x264" as Encoder, keepAudio: false, useResult: true });
  const [jobId, setJobId] = useState<string | null>(null);
  const v = p.video;
  const duration = videoTime.duration;
  const out = v.outPoint ?? duration;
  const job = jobId ? jobs[jobId] : undefined;
  const start = async () => {
    try {
      const id = await invoke<string>("bake_video", {
        request: { input: v.path, inPoint: v.inPoint, outPoint: out, speed: v.speed, loopMode: v.loopMode, crossfade: v.crossfade, interpolation: o.interpolation, upscale: o.upscale, sharpen: o.sharpen, encoder: o.encoder, keepAudio: o.keepAudio },
      });
      setJobId(id);
      const use = o.useResult;
      startJob(id, "Bake loop", (path) => {
        update((c) => {
          c.library.push({ id: `m-${Date.now()}`, name: path.split(/[\\/]/).pop() ?? path, path, source: "baked", addedAt: Date.now() });
          const pr = c.presets.find((x) => x.id === p.id);
          if (use && pr) Object.assign(pr.video, { path, inPoint: 0, outPoint: null, speed: 1, loopMode: "loop", frameBlend: false });
        }, { immediate: true });
        notify(use ? "Loop rendered and applied" : "Loop rendered and added to the library");
      });
    } catch (e) {
      notify(String(e), "error");
    }
  };
  return (
    <Card title="Bake a perfect loop" icon="sparkle" subtitle="Render your trim, speed and loop mode into a new MP4 with ffmpeg. It plays back with zero overhead.">
      {!tools?.ffmpeg && <Note kind="warn">ffmpeg wasn't found. Reinstall AquaWall, or put <code>ffmpeg.exe</code> in the tools folder.</Note>}
      {!out && <Note>Open the Clip tab once so AquaWall can read the video length.</Note>}
      <Select label="Frame interpolation" value={o.interpolation} onChange={(x) => setO({ ...o, interpolation: x })} options={[{ value: "none", label: "None" }, { value: "blend", label: "60 fps blend (fast)" }, { value: "motion", label: "60 fps motion-compensated (best, slow)" }]} />
      <Select label="Resolution" value={o.upscale} onChange={(x) => setO({ ...o, upscale: x })} options={[{ value: "none", label: "Keep original" }, { value: "1440p", label: "1440p (Lanczos upscale)" }, { value: "4k", label: "4K 2160p (Lanczos upscale)" }]} />
      <Slider label="Sharpen" value={o.sharpen} min={0} max={1.5} onChange={(x) => setO({ ...o, sharpen: x })} format={times} />
      <Select label="Encoder" value={o.encoder} onChange={(x) => setO({ ...o, encoder: x })} options={[{ value: "x264", label: "CPU · x264 (works everywhere)" }, { value: "nvenc", label: "NVIDIA NVENC" }, { value: "qsv", label: "Intel Quick Sync" }, { value: "amf", label: "AMD AMF" }]} />
      <Toggle label="Keep audio" value={o.keepAudio} onChange={(x) => setO({ ...o, keepAudio: x })} hint="Seamless-loop mode only" />
      <Toggle label="Use the result in this wallpaper" value={o.useResult} onChange={(x) => setO({ ...o, useResult: x })} />
      <div className="row-actions">
        <Button kind="primary" icon="sparkle" disabled={!tools?.ffmpeg || !v.path || !out || job?.status === "running"} onClick={start}>Bake loop</Button>
        {job?.status === "running" && <Button kind="ghost" onClick={() => invoke("cancel_job", { id: job.id })}>Cancel</Button>}
      </div>
      {job?.status === "running" && <><Progress value={job.progress} /><span className="tiny muted">{Math.round(job.progress * 100)}% · {job.message}</span></>}
      {job?.status === "error" && <pre className="error-box">{job.message}</pre>}
      {job?.status === "done" && <Note kind="ok">Done! {o.useResult ? "This wallpaper now uses the baked loop." : "Added to your library."}</Note>}
    </Card>
  );
}

// ------------------------------------------------------------------ image / shader

export function ImageTab({ p, upd }: { p: Preset; upd: Upd }) {
  const i = p.image;
  const { previewError } = useStore();
  const set = <K extends keyof ImageSettings>(k: K, v: ImageSettings[K]) => upd((x) => { x.image[k] = v; });
  return (
    <Card title="Image" icon="image" right={<Button small icon="folder" onClick={async () => { const f = await pickImageFile(); if (f) set("path", f); }}>Replace image…</Button>}>
      <div className="path-line mono" title={i.path}>{i.path || "No file"}</div>
      {previewError.image && <Note kind="error">{previewError.image}</Note>}
      <Select label="Fit" value={i.fit} onChange={(v) => set("fit", v)} options={[{ value: "cover", label: "Fill (crop)" }, { value: "contain", label: "Fit (letterbox)" }, { value: "stretch", label: "Stretch" }]} />
      <Slider label="Ken Burns motion" value={i.kenBurns} min={0} max={1} onChange={(v) => set("kenBurns", v)} format={pct} hint="Slow cinematic pan and zoom" />
      {i.kenBurns > 0 && <Slider label="Motion speed" value={i.kenBurnsSpeed} min={0.2} max={3} onChange={(v) => set("kenBurnsSpeed", v)} format={times} />}
      <Note>Add <b>parallax</b> and <b>water ripples</b> in the Effects tab to make a photo interactive.</Note>
    </Card>
  );
}

export function ShaderCode({ p, upd }: { p: Preset; upd: Upd }) {
  const { previewError } = useStore();
  const s = p.shader;
  const [draft, setDraft] = useState(s.code);
  useEffect(() => setDraft(s.code), [p.id, s.code]);
  const apply = () => upd((x) => { x.shader.code = draft; if (x.builtin) return; x.shader.builtinId = ""; });
  return (
    <>
      <Card title="Shader" icon="code">
        {!p.builtin && (
          <Select label="Start from" value={s.builtinId || "custom"} onChange={(id) => upd((x) => { const b = SHADER_LIBRARY.find((y) => y.id === id); x.shader.builtinId = b ? b.id : ""; if (b) x.shader.code = b.code; })}
            options={[{ value: "custom", label: "Custom code" }, ...SHADER_LIBRARY.map((b) => ({ value: b.id, label: b.name }))]} />
        )}
        <Slider label="Animation speed" value={s.speed} min={0} max={3} onChange={(v) => upd((x) => { x.shader.speed = v; })} format={times} />
        <Toggle label="Follow the mouse" value={s.mouse} onChange={(v) => upd((x) => { x.shader.mouse = v; })} />
      </Card>
      <Card title="GLSL code" subtitle="Shadertoy compatible: write mainImage(out vec4 fragColor, in vec2 fragCoord)" right={<Button small kind="primary" icon="play" disabled={draft === s.code} onClick={apply}>Run (Ctrl+Enter)</Button>}>
        {p.builtin && <Note>Built-in shader code is read-only here. <b>Duplicate</b> this wallpaper to edit the code.</Note>}
        <textarea className="code" spellCheck={false} readOnly={p.builtin} value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); apply(); }
            if (e.key === "Tab") {
              e.preventDefault();
              const t = e.currentTarget, a = t.selectionStart;
              setDraft(draft.slice(0, a) + "  " + draft.slice(t.selectionEnd));
              requestAnimationFrame(() => t.setSelectionRange(a + 2, a + 2));
            }
          }} />
        {previewError.shader && <pre className="error-box">{previewError.shader}</pre>}
        <p className="tiny muted">Uniforms: iResolution, iTime, iTimeDelta, iFrame, iMouse, iDate, iChannel0 (64×1 live audio spectrum).</p>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ shared tabs

export function EffectsTab({ p, upd }: { p: Preset; upd: Upd }) {
  const e = p.effects;
  const r = e.ripples, t = e.trail;
  const setR = <K extends keyof EffectsSettings["ripples"]>(k: K, v: EffectsSettings["ripples"][K]) => upd((x) => { x.effects.ripples[k] = v; });
  const setT = <K extends keyof EffectsSettings["trail"]>(k: K, v: EffectsSettings["trail"][K]) => upd((x) => { x.effects.trail[k] = v; });
  const visualizerOn = useStore((s) => s.config?.widgets.visualizer.enabled);
  return (
    <>
      {p.kind !== "water" && (
        <Card title="Water ripples" icon="water" subtitle="Bends your wallpaper through an interactive water surface" right={<Toggle label="" value={r.enabled} onChange={(v) => setR("enabled", v)} />}>
          {r.enabled ? (
            <>
              <Slider label="Strength" value={r.strength} min={0} max={3} onChange={(v) => setR("strength", v)} format={times} />
              <Slider label="Ripple size" value={r.size} min={0.2} max={3} onChange={(v) => setR("size", v)} format={times} />
              <Slider label="Persistence" value={r.persistence} min={0} max={1} onChange={(v) => setR("persistence", v)} format={pct} />
              <Slider label="Refraction" value={r.refraction} min={0} max={2} onChange={(v) => setR("refraction", v)} format={times} />
              <Slider label="Glints" value={r.specular} min={0} max={2} onChange={(v) => setR("specular", v)} format={times} />
            </>
          ) : <p className="muted small">Turn this on to make any video, photo or shader react like water.</p>}
        </Card>
      )}
      <Card title="Cursor trail" icon="sparkle" right={<Toggle label="" value={t.enabled} onChange={(v) => setT("enabled", v)} />}>
        {t.enabled ? (
          <>
            <Field label="Style"><Segmented value={t.style} onChange={(v) => setT("style", v)} options={[{ value: "particles", label: "Sparks" }, { value: "light", label: "Light trail" }, { value: "both", label: "Both" }]} /></Field>
            <Toggle label="Rainbow" value={t.rainbow} onChange={(v) => setT("rainbow", v)} />
            {!t.rainbow && <Color label="Color" value={t.color} onChange={(v) => setT("color", v)} />}
            <Slider label="Size" value={t.size} min={0.2} max={3} onChange={(v) => setT("size", v)} format={times} />
            <Slider label="Amount" value={t.amount} min={0} max={2} onChange={(v) => setT("amount", v)} format={times} />
            <Slider label="Trail length" value={t.length} min={0.1} max={2} onChange={(v) => setT("length", v)} format={(v) => `${v.toFixed(1)} s`} />
          </>
        ) : <p className="muted small">Leave glowing sparks or light trails behind your cursor.</p>}
      </Card>
      <Card title="Depth & music" icon="volume">
        <Slider label="Mouse parallax" value={e.parallax} min={0} max={1} onChange={(v) => upd((x) => { x.effects.parallax = v; })} format={pct} hint="The wallpaper shifts gently with your cursor, adding depth" />
        <Slider label="Beat pulse" value={e.beatPulse} min={0} max={1} onChange={(v) => upd((x) => { x.effects.beatPulse = v; })} format={pct} hint="Pulses brightness and zoom on bass beats" />
        {(p.kind === "water" || r.enabled) && (
          <Slider label="Music ripples" value={e.audioRipples} min={0} max={2} onChange={(v) => upd((x) => { x.effects.audioRipples = v; })} format={times} hint="Beats drop ripples into the water" />
        )}
        {(e.beatPulse > 0 || e.audioRipples > 0) && !visualizerOn && <p className="tiny muted">Reacts to whatever is playing on your PC.</p>}
      </Card>
    </>
  );
}

const LOOKS: { name: string; f: Partial<FilterSettings> }[] = [
  { name: "Original", f: {} },
  { name: "Crisp 4K", f: { sharpen: 0.7, contrast: 1.05, vibrance: 0.15 } },
  { name: "Vivid", f: { saturation: 1.25, vibrance: 0.3, contrast: 1.1 } },
  { name: "Cinematic", f: { contrast: 1.12, saturation: 0.9, temperature: 0.2, vignette: 0.45, grain: 0.25 } },
  { name: "Dreamy", f: { blur: 0.25, brightness: 1.05, saturation: 1.1, vignette: 0.3 } },
  { name: "Noir", f: { saturation: 0, contrast: 1.25, vignette: 0.5, grain: 0.3 } },
  { name: "Calm (dim)", f: { brightness: 0.65, saturation: 0.85, blur: 0.4, vignette: 0.5 } },
];

export function EnhanceTab({ p, upd }: { p: Preset; upd: Upd }) {
  const f = p.filters;
  const set = <K extends keyof FilterSettings>(k: K, v: FilterSettings[K]) => upd((x) => { x.filters[k] = v; });
  return (
    <>
      <Card title="Looks" icon="sparkle">
        <div className="chips">{LOOKS.map((l) => <button key={l.name} className="chip" onClick={() => upd((x) => { x.filters = { ...DEFAULT_FILTERS, ...l.f }; })}>{l.name}</button>)}</div>
      </Card>
      <Card title="Color" icon="image" right={<Button small kind="ghost" icon="reset" onClick={() => upd((x) => { x.filters = { ...DEFAULT_FILTERS }; })}>Reset</Button>}>
        <Slider label="Brightness" value={f.brightness} min={0.3} max={1.6} onChange={(v) => set("brightness", v)} format={times} />
        <Slider label="Contrast" value={f.contrast} min={0.5} max={1.6} onChange={(v) => set("contrast", v)} format={times} />
        <Slider label="Saturation" value={f.saturation} min={0} max={2} onChange={(v) => set("saturation", v)} format={times} />
        <Slider label="Vibrance" value={f.vibrance} min={-1} max={1} onChange={(v) => set("vibrance", v)} />
        <Slider label="Gamma" value={f.gamma} min={0.5} max={2} onChange={(v) => set("gamma", v)} />
        <Slider label="Temperature" value={f.temperature} min={-1} max={1} onChange={(v) => set("temperature", v)} format={(v) => (v > 0.005 ? `warm ${v.toFixed(2)}` : v < -0.005 ? `cool ${(-v).toFixed(2)}` : "neutral")} />
      </Card>
      <Card title="Detail & overlays" icon="camera">
        <Slider label="Sharpen" value={f.sharpen} min={0} max={1} onChange={(v) => set("sharpen", v)} format={pct} hint="Contrast-adaptive sharpening, great for upscaled 4K video" />
        <Slider label="Blur" value={f.blur} min={0} max={1} onChange={(v) => set("blur", v)} format={pct} />
        <Slider label="Vignette" value={f.vignette} min={0} max={1} onChange={(v) => set("vignette", v)} format={pct} />
        {f.vignette > 0 && <Slider label="Vignette softness" value={f.vignetteSoftness} min={0.05} max={1} onChange={(v) => set("vignetteSoftness", v)} format={pct} />}
        <Slider label="Film grain" value={f.grain} min={0} max={1} onChange={(v) => set("grain", v)} format={pct} />
      </Card>
      <Card title="Quality" icon="performance">
        <Slider label="Render scale" value={p.renderScale} min={0.5} max={1} onChange={(v) => upd((x) => { x.renderScale = v; })} format={pct} hint="Lower = less GPU at 4K; Sharpen hides the difference" />
        <Slider label="FPS cap" value={p.fpsCap} min={24} max={144} step={1} onChange={(v) => upd((x) => { x.fpsCap = v; })} />
        {p.kind === "water" && <Slider label="Simulation detail" value={p.water.simResolution} min={0.15} max={0.6} onChange={(v) => upd((x) => { x.water.simResolution = v; })} format={pct} hint="Finer ripples cost more GPU" />}
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ page

export async function captureForSave(p: Preset, monitors: { rect: { w: number; h: number }; primary: boolean }[]): Promise<string> {
  const m = monitors.find((x) => x.primary) ?? monitors[0];
  const w = Math.min(3840, m?.rect.w ?? 1920), h = Math.min(2160, m?.rect.h ?? 1080);
  if ((p.kind === "water" || p.kind === "shader") && !p.effects.ripples.enabled) return renderStill(p, w, h);
  if (activePreview && activePreview.currentPresetId === p.id) return activePreview.capture("image/jpeg", 0.95);
  return renderStill(p, w, h);
}

