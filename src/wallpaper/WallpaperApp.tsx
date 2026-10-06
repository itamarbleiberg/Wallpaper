import { useEffect, useMemo, useRef, useState } from "react";
import { Renderer } from "../engine/Renderer";
import { currentLabel, invoke, listen, videoUrlResolver } from "../shared/ipc";
import type { AppConfig, CursorEvent, PlaybackState, WallpaperTarget } from "../shared/types";
import { normalizeConfig, presetForTarget } from "../shared/types";
import { Widgets } from "../widgets/Widgets";

/** Runs inside each embedded wallpaper window (one per display, or one spanning). */
export function WallpaperApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [target, setTarget] = useState<WallpaperTarget | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({ paused: false, muted: false, throttle: false, reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [spectrum, setSpectrum] = useState<number[]>([]);
  const targetRef = useRef<WallpaperTarget | null>(null);
  const configRef = useRef<AppConfig | null>(null);
  targetRef.current = target;
  configRef.current = config;

  // Boot: renderer + IPC subscriptions.
  useEffect(() => {
    let disposed = false;
    const unsubs: (() => void)[] = [];
    (async () => {
      const label = await currentLabel();
      const resolve = await videoUrlResolver();
      try {
        rendererRef.current = new Renderer(canvasRef.current!, {
          resolveVideoUrl: resolve,
          onError: (_src, msg) => setError(msg),
        });
      } catch (e) {
        setError(String((e as Error).message ?? e));
        return;
      }
      const cfg = normalizeConfig(await invoke("get_config"));
      const targets = await invoke<WallpaperTarget[]>("get_targets");
      const pb = await invoke<Record<string, PlaybackState>>("get_playback");
      if (disposed) return;
      setConfig(cfg);
      setTarget(targets.find((t) => t.label === label) ?? null);
      if (pb[label]) setPlayback(pb[label]);

      unsubs.push(await listen<unknown>("config-changed", (c) => setConfig(normalizeConfig(c))));
      unsubs.push(await listen<WallpaperTarget[]>("targets-changed", (ts) => setTarget(ts.find((t) => t.label === label) ?? null)));
      unsubs.push(await listen<Record<string, PlaybackState>>("playback", (m) => m[label] && setPlayback(m[label])));
      unsubs.push(
        await listen<CursorEvent>("cursor", (c) => {
          const t = targetRef.current;
          const r = rendererRef.current;
          if (!t || !r) return;
          const u = (c.x - t.rect.x) / t.rect.w;
          const v = (c.y - t.rect.y) / t.rect.h;
          const inRect = u >= 0 && u <= 1 && v >= 0 && v <= 1;
          const desktopOnly = configRef.current?.performance.interactWhen !== "always";
          r.setPointer(u, v, c.down, inRect && (!desktopOnly || c.overDesktop));
        }),
      );
      unsubs.push(
        await listen<number[]>("audio-spectrum", (bands) => {
          rendererRef.current?.setAudio(bands);
          setSpectrum(bands);
        }),
      );
    })();

    // Browser-mode fallback: real mouse events.
    const onMove = (e: MouseEvent) => {
      if ("__TAURI_INTERNALS__" in window) return;
      rendererRef.current?.setPointer(e.clientX / innerWidth, e.clientY / innerHeight, (e.buttons & 1) === 1, true);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onMove);
    window.addEventListener("mouseup", onMove);

    return () => {
      disposed = true;
      unsubs.forEach((u) => u());
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onMove);
      window.removeEventListener("mouseup", onMove);
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  const preset = useMemo(() => (config ? presetForTarget(config, target?.presetId) : null), [config, target?.presetId]);

  useEffect(() => {
    if (preset) rendererRef.current?.setPreset(preset);
  }, [preset]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setPaused(playback.paused);
    r.setMuted(playback.muted);
    r.setThrottle(playback.throttle);
  }, [playback]);

  // Widgets live on the primary display's area inside this window.
  const widgetArea = useMemo(() => {
    if (!target) return { left: 0, top: 0, width: "100%", height: "100%", show: true };
    const dpr = window.devicePixelRatio || 1;
    const m = target.monitors.find((x) => x.primary) ?? target.monitors[0];
    const showAll = config?.widgets.allDisplays ?? false;
    const show = !!m && (showAll || m.primary || target.monitors.length > 1);
    if (!m) return { left: 0, top: 0, width: "100%", height: "100%", show };
    return {
      left: (m.rect.x - target.rect.x) / dpr,
      top: (m.rect.y - target.rect.y) / dpr,
      width: m.rect.w / dpr,
      height: m.rect.h / dpr,
      show,
    };
  }, [target, config?.widgets.allDisplays]);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {config && widgetArea.show && (
        <div style={{ position: "fixed", left: widgetArea.left, top: widgetArea.top, width: widgetArea.width, height: widgetArea.height, pointerEvents: "none" }}>
          <Widgets config={config.widgets} spectrum={spectrum} paused={playback.paused} />
        </div>
      )}
      {error && <div className="aq-error">{error}</div>}
    </>
  );
}
