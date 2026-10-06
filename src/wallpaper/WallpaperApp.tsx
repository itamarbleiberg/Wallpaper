import { useEffect, useMemo, useRef, useState } from "react";
import { Renderer } from "../engine/Renderer";
import { currentLabel, invoke, listen, videoUrlResolver } from "../shared/ipc";
import type { AppConfig, CursorEvent, PlaybackState, WallpaperTarget } from "../shared/types";
import { inWindow, normalizeConfig, presetForTarget } from "../shared/types";
import { Widgets, rainFromCode, useWeather } from "../widgets/Widgets";

/** Runs inside each embedded wallpaper window (one per display, or one spanning). */
export function WallpaperApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [target, setTarget] = useState<WallpaperTarget | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({ paused: false, muted: false, throttle: false, dim: false, reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [spectrum, setSpectrum] = useState<number[]>([]);
  const [fps, setFps] = useState(0);
  const [minute, setMinute] = useState(0);
  const targetRef = useRef<WallpaperTarget | null>(null);
  const configRef = useRef<AppConfig | null>(null);
  targetRef.current = target;
  configRef.current = config;

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
          onFps: setFps,
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
      setTarget(targets.find((t) => t.label === label) ?? targets[0] ?? null);
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
          if (configRef.current?.widgets.visualizer.enabled) setSpectrum(bands);
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
    const tick = setInterval(() => setMinute((m) => m + 1), 30_000);

    return () => {
      disposed = true;
      clearInterval(tick);
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
    const r = rendererRef.current;
    if (!r || !config) return;
    r.transition = config.transitions;
  }, [config?.transitions]);

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

  // Night mode + idle dimming.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !config) return;
    const n = config.night;
    const night = n.enabled && inWindow(n.start, n.end);
    let brightness = night ? 1 - n.dim : 1;
    if (playback.dim) brightness *= 0.4;
    r.setGlobalAdjust({ brightness, warmth: night ? n.warmth * 0.9 : 0 });
  }, [config?.night, playback.dim, minute]);

  // Weather: shared by the widget and rain sync.
  const w = config?.widgets.weather;
  const weather = useWeather(w?.latitude ?? 0, w?.longitude ?? 0, w?.units ?? "celsius", !!w && (w.enabled || w.syncRain));
  useEffect(() => {
    rendererRef.current?.setRain(w?.syncRain && weather ? rainFromCode(weather.code) : 0);
  }, [w?.syncRain, weather]);

  const widgetArea = useMemo(() => {
    if (!target) return { left: 0, top: 0, width: "100%" as number | string, height: "100%" as number | string, show: true };
    const dpr = window.devicePixelRatio || 1;
    const m = target.monitors.find((x) => x.primary) ?? target.monitors[0];
    const showAll = config?.widgets.allDisplays ?? false;
    const show = !!m && (showAll || m.primary || target.monitors.length > 1);
    if (!m) return { left: 0, top: 0, width: "100%", height: "100%", show };
    return { left: (m.rect.x - target.rect.x) / dpr, top: (m.rect.y - target.rect.y) / dpr, width: m.rect.w / dpr, height: m.rect.h / dpr, show };
  }, [target, config?.widgets.allDisplays]);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {config && widgetArea.show && (
        <div style={{ position: "fixed", left: widgetArea.left, top: widgetArea.top, width: widgetArea.width, height: widgetArea.height, pointerEvents: "none" }}>
          <Widgets config={config.widgets} spectrum={spectrum} paused={playback.paused} weather={weather} />
        </div>
      )}
      {config?.general.showHud && preset && (
        <div className="aq-hud">
          {Math.round(fps)} FPS · {canvasRef.current?.width}×{canvasRef.current?.height} · {preset.name}
          {playback.reason && ` · ${playback.reason}`}
        </div>
      )}
      {error && <div className="aq-error">{error}</div>}
    </>
  );
}
