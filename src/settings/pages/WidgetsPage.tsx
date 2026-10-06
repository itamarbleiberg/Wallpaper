import { useState, type ReactNode } from "react";
import type { WidgetBase, WidgetPosition, WidgetsConfig } from "../../shared/types";
import { Button, Card, Color, Field, LazyInput, Select, Slider, Toggle, pct, times } from "../controls";
import { useStore } from "../store";

const POSITIONS: { value: WidgetPosition; label: string }[] = [
  { value: "top-left", label: "Top left" }, { value: "top-center", label: "Top center" }, { value: "top-right", label: "Top right" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom left" }, { value: "bottom-center", label: "Bottom center" }, { value: "bottom-right", label: "Bottom right" },
];

type WKey = keyof Omit<WidgetsConfig, "allDisplays">;

function Common({ k, noPosition }: { k: WKey; noPosition?: boolean }) {
  const { config, update } = useStore();
  const w = config!.widgets[k] as WidgetBase;
  const set = <F extends keyof WidgetBase>(f: F, v: WidgetBase[F]) => update((c) => { (c.widgets[k] as WidgetBase)[f] = v; });
  return (
    <>
      {!noPosition && <Select label="Position" value={w.position} onChange={(v) => set("position", v)} options={POSITIONS} />}
      <Slider label="Size" value={w.scale} min={0.5} max={3} onChange={(v) => set("scale", v)} format={times} />
      <Color label="Color" value={w.color} onChange={(v) => set("color", v)} />
      <Slider label="Opacity" value={w.opacity} min={0.1} max={1} onChange={(v) => set("opacity", v)} format={pct} />
    </>
  );
}

function WidgetCard({ k, title, subtitle, icon, children }: { k: WKey; title: string; subtitle: string; icon: string; children?: ReactNode }) {
  const { config, update } = useStore();
  const on = config!.widgets[k].enabled;
  return (
    <Card title={title} subtitle={subtitle} icon={icon} className={on ? "" : "collapsed"} right={<Toggle label="" value={on} onChange={(v) => update((c) => { c.widgets[k].enabled = v; })} />}>
      {on && children}
    </Card>
  );
}

export function WidgetsPage() {
  const { config, update, notify } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ name: string; country: string; admin1?: string; latitude: number; longitude: number }[]>([]);
  if (!config) return null;
  const w = config.widgets;

  const search = async () => {
    if (!query.trim()) return;
    try {
      const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6`)).json();
      setResults(j.results ?? []);
      if (!j.results?.length) notify("No places found", "error");
    } catch {
      notify("Location search failed. Are you offline?", "error");
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Widgets</h1><p>Information shown on top of your wallpaper, behind your desktop icons.</p></div>
        <Toggle label="Show on all displays" value={w.allDisplays} onChange={(v) => update((c) => { c.widgets.allDisplays = v; })} hint="Otherwise only on the main display" />
      </header>
      <div className="masonry">
        <WidgetCard k="clock" title="Clock" subtitle="Time and date" icon="widgets">
          <Select label="Style" value={w.clock.style} onChange={(v) => update((c) => { c.widgets.clock.style = v; })} options={[{ value: "thin", label: "Thin" }, { value: "bold", label: "Bold" }, { value: "mono", label: "Digital" }]} />
          <Toggle label="24-hour" value={w.clock.format24} onChange={(v) => update((c) => { c.widgets.clock.format24 = v; })} />
          <Toggle label="Seconds" value={w.clock.showSeconds} onChange={(v) => update((c) => { c.widgets.clock.showSeconds = v; })} />
          <Toggle label="Date" value={w.clock.showDate} onChange={(v) => update((c) => { c.widgets.clock.showDate = v; })} />
          <Common k="clock" />
        </WidgetCard>

        <WidgetCard k="weather" title="Weather" subtitle="Live conditions from Open-Meteo" icon="sparkle">
          <Field label="Location" hint={`${w.weather.latitude.toFixed(2)}, ${w.weather.longitude.toFixed(2)}`}><b>{w.weather.place}</b></Field>
          <div className="inline-row">
            <input className="input" placeholder="Search a city…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
            <Button onClick={search} icon="search">Search</Button>
          </div>
          {results.length > 0 && (
            <div className="result-list">
              {results.map((r) => (
                <button key={`${r.latitude},${r.longitude}`} onClick={() => { update((c) => { Object.assign(c.widgets.weather, { place: r.name, latitude: r.latitude, longitude: r.longitude }); }); setResults([]); setQuery(""); }}>
                  <b>{r.name}</b> <span className="muted">{[r.admin1, r.country].filter(Boolean).join(", ")}</span>
                </button>
              ))}
            </div>
          )}
          <Select label="Units" value={w.weather.units} onChange={(v) => update((c) => { c.widgets.weather.units = v; })} options={[{ value: "celsius", label: "°C" }, { value: "fahrenheit", label: "°F" }]} />
          <Common k="weather" />
        </WidgetCard>

        <Card title="Weather sync" subtitle="When it rains outside, rain falls on your water wallpapers" icon="water" right={<Toggle label="" value={w.weather.syncRain} onChange={(v) => update((c) => { c.widgets.weather.syncRain = v; })} />}>
          <p className="muted small">Uses the weather location above, even when the weather widget is hidden. It works on water wallpapers and on any wallpaper with water ripples turned on.</p>
        </Card>

        <WidgetCard k="visualizer" title="Audio visualizer" subtitle="Reacts to everything playing on your PC" icon="volume">
          <Select label="Style" value={w.visualizer.style} onChange={(v) => update((c) => { c.widgets.visualizer.style = v; })} options={[{ value: "mirror", label: "Mirrored bars" }, { value: "bars", label: "Bars" }, { value: "wave", label: "Wave" }]} />
          <Select label="Edge" value={w.visualizer.position.startsWith("top") ? "top-center" : "bottom-center"} onChange={(v) => update((c) => { c.widgets.visualizer.position = v; })} options={[{ value: "bottom-center", label: "Bottom" }, { value: "top-center", label: "Top" }]} />
          <Slider label="Bars" value={w.visualizer.bars} min={8} max={64} step={1} onChange={(v) => update((c) => { c.widgets.visualizer.bars = v; })} />
          <Slider label="Height" value={w.visualizer.height} min={0.05} max={0.5} onChange={(v) => update((c) => { c.widgets.visualizer.height = v; })} format={pct} />
          <Slider label="Sensitivity" value={w.visualizer.sensitivity} min={0.2} max={3} onChange={(v) => update((c) => { c.widgets.visualizer.sensitivity = v; })} format={times} />
          <Common k="visualizer" noPosition />
        </WidgetCard>

        <WidgetCard k="sysmon" title="System monitor" subtitle="CPU, memory and battery" icon="performance">
          <Toggle label="CPU" value={w.sysmon.showCpu} onChange={(v) => update((c) => { c.widgets.sysmon.showCpu = v; })} />
          <Toggle label="Memory" value={w.sysmon.showRam} onChange={(v) => update((c) => { c.widgets.sysmon.showRam = v; })} />
          <Toggle label="Battery (laptops)" value={w.sysmon.showBattery} onChange={(v) => update((c) => { c.widgets.sysmon.showBattery = v; })} />
          <Common k="sysmon" />
        </WidgetCard>

        <WidgetCard k="text" title="Text & quote" subtitle="A motto, reminder or name" icon="edit">
          <Field label="Text" stacked><LazyInput value={w.text.text} onCommit={(v) => update((c) => { c.widgets.text.text = v; })} /></Field>
          <Field label="Subtitle" stacked><LazyInput value={w.text.subtitle} placeholder="optional" onCommit={(v) => update((c) => { c.widgets.text.subtitle = v; })} /></Field>
          <Select label="Style" value={w.text.style} onChange={(v) => update((c) => { c.widgets.text.style = v; })} options={[{ value: "thin", label: "Thin" }, { value: "bold", label: "Bold" }, { value: "serif", label: "Serif" }]} />
          <Common k="text" />
        </WidgetCard>

        <WidgetCard k="countdown" title="Countdown" subtitle="Days until something you're looking forward to" icon="automation">
          <Field label="Title" stacked><LazyInput value={w.countdown.title} onCommit={(v) => update((c) => { c.widgets.countdown.title = v; })} /></Field>
          <Field label="Date & time"><input className="input" type="datetime-local" value={w.countdown.target} onChange={(e) => update((c) => { c.widgets.countdown.target = e.target.value; })} /></Field>
          <Common k="countdown" />
        </WidgetCard>
      </div>
    </div>
  );
}
