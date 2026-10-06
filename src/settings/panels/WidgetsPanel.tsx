import { useState } from "react";
import type { WidgetBase, WidgetPosition, WidgetsConfig } from "../../shared/types";
import { Color, Section, Select, Slider, Toggle, pct, times } from "../controls";
import { useStore } from "../store";

const POSITIONS: { value: WidgetPosition; label: string }[] = [
  { value: "top-left", label: "Top left" }, { value: "top-center", label: "Top center" }, { value: "top-right", label: "Top right" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom left" }, { value: "bottom-center", label: "Bottom center" }, { value: "bottom-right", label: "Bottom right" },
];

function Common<K extends keyof Omit<WidgetsConfig, "allDisplays">>({ k }: { k: K }) {
  const { config, update } = useStore();
  const w = config!.widgets[k] as WidgetBase;
  const set = <F extends keyof WidgetBase>(f: F, v: WidgetBase[F]) => update((c) => { (c.widgets[k] as WidgetBase)[f] = v; });
  return (
    <>
      <Select label="Position" value={w.position} onChange={(v) => set("position", v)} options={POSITIONS} />
      <Slider label="Size" value={w.scale} min={0.5} max={3} onChange={(v) => set("scale", v)} format={times} />
      <Color label="Color" value={w.color} onChange={(v) => set("color", v)} />
      <Slider label="Opacity" value={w.opacity} min={0.1} max={1} onChange={(v) => set("opacity", v)} format={pct} />
    </>
  );
}

export function WidgetsPanel() {
  const { config, update, notify } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ name: string; country: string; latitude: number; longitude: number }[]>([]);
  if (!config) return null;
  const w = config.widgets;

  const search = async () => {
    try {
      const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`)).json();
      setResults(j.results ?? []);
      if (!j.results?.length) notify("No places found");
    } catch {
      notify("Location search failed (offline?)");
    }
  };

  return (
    <>
      <Section title="General">
        <Toggle label="Show widgets on all displays" value={w.allDisplays} onChange={(v) => update((c) => { c.widgets.allDisplays = v; })} hint="Otherwise widgets appear on the primary display only" />
      </Section>
      <Section title="Clock" right={<Toggle label="" value={w.clock.enabled} onChange={(v) => update((c) => { c.widgets.clock.enabled = v; })} />}>
        {w.clock.enabled && (
          <>
            <Toggle label="24-hour" value={w.clock.format24} onChange={(v) => update((c) => { c.widgets.clock.format24 = v; })} />
            <Toggle label="Seconds" value={w.clock.showSeconds} onChange={(v) => update((c) => { c.widgets.clock.showSeconds = v; })} />
            <Toggle label="Date" value={w.clock.showDate} onChange={(v) => update((c) => { c.widgets.clock.showDate = v; })} />
            <Common k="clock" />
          </>
        )}
      </Section>
      <Section title="Weather" right={<Toggle label="" value={w.weather.enabled} onChange={(v) => update((c) => { c.widgets.weather.enabled = v; })} />}>
        {w.weather.enabled && (
          <>
            <div className="row"><span className="row-label">Location</span><span>{w.weather.place} <span className="dim mono">({w.weather.latitude.toFixed(2)}, {w.weather.longitude.toFixed(2)})</span></span></div>
            <div className="url-row">
              <input className="text" placeholder="Search city…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
              <button className="btn" onClick={search}>Search</button>
            </div>
            {results.map((r) => (
              <button key={`${r.latitude},${r.longitude}`} className="btn ghost small block" onClick={() => { update((c) => { Object.assign(c.widgets.weather, { place: r.name, latitude: r.latitude, longitude: r.longitude }); }); setResults([]); }}>
                {r.name}, {r.country}
              </button>
            ))}
            <Select label="Units" value={w.weather.units} onChange={(v) => update((c) => { c.widgets.weather.units = v; })} options={[{ value: "celsius", label: "°C" }, { value: "fahrenheit", label: "°F" }]} />
            <Common k="weather" />
            <div className="dim small">Weather data by Open-Meteo.</div>
          </>
        )}
      </Section>
      <Section title="Audio visualizer" right={<Toggle label="" value={w.visualizer.enabled} onChange={(v) => update((c) => { c.widgets.visualizer.enabled = v; })} />}>
        {w.visualizer.enabled && (
          <>
            <p className="dim small">Visualizes whatever your PC is playing (system audio loopback). Shader wallpapers can also react via <code>iChannel0</code>.</p>
            <Select label="Style" value={w.visualizer.style} onChange={(v) => update((c) => { c.widgets.visualizer.style = v; })} options={[{ value: "bars", label: "Bars" }, { value: "mirror", label: "Mirrored bars" }, { value: "wave", label: "Wave line" }]} />
            <Slider label="Bars" value={w.visualizer.bars} min={8} max={64} step={1} onChange={(v) => update((c) => { c.widgets.visualizer.bars = v; })} />
            <Slider label="Height" value={w.visualizer.height} min={0.05} max={0.5} onChange={(v) => update((c) => { c.widgets.visualizer.height = v; })} format={pct} />
            <Slider label="Sensitivity" value={w.visualizer.sensitivity} min={0.2} max={3} onChange={(v) => update((c) => { c.widgets.visualizer.sensitivity = v; })} format={times} />
            <Select label="Edge" value={w.visualizer.position.startsWith("top") ? "top-center" : "bottom-center"} onChange={(v) => update((c) => { c.widgets.visualizer.position = v; })} options={[{ value: "bottom-center", label: "Bottom" }, { value: "top-center", label: "Top" }]} />
            <Color label="Color" value={w.visualizer.color} onChange={(v) => update((c) => { c.widgets.visualizer.color = v; })} />
            <Slider label="Opacity" value={w.visualizer.opacity} min={0.1} max={1} onChange={(v) => update((c) => { c.widgets.visualizer.opacity = v; })} format={pct} />
          </>
        )}
      </Section>
      <Section title="System monitor" right={<Toggle label="" value={w.sysmon.enabled} onChange={(v) => update((c) => { c.widgets.sysmon.enabled = v; })} />}>
        {w.sysmon.enabled && (
          <>
            <Toggle label="CPU" value={w.sysmon.showCpu} onChange={(v) => update((c) => { c.widgets.sysmon.showCpu = v; })} />
            <Toggle label="RAM" value={w.sysmon.showRam} onChange={(v) => update((c) => { c.widgets.sysmon.showRam = v; })} />
            <Common k="sysmon" />
          </>
        )}
      </Section>
    </>
  );
}
