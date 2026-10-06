import { useState, type KeyboardEvent as RKeyboardEvent } from "react";
import type { AppConfig } from "../../shared/types";
import { inWindow } from "../../shared/types";
import { Button, Card, Field, Note, Segmented, Slider, Toggle, pct } from "../controls";
import { Icon } from "../icons";
import { useStore } from "../store";
import { Thumb } from "./GalleryPage";

type HotkeyKey = keyof Omit<AppConfig["hotkeys"], "enabled">;

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down", " ": "Space", Escape: "Escape",
  PageUp: "PageUp", PageDown: "PageDown", Home: "Home", End: "End", Insert: "Insert", Delete: "Delete",
};

function comboFromEvent(e: RKeyboardEvent): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
  let key = KEY_NAMES[e.key] ?? e.key;
  if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
  else if (/^F\d{1,2}$/.test(key) || /^\d$/.test(key) || Object.values(KEY_NAMES).includes(key)) { /* ok */ }
  else return null;
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Super"].filter(Boolean);
  if (!mods.length && !/^F\d/.test(key)) return null;
  return [...mods, key].join("+");
}

function HotkeyField({ k, label }: { k: HotkeyKey; label: string }) {
  const { config, update } = useStore();
  const [rec, setRec] = useState(false);
  const v = config!.hotkeys[k];
  return (
    <Field label={label}>
      <div className="hotkey">
        <button
          className={`key-capture ${rec ? "rec" : ""}`}
          onClick={() => setRec(true)}
          onBlur={() => setRec(false)}
          onKeyDown={(e) => {
            if (!rec) return;
            e.preventDefault();
            if (e.key === "Escape") return setRec(false);
            if (e.key === "Backspace") { update((c) => { c.hotkeys[k] = ""; }); return setRec(false); }
            const combo = comboFromEvent(e);
            if (combo) { update((c) => { c.hotkeys[k] = combo; }, { immediate: true }); setRec(false); }
          }}
        >
          {rec ? "Press keys… (Esc cancel, Backspace clear)" : v ? v.split("+").map((p) => <kbd key={p}>{p}</kbd>) : <span className="muted">Not set</span>}
        </button>
      </div>
    </Field>
  );
}

export function AutomationPage() {
  const { config, update, hotkeyErrors } = useStore();
  if (!config) return null;
  const pl = config.playlist, sc = config.schedule, nt = config.night, tr = config.transitions, hk = config.hotkeys;
  const nightNow = nt.enabled && inWindow(nt.start, nt.end);

  return (
    <div className="page">
      <header className="page-head"><div><h1>Automation</h1><p>Rotate wallpapers, follow the time of day, and control AquaWall from anywhere.</p></div></header>
      <div className="masonry">
        <Card title="Playlist" subtitle="Rotate through wallpapers automatically" icon="shuffle" right={<Toggle label="" value={pl.enabled} onChange={(v) => update((c) => { c.playlist.enabled = v; }, { immediate: true })} />}>
          <Slider label="Change every" value={pl.intervalMin} min={0.5} max={240} step={0.5} onChange={(v) => update((c) => { c.playlist.intervalMin = v; })} format={(v) => (v < 60 ? `${v} min` : `${(v / 60).toFixed(1)} h`)} />
          <Toggle label="Shuffle" value={pl.shuffle} onChange={(v) => update((c) => { c.playlist.shuffle = v; })} />
          <div className="pick-head">
            <span className="muted small">{pl.presetIds.length ? `${pl.presetIds.length} selected` : "Nothing selected: favorites are used (or every wallpaper if you have none)."}</span>
            <span>
              <Button small kind="ghost" onClick={() => update((c) => { c.playlist.presetIds = c.presets.filter((p) => p.favorite).map((p) => p.id); })}>Use favorites</Button>
              <Button small kind="ghost" onClick={() => update((c) => { c.playlist.presetIds = []; })}>Clear</Button>
            </span>
          </div>
          <div className="pick-grid">
            {config.presets.map((p) => {
              const on = pl.presetIds.includes(p.id);
              return (
                <button key={p.id} className={`pick ${on ? "on" : ""}`} onClick={() => update((c) => { c.playlist.presetIds = on ? c.playlist.presetIds.filter((x) => x !== p.id) : [...c.playlist.presetIds, p.id]; })}>
                  <Thumb preset={p} />
                  <span>{p.name}</span>
                  {on && <i><Icon name="check" size={12} /></i>}
                </button>
              );
            })}
          </div>
          {pl.enabled && sc.enabled && <Note>The time-of-day schedule is on and takes priority over the playlist.</Note>}
        </Card>

        <Card title="Time of day" subtitle="Morning, evening and night wallpapers" icon="automation" right={<Toggle label="" value={sc.enabled} onChange={(v) => update((c) => { c.schedule.enabled = v; }, { immediate: true })} />}>
          {sc.slots.map((s, i) => (
            <div key={i} className="slot">
              <input className="input time" type="time" value={s.start} onChange={(e) => update((c) => { c.schedule.slots[i].start = e.target.value; })} />
              <select className="select" value={s.presetId} onChange={(e) => update((c) => { c.schedule.slots[i].presetId = e.target.value; })}>
                {config.presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Button small kind="ghost" icon="trash" onClick={() => update((c) => { c.schedule.slots.splice(i, 1); })} />
            </div>
          ))}
          <Button small icon="plus" onClick={() => update((c) => { c.schedule.slots.push({ start: "12:00", presetId: c.display.defaultPresetId }); })}>Add time</Button>
          <p className="tiny muted">Each wallpaper starts at its time and stays until the next one.</p>
        </Card>

        <Card title="Night mode" subtitle="Dim and warm the wallpaper in the evening" icon="sparkle" right={<Toggle label="" value={nt.enabled} onChange={(v) => update((c) => { c.night.enabled = v; })} />}>
          <Field label="From / until">
            <div className="inline-row">
              <input className="input time" type="time" value={nt.start} onChange={(e) => update((c) => { c.night.start = e.target.value; })} />
              <span className="muted">to</span>
              <input className="input time" type="time" value={nt.end} onChange={(e) => update((c) => { c.night.end = e.target.value; })} />
            </div>
          </Field>
          <Slider label="Dim" value={nt.dim} min={0} max={0.8} onChange={(v) => update((c) => { c.night.dim = v; })} format={pct} />
          <Slider label="Warmth" value={nt.warmth} min={0} max={1} onChange={(v) => update((c) => { c.night.warmth = v; })} format={pct} />
          {nt.enabled && <p className="tiny muted">{nightNow ? "Night mode is active right now." : "Not active right now."}</p>}
        </Card>

        <Card title="Transitions" subtitle="How wallpapers change" icon="water">
          <Field label="Effect"><Segmented value={tr.type} onChange={(v) => update((c) => { c.transitions.type = v; })} options={[{ value: "fade", label: "Crossfade" }, { value: "ripple", label: "Ripple" }, { value: "none", label: "Instant" }]} /></Field>
          {tr.type !== "none" && <Slider label="Duration" value={tr.duration} min={0.3} max={4} step={0.1} onChange={(v) => update((c) => { c.transitions.duration = v; })} format={(v) => `${v.toFixed(1)} s`} />}
        </Card>

        <Card title="Keyboard shortcuts" subtitle="Work everywhere, even in other apps" icon="keyboard" right={<Toggle label="" value={hk.enabled} onChange={(v) => update((c) => { c.hotkeys.enabled = v; }, { immediate: true })} />}>
          {hk.enabled && (
            <>
              <HotkeyField k="pause" label="Pause / resume" />
              <HotkeyField k="next" label="Next wallpaper" />
              <HotkeyField k="prev" label="Previous wallpaper" />
              <HotkeyField k="mute" label="Mute / unmute" />
              <HotkeyField k="settings" label="Open AquaWall" />
              {hotkeyErrors.length > 0 && <Note kind="warn">Some shortcuts couldn't be registered (another app may already use them): {hotkeyErrors.join("; ")}</Note>}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
