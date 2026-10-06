import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { SysStats, WidgetBase, WidgetPosition, WidgetsConfig } from "../shared/types";
import { listen } from "../shared/ipc";

export interface WeatherData { temp: number; code: number; wind: number; isDay: boolean }

const WMO: Record<number, [string, string]> = {
  0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"], 48: ["🌫️", "Rime fog"], 51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
  56: ["🌧️", "Freezing drizzle"], 57: ["🌧️", "Freezing drizzle"],
  61: ["🌦️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"], 66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"],
  71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"], 77: ["🌨️", "Snow grains"],
  80: ["🌦️", "Showers"], 81: ["🌧️", "Showers"], 82: ["⛈️", "Violent showers"], 85: ["🌨️", "Snow showers"], 86: ["🌨️", "Snow showers"],
  95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunder & hail"], 99: ["⛈️", "Thunder & hail"],
};

/** 0..1 rain intensity from a WMO weather code. */
export function rainFromCode(code: number): number {
  if (code >= 51 && code <= 57) return 0.25;
  if (code === 61 || code === 80) return 0.45;
  if (code === 63 || code === 66 || code === 81) return 0.7;
  if (code === 65 || code === 67 || code === 82) return 1;
  if (code >= 95) return 1;
  return 0;
}

export function useWeather(lat: number, lon: number, units: string, enabled: boolean): WeatherData | null {
  const [data, setData] = useState<WeatherData | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day&temperature_unit=${units}`;
        const j = await (await fetch(u)).json();
        if (alive && j.current) setData({ temp: j.current.temperature_2m, code: j.current.weather_code, wind: j.current.wind_speed_10m, isDay: j.current.is_day === 1 });
      } catch {
        /* offline: keep last value */
      }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [lat, lon, units, enabled]);
  return enabled ? data : null;
}

function place(pos: WidgetPosition): CSSProperties {
  const m = "3.2vmin";
  const s: CSSProperties = { position: "absolute" };
  if (pos.startsWith("top")) s.top = m;
  if (pos.startsWith("bottom")) s.bottom = m;
  if (pos.endsWith("left")) s.left = m;
  if (pos.endsWith("right")) s.right = m;
  if (pos.endsWith("center") || pos === "center") { s.left = "50%"; s.transform = "translateX(-50%)"; }
  if (pos === "center") { s.top = "50%"; s.transform = "translate(-50%, -50%)"; }
  return s;
}

function Frame({ w, children, className = "", offset = 0 }: { w: WidgetBase; children: ReactNode; className?: string; offset?: number }) {
  const align = w.position.endsWith("right") ? "flex-end" : w.position.endsWith("left") ? "flex-start" : "center";
  const st = place(w.position);
  if (offset && st.top !== undefined && st.top !== "50%") st.top = `calc(3.2vmin + ${offset}em)`;
  if (offset && st.bottom !== undefined) st.bottom = `calc(3.2vmin + ${offset}em)`;
  return (
    <div className={`aq-widget ${className}`} style={{ ...st, color: w.color, opacity: w.opacity, fontSize: `${w.scale}em`, alignItems: align, textAlign: align === "center" ? "center" : align === "flex-end" ? "right" : "left" }}>
      {children}
    </div>
  );
}

export function Clock({ w }: { w: WidgetsConfig["clock"] }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), w.showSeconds ? 1000 : 5000);
    return () => clearInterval(id);
  }, [w.showSeconds]);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: w.showSeconds ? "2-digit" : undefined, hour12: !w.format24 }).format(now);
  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);
  return (
    <Frame w={w} className={`aq-clock style-${w.style}`}>
      <div className="aq-clock-time">{time}</div>
      {w.showDate && <div className="aq-clock-date">{date}</div>}
    </Frame>
  );
}

export function Weather({ w, data, offset }: { w: WidgetsConfig["weather"]; data: WeatherData | null; offset: number }) {
  if (!data) return null;
  const [icon, label] = WMO[data.code] ?? ["🌡️", ""];
  return (
    <Frame w={w} className="aq-weather" offset={offset}>
      <div className="aq-weather-main"><span className="aq-weather-icon">{data.isDay || data.code > 3 ? icon : "🌙"}</span><span>{Math.round(data.temp)}°</span></div>
      <div className="aq-weather-sub">{w.place} · {label} · {Math.round(data.wind)} km/h</div>
    </Frame>
  );
}

function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="aq-ring">
      <svg viewBox="0 0 64 64" width="4.4em" height="4.4em">
        <circle cx="32" cy="32" r={r} fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(c * Math.min(100, value)) / 100} ${c}`} transform="rotate(-90 32 32)" style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x="32" y="37" textAnchor="middle" fontSize="15" fill="currentColor" fontWeight="600">{Math.round(value)}%</text>
      </svg>
      <div className="aq-ring-label">{label}</div>
    </div>
  );
}

export function SysMon({ w }: { w: WidgetsConfig["sysmon"] }) {
  const [s, setS] = useState<SysStats | null>(null);
  useEffect(() => {
    let un: (() => void) | undefined;
    listen<SysStats>("sys-stats", setS).then((u) => (un = u));
    return () => un?.();
  }, []);
  if (!s) return null;
  return (
    <Frame w={w} className="aq-sysmon">
      <div style={{ display: "flex", gap: "1em" }}>
        {w.showCpu && <Ring value={s.cpu} label="CPU" color={w.color} />}
        {w.showRam && <Ring value={s.mem} label={`RAM ${s.memUsedGb.toFixed(1)}/${s.memTotalGb.toFixed(0)} GB`} color={w.color} />}
        {w.showBattery && s.battery != null && <Ring value={s.battery} label={s.charging ? "Battery ⚡" : "Battery"} color={w.color} />}
      </div>
    </Frame>
  );
}

export function TextWidget({ w }: { w: WidgetsConfig["text"] }) {
  if (!w.text.trim() && !w.subtitle.trim()) return null;
  return (
    <Frame w={w} className={`aq-text style-${w.style}`}>
      <div className="aq-text-main">{w.text}</div>
      {w.subtitle && <div className="aq-text-sub">{w.subtitle}</div>}
    </Frame>
  );
}

export function Countdown({ w }: { w: WidgetsConfig["countdown"] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(w.target).getTime();
  if (!Number.isFinite(target)) return null;
  let d = Math.max(0, target - now) / 1000;
  const days = Math.floor(d / 86400); d -= days * 86400;
  const hours = Math.floor(d / 3600); d -= hours * 3600;
  const mins = Math.floor(d / 60);
  const secs = Math.floor(d - mins * 60);
  const done = target <= now;
  return (
    <Frame w={w} className="aq-countdown">
      <div className="aq-cd-title">{w.title}</div>
      {done ? <div className="aq-cd-done">It's here! 🎉</div> : (
        <div className="aq-cd-grid">
          {[["days", days], ["hrs", hours], ["min", mins], ["sec", secs]].map(([l, v]) => (
            <div key={l as string}><b>{String(v).padStart(2, "0")}</b><span>{l}</span></div>
          ))}
        </div>
      )}
    </Frame>
  );
}

export function Visualizer({ w, spectrum, paused }: { w: WidgetsConfig["visualizer"]; spectrum: number[]; paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const smooth = useRef<number[]>([]);
  useEffect(() => {
    const c = ref.current;
    if (!c || paused) return;
    const dpr = devicePixelRatio || 1;
    const W = (c.width = Math.round(c.clientWidth * dpr));
    const H = (c.height = Math.round(c.clientHeight * dpr));
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const n = Math.max(8, Math.min(64, w.bars));
    const vals: number[] = [];
    for (let i = 0; i < n; i++) {
      const src = spectrum.length ? spectrum[Math.floor((i / n) * spectrum.length)] ?? 0 : 0;
      const prev = smooth.current[i] ?? 0;
      vals[i] = prev + (Math.min(1, src * w.sensitivity) - prev) * 0.5;
    }
    smooth.current = vals;
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, w.color);
    grad.addColorStop(1, "#ffffff");
    ctx.fillStyle = grad;
    ctx.strokeStyle = w.color;
    ctx.shadowColor = w.color;
    ctx.shadowBlur = 14 * dpr;
    const bw = W / n;
    const top = w.position.startsWith("top");
    if (w.style === "wave") {
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = i * bw + bw / 2;
        const y = top ? v * H * 0.95 : H - v * H * 0.95;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      vals.forEach((v, i) => {
        const bh = Math.max(2 * dpr, v * H * (w.style === "mirror" ? 0.5 : 1));
        const x = i * bw + bw * 0.18;
        const rw = bw * 0.64;
        if (w.style === "mirror") ctx.fillRect(x, H / 2 - bh, rw, bh * 2);
        else ctx.fillRect(x, top ? 0 : H - bh, rw, bh);
      });
    }
  }, [spectrum, w, paused]);
  const top = w.position.startsWith("top");
  return <canvas ref={ref} style={{ position: "absolute", left: "8%", width: "84%", height: `${w.height * 100}%`, [top ? "top" : "bottom"]: 0, opacity: w.opacity, pointerEvents: "none" }} />;
}

export function Widgets({ config, spectrum, paused, weather }: { config: WidgetsConfig; spectrum: number[]; paused: boolean; weather: WeatherData | null }) {
  // Stack weather under the clock when both share a corner.
  const sameCorner = config.clock.enabled && config.clock.position === config.weather.position;
  const offset = sameCorner ? (config.clock.showDate ? 7.2 : 5.6) * config.clock.scale / Math.max(0.5, config.weather.scale) : 0;
  return (
    <div className="aq-widgets">
      {config.visualizer.enabled && <Visualizer w={config.visualizer} spectrum={spectrum} paused={paused} />}
      {config.clock.enabled && <Clock w={config.clock} />}
      {config.weather.enabled && <Weather w={config.weather} data={weather} offset={offset} />}
      {config.sysmon.enabled && <SysMon w={config.sysmon} />}
      {config.text.enabled && <TextWidget w={config.text} />}
      {config.countdown.enabled && <Countdown w={config.countdown} />}
    </div>
  );
}
