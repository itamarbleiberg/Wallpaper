import { exportText, importText, invoke } from "../../shared/ipc";
import { defaultConfig, normalizeConfig } from "../../shared/types";
import { Button, Card, Field, Toggle } from "../controls";
import { useStore } from "../store";

const ACCENTS = ["#3fc2ff", "#7c6cff", "#ff5c8a", "#2ee6a6", "#ffb547", "#ff7a45"];

export function SettingsPage() {
  const { config, update, tools, notify } = useStore();
  if (!config) return null;

  const backup = async () => {
    const ok = await exportText(`AquaWall backup ${new Date().toISOString().slice(0, 10)}.aquawall`, JSON.stringify({ aquawall: 2, backup: true, config }, null, 2), "aquawall");
    if (ok) notify("Backup saved");
  };
  const restore = async () => {
    try {
      const text = await importText(["aquawall", "json"]);
      if (!text) return;
      const data = JSON.parse(text);
      if (!data?.config) throw new Error("This file is not a full backup (use Gallery → Import for single wallpapers)");
      const next = normalizeConfig(data.config);
      await update((c) => { Object.assign(c, next); }, { immediate: true });
      notify("Settings restored");
    } catch (e) {
      notify(`Restore failed: ${(e as Error).message ?? e}`, "error");
    }
  };
  const exportMine = async () => {
    const mine = config.presets.filter((p) => !p.builtin);
    if (!mine.length) return notify("You haven't created any wallpapers yet", "error");
    const ok = await exportText("My AquaWall wallpapers.aquawall", JSON.stringify({ aquawall: 2, presets: mine }, null, 2), "aquawall");
    if (ok) notify(`Exported ${mine.length} wallpapers`);
  };
  const resetAll = async () => {
    if (!confirm("Reset all AquaWall settings? Your imported files stay on disk.")) return;
    const fresh = defaultConfig();
    await update((c) => { Object.assign(c, fresh); }, { immediate: true });
    notify("Settings reset (Ctrl+Z to undo)");
  };

  return (
    <div className="page">
      <header className="page-head"><div><h1>Settings</h1><p>Startup, appearance, backups and tools.</p></div></header>
      <div className="masonry">
        <Card title="Startup" icon="play">
          <Toggle label="Start AquaWall with Windows" value={config.general.autostart} onChange={(v) => update((c) => { c.general.autostart = v; }, { immediate: true })} hint="Starts quietly in the system tray" />
          <Toggle label="Pause all wallpapers" value={config.paused} onChange={(v) => update((c) => { c.paused = v; }, { immediate: true })} />
          <Toggle label="Mute all wallpaper audio" value={config.muted} onChange={(v) => update((c) => { c.muted = v; }, { immediate: true })} />
        </Card>

        <Card title="Windows wallpaper sync" icon="monitor" subtitle="Keeps your lock screen, Task View and sign-in background matching" right={<Toggle label="" value={config.general.syncStaticWallpaper} onChange={(v) => update((c) => { c.general.syncStaticWallpaper = v; })} />}>
          <p className="muted small">Each time you apply a wallpaper, AquaWall also saves a still of it as your regular Windows wallpaper, so nothing looks out of place when AquaWall isn't running.</p>
        </Card>

        <Card title="Appearance" icon="sparkle">
          <Field label="Accent color">
            <div className="swatches">
              {ACCENTS.map((a) => <button key={a} className={`swatch ${config.general.accent === a ? "on" : ""}`} style={{ background: a }} onClick={() => update((c) => { c.general.accent = a; }, { history: false })} />)}
            </div>
          </Field>
        </Card>

        <Card title="Backup & sharing" icon="download">
          <div className="btn-grid">
            <Button icon="download" onClick={backup}>Back up everything</Button>
            <Button icon="upload" onClick={restore}>Restore backup</Button>
            <Button icon="download" onClick={exportMine}>Export my wallpapers</Button>
            <Button kind="danger" icon="reset" onClick={resetAll}>Reset all settings</Button>
          </div>
          <p className="tiny muted">.aquawall files can be shared with friends. Import them from the Gallery.</p>
        </Card>

        <Card title="Tools" icon="folder">
          <Field label="ffmpeg" hint="Video baking & conversion"><span className={tools?.ffmpeg ? "ok-text" : "warn-text"}>{tools?.ffmpeg ? "Installed" : "Not found"}</span></Field>
          <Field label="yt-dlp" hint="Downloads from links"><span className={tools?.ytdlp ? "ok-text" : "warn-text"}>{tools?.ytdlp ? "Installed" : "Not found"}</span></Field>
          <div className="btn-grid">
            <Button small icon="folder" onClick={() => invoke("open_folder", { which: "library" })}>Library folder</Button>
            <Button small icon="folder" onClick={() => invoke("open_folder", { which: "screenshots" })}>Screenshots</Button>
            <Button small icon="folder" onClick={() => invoke("open_folder", { which: "tools" })}>Tools folder</Button>
          </div>
        </Card>

        <Card title="About" icon="info">
          <p><b>AquaWall 2.0</b>: interactive live wallpapers for Windows.</p>
          <p className="muted small">Tray icon: double-click to open AquaWall, middle-click for the next wallpaper. Undo/redo any change with Ctrl+Z / Ctrl+Y.</p>
        </Card>
      </div>
    </div>
  );
}
