import { useEffect, useState } from "react";
import { invoke } from "../../shared/ipc";
import { Button, Card, Select, Slider, Toggle } from "../controls";
import { Icon } from "../icons";
import { useStore } from "../store";

export function PerformancePage() {
  const { config, update } = useStore();
  const [apps, setApps] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  useEffect(() => { invoke<string[]>("list_window_apps").then(setApps).catch(() => undefined); }, []);
  if (!config) return null;
  const p = config.performance;
  const act = [{ value: "pause", label: "Pause wallpaper" }, { value: "mute", label: "Mute audio only" }, { value: "none", label: "Keep running" }] as const;
  const addApp = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n) return;
    const exe = n.endsWith(".exe") ? n : `${n}.exe`;
    update((c) => { if (!c.performance.blockedApps.includes(exe)) c.performance.blockedApps.push(exe); });
  };

  return (
    <div className="page">
      <header className="page-head"><div><h1>Performance</h1><p>A paused wallpaper uses no GPU at all. Decide when AquaWall steps aside.</p></div></header>
      <div className="masonry">
        <Card title="Games & fullscreen" icon="performance">
          <Select label="Fullscreen app or game" value={p.onFullscreen} onChange={(v) => update((c) => { c.performance.onFullscreen = v; })} options={act} />
          <Select label="Maximized window" value={p.onMaximized} onChange={(v) => update((c) => { c.performance.onMaximized = v; })} options={act} />
          <p className="tiny muted">Only the display showing that app is affected.</p>
        </Card>

        <Card title="Battery" icon="performance">
          <Select label="On battery" value={p.onBattery} onChange={(v) => update((c) => { c.performance.onBattery = v; })} options={[{ value: "pause", label: "Pause wallpaper" }, { value: "throttle", label: "Limit to 30 FPS" }, { value: "none", label: "Keep running" }]} />
          <Slider label="…at or below" value={p.batteryThreshold} min={5} max={100} step={5} onChange={(v) => update((c) => { c.performance.batteryThreshold = v; })} format={(v) => `${v}%`} />
          <Toggle label="Pause with Battery Saver" value={p.pauseOnBatterySaver} onChange={(v) => update((c) => { c.performance.pauseOnBatterySaver = v; })} />
        </Card>

        <Card title="Idle power saver" subtitle="When you step away from the PC" icon="pause" right={<Toggle label="" value={p.idleEnabled} onChange={(v) => update((c) => { c.performance.idleEnabled = v; })} />}>
          <Slider label="After" value={p.idleMinutes} min={1} max={60} step={1} onChange={(v) => update((c) => { c.performance.idleMinutes = v; })} format={(v) => `${v} min`} />
          <Select label="Then" value={p.idleAction} onChange={(v) => update((c) => { c.performance.idleAction = v; })} options={[{ value: "dim", label: "Dim the wallpaper" }, { value: "throttle", label: "Limit to 30 FPS" }, { value: "pause", label: "Pause" }]} />
        </Card>

        <Card title="App blocklist" subtitle="Pause all wallpapers while one of these apps is in front" icon="x">
          <div className="tag-list">
            {p.blockedApps.length === 0 && <span className="muted small">No apps yet.</span>}
            {p.blockedApps.map((a) => (
              <span key={a} className="tag">{a}<button onClick={() => update((c) => { c.performance.blockedApps = c.performance.blockedApps.filter((x) => x !== a); })}><Icon name="x" size={12} /></button></span>
            ))}
          </div>
          <div className="inline-row">
            <select className="select" value="" onChange={(e) => { addApp(e.target.value); }}>
              <option value="">Add a running app…</option>
              {apps.filter((a) => !p.blockedApps.includes(a)).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Button small kind="ghost" icon="reset" onClick={() => invoke<string[]>("list_window_apps").then(setApps)} title="Refresh list" />
          </div>
          <div className="inline-row">
            <input className="input" placeholder="or type a name, e.g. photoshop.exe" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addApp(manual); setManual(""); } }} />
            <Button small icon="plus" onClick={() => { addApp(manual); setManual(""); }}>Add</Button>
          </div>
        </Card>

        <Card title="Interaction" icon="water">
          <Select label="React to the mouse" value={p.interactWhen} onChange={(v) => update((c) => { c.performance.interactWhen = v; })} options={[{ value: "desktop", label: "Only over the desktop" }, { value: "always", label: "Always, even behind windows" }]} />
          <Slider label="Cursor polling" value={p.cursorHz} min={30} max={240} step={10} onChange={(v) => update((c) => { c.performance.cursorHz = v; })} format={(v) => `${v} Hz`} hint="Higher = smoother ripples, slightly more CPU" />
          <Slider label="Watchdog interval" value={p.pollMs} min={250} max={3000} step={50} onChange={(v) => update((c) => { c.performance.pollMs = v; })} format={(v) => `${v} ms`} hint="How quickly fullscreen apps are detected" />
        </Card>

        <Card title="Diagnostics" icon="info">
          <Toggle label="FPS overlay on wallpaper" value={config.general.showHud} onChange={(v) => update((c) => { c.general.showHud = v; })} hint="Shows frame rate and resolution in the corner" />
        </Card>
      </div>
    </div>
  );
}
