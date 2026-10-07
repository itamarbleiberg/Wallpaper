import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Renderer } from "@engine/Renderer";
import type { Preset } from "@shared/types";

interface Props {
  preset: Preset | null;
  interactive?: boolean;
  className?: string;
  showFps?: boolean;
  /** Auto-sweep the cursor so an idle preview still looks alive. */
  autoDemo?: boolean;
  onReady?: (r: Renderer) => void;
}

/**
 * A WebGL preview of a single preset. The engine is the exact same one the
 * desktop app ships; videos/images use their original URLs directly.
 */
export function WebPreview({ preset, interactive = true, className = "", showFps = false, autoDemo = false, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let r: Renderer | null = null;
    try {
      r = new Renderer(canvasRef.current!, {
        resolveVideoUrl: (p) => p,
        onFps: showFps ? setFps : undefined,
        onError: (src, msg) => {
          if (src === "gl") setError(msg);
        },
      });
      rendererRef.current = r;
      onReady?.(r);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      return;
    }

    // Pause rendering when the canvas scrolls out of view (saves battery/GPU).
    const io = new IntersectionObserver(
      ([entry]) => r?.setPaused(!entry.isIntersecting || document.hidden),
      { threshold: 0.05 },
    );
    if (canvasRef.current) io.observe(canvasRef.current);
    const onVis = () => r?.setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);

    let demoRaf = 0;
    if (autoDemo) {
      const start = performance.now();
      const loop = (t: number) => {
        const s = (t - start) / 1000;
        const u = 0.5 + 0.32 * Math.sin(s * 0.6);
        const v = 0.5 + 0.22 * Math.sin(s * 0.9 + 1);
        r?.setPointer(u, v, false, true);
        demoRaf = requestAnimationFrame(loop);
      };
      demoRaf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(demoRaf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      r?.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preset) rendererRef.current?.setPreset(preset);
  }, [preset]);

  const pointer = (e: RPointerEvent<HTMLCanvasElement>, inside = true) => {
    if (!interactive) return;
    const b = e.currentTarget.getBoundingClientRect();
    rendererRef.current?.setPointer((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height, (e.buttons & 1) === 1, inside);
  };

  return (
    <div className={`web-preview ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ cursor: interactive ? "crosshair" : "default" }}
        onPointerMove={pointer}
        onPointerDown={pointer}
        onPointerUp={pointer}
        onPointerLeave={(e) => pointer(e, false)}
      />
      {showFps && !error && <div className="preview-fps">{Math.round(fps)} FPS</div>}
      {error && <div className="preview-fail">⚠ {error}<br /><small>Your browser or GPU may not support WebGL2.</small></div>}
    </div>
  );
}
