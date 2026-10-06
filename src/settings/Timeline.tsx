import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react";
import { fmtTime } from "./controls";

interface Props {
  src: string;
  inPoint: number;
  outPoint: number | null;
  speed: number;
  onChange: (v: { inPoint: number; outPoint: number | null }) => void;
  onDuration?: (d: number) => void;
}

async function once(el: HTMLMediaElement, ev: string) {
  return new Promise<void>((res, rej) => {
    const ok = () => { cleanup(); res(); };
    const bad = () => { cleanup(); rej(new Error("media error")); };
    const cleanup = () => { el.removeEventListener(ev, ok); el.removeEventListener("error", bad); };
    el.addEventListener(ev, ok);
    el.addEventListener("error", bad);
  });
}

async function makeThumbs(src: string, count: number): Promise<string[]> {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.src = src;
  await once(v, "loadedmetadata");
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 90;
  const ctx = c.getContext("2d")!;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    v.currentTime = ((i + 0.5) / count) * v.duration;
    await once(v, "seeked");
    const s = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
    const w = v.videoWidth * s, h = v.videoHeight * s;
    ctx.drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h);
    try {
      out.push(c.toDataURL("image/jpeg", 0.6));
    } catch {
      out.push("");
    }
  }
  v.removeAttribute("src");
  v.load();
  return out;
}

/** Video scrubber with draggable In/Out loop handles and loop preview. */
export function Timeline({ src, inPoint, outPoint, speed, onChange, onDuration }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [drag, setDrag] = useState<"in" | "out" | "head" | null>(null);
  const out = outPoint == null || outPoint <= 0 ? duration : Math.min(outPoint, duration || outPoint);

  useEffect(() => {
    setThumbs([]);
    let alive = true;
    makeThumbs(src, 12).then((t) => alive && setThumbs(t)).catch(() => undefined);
    return () => { alive = false; };
  }, [src]);

  useEffect(() => {
    if (video.current) video.current.playbackRate = Math.min(4, Math.max(0.25, speed));
  }, [speed]);

  // Smooth playhead + keep preview playback inside the loop region.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (v) {
        if (!v.paused && out > 0 && (v.currentTime >= out || v.currentTime < inPoint - 0.05)) v.currentTime = inPoint;
        setTime(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inPoint, out]);

  const timeAt = useCallback((clientX: number) => {
    const b = track.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - b.left) / b.width)) * duration;
  }, [duration]);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const t = timeAt(e.clientX);
      if (drag === "in") onChange({ inPoint: Math.min(t, out - 0.2), outPoint });
      else if (drag === "out") onChange({ inPoint, outPoint: Math.max(t, inPoint + 0.2) });
      else if (video.current) video.current.currentTime = t;
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, timeAt, inPoint, out, outPoint, onChange]);

  const toggle = () => {
    const v = video.current!;
    if (v.paused) {
      if (v.currentTime < inPoint || v.currentTime >= out) v.currentTime = inPoint;
      v.play().catch(() => undefined);
    } else v.pause();
  };

  const setIn = () => onChange({ inPoint: Math.min(time, out - 0.2), outPoint });
  const setOut = () => onChange({ inPoint, outPoint: Math.max(time, inPoint + 0.2) });

  const onKey = (e: RKeyboardEvent) => {
    if (e.key === "i" || e.key === "I") setIn();
    else if (e.key === "o" || e.key === "O") setOut();
    else if (e.key === " ") { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowLeft" && video.current) video.current.currentTime = Math.max(0, time - 1 / 30);
    else if (e.key === "ArrowRight" && video.current) video.current.currentTime = Math.min(duration, time + 1 / 30);
  };

  const pos = (t: number) => `${duration ? (t / duration) * 100 : 0}%`;

  return (
    <div className="timeline" tabIndex={0} onKeyDown={onKey}>
      <video
        ref={video}
        className="timeline-video"
        src={src}
        crossOrigin="anonymous"
        muted
        playsInline
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(d);
          onDuration?.(d);
          e.currentTarget.currentTime = inPoint;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="timeline-controls">
        <button className="btn" onClick={toggle}>{playing ? "❚❚ Pause" : "▶ Play loop"}</button>
        <button className="btn ghost" onClick={setIn} title="Shortcut: I">Set In</button>
        <button className="btn ghost" onClick={setOut} title="Shortcut: O">Set Out</button>
        <span className="mono dim">{fmtTime(time)} / {fmtTime(duration)}</span>
        <span className="spacer" />
        <label className="mono">In <input className="num" type="number" step="0.01" min={0} value={inPoint.toFixed(2)} onChange={(e) => onChange({ inPoint: Math.max(0, Math.min(Number(e.target.value), out - 0.2)), outPoint })} /></label>
        <label className="mono">Out <input className="num" type="number" step="0.01" min={0} value={out.toFixed(2)} onChange={(e) => onChange({ inPoint, outPoint: Math.min(duration, Math.max(Number(e.target.value), inPoint + 0.2)) })} /></label>
        <span className="mono dim">Loop {fmtTime(out - inPoint)} @ {speed.toFixed(2)}× = {fmtTime((out - inPoint) / speed)}</span>
      </div>
      <div ref={track} className="timeline-track" onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("thumb")) { setDrag("head"); if (video.current) video.current.currentTime = timeAt(e.clientX); } }}>
        <div className="thumbs">
          {thumbs.length ? thumbs.map((t, i) => <div key={i} className="thumb" style={{ backgroundImage: t ? `url(${t})` : undefined }} />) : <div className="thumb-loading">Generating thumbnails…</div>}
        </div>
        <div className="shade" style={{ left: 0, width: pos(inPoint) }} />
        <div className="shade" style={{ left: pos(out), right: 0 }} />
        <div className="region" style={{ left: pos(inPoint), width: `calc(${pos(out)} - ${pos(inPoint)})` }} />
        <div className="handle in" style={{ left: pos(inPoint) }} onPointerDown={(e) => { e.stopPropagation(); setDrag("in"); }}><span>IN</span></div>
        <div className="handle out" style={{ left: pos(out) }} onPointerDown={(e) => { e.stopPropagation(); setDrag("out"); }}><span>OUT</span></div>
        <div className="playhead" style={{ left: pos(time) }} />
      </div>
      <div className="dim small">Drag the handles or use <b>I</b>/<b>O</b> to set loop points · <b>Space</b> play · <b>←/→</b> step frames</div>
    </div>
  );
}
