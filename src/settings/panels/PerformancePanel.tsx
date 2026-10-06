import { invoke } from "../../shared/ipc";
import { Section, Select, Slider, Toggle } from "../controls";
import { useStore } from "../store";

export function PerformancePanel() {
  const { config, update, tools } = useStore();
  if (!config) return null;
  const p = config.performance;
  const act = [{ value: "pause", label: "Pause wallpaper" }, { value: "mute", label: "Mute audio only" }, { value: "none", label: "Keep running" }] as const;

  return (
    <>
      <Section title="When other apps are active">
        <Select label="Fullscreen app or game" value={p.onFullscreen} onChange={(v) => update((c) => { c.performance.onFullscreen = v; })} options={[...act]} />
        <Select label="Maximized window" value={p.onMaximized} onChange={(v) => update((c) => { c.performance.onMaximized = v; })} options={[...act]} />
        <p className="dim small">Only the display showing the fullscreen/maximized app is affected. Paused wallpapers use no GPU.</p>
      </Section>
      <Section title="Battery">
        <Select label="On battery power" value={p.onBattery} onChange={(v) => update((c) => { c.performance.onBattery = v; })} options={[{ value: "pause", label: "Pause wallpaper" }, { value: "throttle", label: "Limit to 30 fps" }, { value: "none", label: "Keep running" }]} />
        <Slider label="…when battery is at or below" value={p.batteryThreshold} min={5} max={100} step={5} onChange={(v) => update((c) => { c.performance.batteryThreshold = v; })} format={(v) => `${v}%`} />
        <Toggle label="Pause when Battery Saver is on" value={p.pauseOnBatterySaver} onChange={(v) => update((c) => { c.performance.pauseOnBatterySaver = v; })} />
      </Section>
      <Section title="Interaction">
        <Select label="React to the mouse" value={p.interactWhen} onChange={(v) => update((c) => { c.performance.interactWhen = v; })} options={[{ value: "desktop", label: "Only when over the desktop" }, { value: "always", label: "Always (even behind windows)" }]} />
        <Slider label="Cursor polling rate" value={p.cursorHz} min={30} max={240} step={10} onChange={(v) => update((c) => { c.performance.cursorHz = v; })} format={(v) => `${v} Hz`} />
        <Slider label="Watchdog interval" value={p.pollMs} min={250} max={3000} step={50} onChange={(v) => update((c) => { c.performance.pollMs = v; })} format={(v) => `${v} ms`} />
      </Section>
      <Section title="Startup">
        <Toggle label="Start AquaWall with Windows" value={config.general.autostart} onChange={(v) => update((c) => { c.general.autostart = v; }, true)} />
        <Toggle label="Pause all wallpapers" value={config.paused} onChange={(v) => update((c) => { c.paused = v; }, true)} />
      </Section>
      <Section title="Tools" right={<button className="btn ghost small" onClick={() => invoke("open_folder", { which: "tools" })}>Open tools folder</button>}>
        <div className="row"><span className="row-label">ffmpeg</span><span className={tools?.ffmpeg ? "ok-text mono small" : "warn-text"}>{tools?.ffmpeg ?? "not found"}</span></div>
        <div className="row"><span className="row-label">yt-dlp</span><span className={tools?.ytdlp ? "ok-text mono small" : "warn-text"}>{tools?.ytdlp ?? "not found"}</span></div>
        <div className="row"><span className="row-label">Library</span><span className="mono small">{tools?.libraryDir}</span></div>
      </Section>
    </>
  );
}
