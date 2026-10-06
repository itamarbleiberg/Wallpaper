import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Renderer } from "../engine/Renderer";
import { videoUrlResolver } from "../shared/ipc";
import type { Preset } from "../shared/types";
import { useStore } from "./store";

/** Live preview of the selected preset, interactive with the real mouse. */
export function Preview({ preset }: { preset: Preset | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const [fps, setFps] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let r: Renderer | null = null;
    let cancelled = false;
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
        const p = useStore.getState().selected();
        if (p) r.setPreset(p);
      } catch (e) {
        setFatal(String((e as Error).message ?? e));
      }
    });
    const onVis = () => renderer.current?.setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      r?.destroy();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    if (preset) renderer.current?.setPreset(preset);
  }, [preset]);

  const pointer = (e: RPointerEvent<HTMLCanvasElement>, inside = true) => {
    const b = e.currentTarget.getBoundingClientRect();
    renderer.current?.setPointer((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height, (e.buttons & 1) === 1, inside);
  };

  return (
    <div className="preview">
      <canvas
        ref={canvas}
        onPointerMove={pointer}
        onPointerDown={pointer}
        onPointerUp={pointer}
        onPointerLeave={(e) => pointer(e, false)}
      />
      <div className="preview-badge">{fatal ? "Renderer error" : `${Math.round(fps)} fps · move/click to interact`}</div>
      {fatal && <div className="preview-error">{fatal}</div>}
    </div>
  );
}
