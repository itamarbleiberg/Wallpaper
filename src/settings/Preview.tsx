import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Renderer } from "../engine/Renderer";
import { listen, videoUrlResolver } from "../shared/ipc";
import type { Preset } from "../shared/types";
import { useStore } from "./store";

/** The live preview renderer currently mounted (used for screenshots). */
export let activePreview: Renderer | null = null;

/** Live, interactive preview of a preset (uses the real mouse). */
export function Preview({ preset, badge = true }: { preset: Preset | null; badge?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const [fps, setFps] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);
  const transitions = useStore((s) => s.config?.transitions);

  useEffect(() => {
    let r: Renderer | null = null;
    let cancelled = false;
    let unAudio: (() => void) | undefined;
    videoUrlResolver().then((resolve) => {
      if (cancelled || !canvas.current) return;
      try {
        r = new Renderer(canvas.current, {
          resolveVideoUrl: resolve,
          onFps: setFps,
          onError: (src, msg) => {
            if (src === "gl") setFatal(msg);
            else useStore.setState((s) => ({ previewError: { ...s.previewError, [src]: msg } }));
          },
          onVideoTime: (t, duration) => useStore.setState({ videoTime: { t, duration } }),
        });
        renderer.current = r;
        activePreview = r;
        if (preset) r.setPreset(preset);
        listen<number[]>("audio-spectrum", (b) => r?.setAudio(b)).then((u) => (unAudio = u));
      } catch (e) {
        setFatal(String((e as Error).message ?? e));
      }
    });
    const onVis = () => renderer.current?.setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      unAudio?.();
      document.removeEventListener("visibilitychange", onVis);
      if (activePreview === r) activePreview = null;
      r?.destroy();
      renderer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (transitions && renderer.current) renderer.current.transition = transitions;
  }, [transitions]);

  useEffect(() => {
    if (preset) renderer.current?.setPreset(preset);
  }, [preset]);

  const pointer = (e: RPointerEvent<HTMLCanvasElement>, inside = true) => {
    const b = e.currentTarget.getBoundingClientRect();
    renderer.current?.setPointer((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height, (e.buttons & 1) === 1, inside);
  };

  return (
    <div className="preview">
      <canvas ref={canvas} onPointerMove={pointer} onPointerDown={pointer} onPointerUp={pointer} onPointerLeave={(e) => pointer(e, false)} />
      {badge && <div className="preview-badge">{fatal ? "Renderer error" : `${Math.round(fps)} FPS · move & click to interact`}</div>}
      {fatal && <div className="preview-error">{fatal}</div>}
    </div>
  );
}
