import { useEffect, useState } from "react";
import { invoke, pickVideoFile, videoUrlResolver } from "../../shared/ipc";
import type { VideoSettings } from "../../shared/types";
import { Progress, Section, Segmented, Select, Slider, Toggle, pct, times } from "../controls";
import { Timeline } from "../Timeline";
import { useStore } from "../store";

type Interp = "none" | "blend" | "motion";
type Upscale = "none" | "1440p" | "4k";
type Encoder = "x264" | "nvenc" | "qsv" | "amf";

export function VideoPanel() {
  const { selected, updatePreset, previewError, tools, jobs, startJob, update, notify, config } = useStore();
  const p = selected();
  const [resolve, setResolve] = useState<((s: string) => string) | null>(null);
  const [duration, setDuration] = useState(0);
  const [bake, setBake] = useState({ interpolation: "none" as Interp, upscale: "none" as Upscale, sharpen: 0.4, encoder: "x264" as Encoder, keepAudio: false, useResult: true });
  const [bakeJob, setBakeJob] = useState<string | null>(null);

  useEffect(() => { videoUrlResolver().then((r) => setResolve(() => r)); }, []);
  if (!p || !config) return null;
  if (p.kind !== "video") return <Section title="Video"><p className="dim">Select or import a video wallpaper in the Library to edit it.</p></Section>;
  const v = p.video;
  const set = <K extends keyof VideoSettings>(k: K, val: VideoSettings[K]) => updatePreset((x) => { x.video[k] = val; });
  const presetId = p.id;

  const changeFile = async () => {
    const f = await pickVideoFile();
    if (!f) return;
    await update((c) => {
      const pr = c.presets.find((x) => x.id === presetId)!;
      pr.video.path = f;
      pr.video.inPoint = 0;
      pr.video.outPoint = null;
      if (!c.library.some((l) => l.path === f)) c.library.push({ id: `v-${Date.now()}`, name: f.split(/[\\/]/).pop() ?? f, path: f, source: "file", addedAt: Date.now() });
    }, true);
  };

  const startBake = async () => {
    const out = v.outPoint ?? duration;
    try {
      const id = await invoke<string>("bake_video", {
        request: {
          input: v.path, inPoint: v.inPoint, outPoint: out, speed: v.speed, loopMode: v.loopMode, crossfade: v.crossfade,
          interpolation: bake.interpolation, upscale: bake.upscale, sharpen: bake.sharpen, encoder: bake.encoder, keepAudio: bake.keepAudio,
        },
      });
      setBakeJob(id);
      const useResult = bake.useResult;
      startJob(id, "Bake loop", (path) => {
        update((c) => {
          c.library.push({ id: `v-${Date.now()}`, name: path.split(/[\\/]/).pop() ?? path, path, source: "baked", addedAt: Date.now() });
          if (useResult) {
            const pr = c.presets.find((x) => x.id === presetId);
            if (pr) Object.assign(pr.video, { path, inPoint: 0, outPoint: null, speed: 1, loopMode: "loop", frameBlend: false });
          }
        }, true);
        notify("Loop rendered" + (useResult ? " and applied" : ""));
      });
    } catch (e) {
      notify(String(e));
    }
  };

  const job = bakeJob ? jobs[bakeJob] : undefined;
  const loopLen = ((v.outPoint ?? duration) - v.inPoint) / v.speed;

  return (
    <>
      <Section title="Source" right={<button className="btn ghost small" onClick={changeFile}>Change file…</button>}>
        <div className="row"><span className="row-label">File</span><span className="mono path">{v.path || "—"}</span></div>
        <div className="row"><span className="row-label">Name</span><input className="text" value={p.name} onChange={(e) => updatePreset((x) => { x.name = e.target.value; })} /></div>
        {previewError.video && <div className="warn">{previewError.video}</div>}
      </Section>

      {v.path && resolve && (
        <Section title="Timeline & trimming">
          <Timeline
            src={resolve(v.path)}
            inPoint={v.inPoint}
            outPoint={v.outPoint}
            speed={v.speed}
            onDuration={setDuration}
            onChange={({ inPoint, outPoint }) => updatePreset((x) => { x.video.inPoint = Math.round(inPoint * 100) / 100; x.video.outPoint = outPoint == null ? null : Math.round(outPoint * 100) / 100; })}
          />
        </Section>
      )}

      <Section title="Looping & playback">
        <div className="row"><span className="row-label">Loop mode</span>
          <Segmented value={v.loopMode} onChange={(m) => set("loopMode", m)} options={[{ value: "loop", label: "Standard loop" }, { value: "pingpong", label: "Ping-pong" }, { value: "crossfade", label: "Crossfade" }]} />
        </div>
        {v.loopMode === "crossfade" && <Slider label="Crossfade length" value={v.crossfade} min={0.1} max={3} onChange={(x) => set("crossfade", x)} format={(x) => `${x.toFixed(2)} s`} />}
        {v.loopMode === "pingpong" && <div className="dim small">Live ping-pong reverses by seeking, which can stutter on long-GOP files. Bake it below for perfectly smooth playback.</div>}
        <Slider label="Playback speed" value={v.speed} min={0.25} max={4} step={0.05} onChange={(x) => set("speed", x)} format={times} />
        <div className="chips">{[0.25, 0.5, 0.75, 1, 1.5, 2, 4].map((s) => <button key={s} className={`chip ${v.speed === s ? "active" : ""}`} onClick={() => set("speed", s)}>{s}×</button>)}</div>
        <Toggle label="Frame blending (live interpolation)" value={v.frameBlend} onChange={(x) => set("frameBlend", x)} hint="Blends consecutive frames for smoother slow motion. Adds one frame of latency." />
        <Select label="Fit" value={v.fit} onChange={(x) => set("fit", x)} options={[{ value: "cover", label: "Fill (crop)" }, { value: "contain", label: "Fit (letterbox)" }, { value: "stretch", label: "Stretch" }]} />
        <Slider label="Opacity" value={v.opacity} min={0} max={1} onChange={(x) => set("opacity", x)} format={pct} />
        <Toggle label="Mute audio" value={v.muted} onChange={(x) => set("muted", x)} />
        {!v.muted && <Slider label="Volume" value={v.volume} min={0} max={1} onChange={(x) => set("volume", x)} format={pct} />}
        <Toggle label="High-quality upscaling (bicubic)" value={v.bicubic} onChange={(x) => set("bicubic", x)} hint="Catmull-Rom sampling when the video is smaller than your screen" />
      </Section>

      <Section title="Bake perfect 4K loop (ffmpeg)">
        <p className="dim small">Renders your trim, speed and loop mode into a new MP4 with optional motion interpolation and upscaling. Baked loops play with zero overhead.</p>
        {!tools?.ffmpeg && <div className="warn small">ffmpeg was not found. Run <code>scripts/fetch-tools.ps1</code> or put ffmpeg.exe in the tools folder.</div>}
        <Select label="Frame interpolation" value={bake.interpolation} onChange={(x) => setBake({ ...bake, interpolation: x })} options={[{ value: "none", label: "None" }, { value: "blend", label: "Blend to 60 fps (fast)" }, { value: "motion", label: "Motion-compensated 60 fps (slow, best)" }]} />
        <Select label="Upscale" value={bake.upscale} onChange={(x) => setBake({ ...bake, upscale: x })} options={[{ value: "none", label: "Keep resolution" }, { value: "1440p", label: "1440p (Lanczos)" }, { value: "4k", label: "4K 2160p (Lanczos)" }]} />
        <Slider label="Sharpen" value={bake.sharpen} min={0} max={1.5} onChange={(x) => setBake({ ...bake, sharpen: x })} format={times} />
        <Select label="Encoder" value={bake.encoder} onChange={(x) => setBake({ ...bake, encoder: x })} options={[{ value: "x264", label: "CPU (x264, best compatibility)" }, { value: "nvenc", label: "NVIDIA NVENC" }, { value: "qsv", label: "Intel Quick Sync" }, { value: "amf", label: "AMD AMF" }]} />
        <Toggle label="Keep audio (standard loop only)" value={bake.keepAudio} onChange={(x) => setBake({ ...bake, keepAudio: x })} />
        <Toggle label="Use result in this wallpaper" value={bake.useResult} onChange={(x) => setBake({ ...bake, useResult: x })} />
        {v.loopMode === "pingpong" && loopLen > 20 && <div className="warn small">Ping-pong baking buffers the whole clip in RAM; consider trimming it below 20 s.</div>}
        <div className="actions">
          <button className="btn primary" disabled={!tools?.ffmpeg || !v.path || (job?.status === "running")} onClick={startBake}>Bake loop</button>
          {job?.status === "running" && <button className="btn ghost" onClick={() => invoke("cancel_job", { id: job.id })}>Cancel</button>}
        </div>
        {job && job.status === "running" && <Progress value={job.progress} />}
        {job && job.status === "error" && <pre className="error-box">{job.message}</pre>}
      </Section>
    </>
  );
}
