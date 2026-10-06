import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { SysStats, WidgetBase, WidgetPosition, WidgetsConfig } from "../shared/types";
import { listen } from "../shared/ipc";

function place(pos: WidgetPosition): CSSProperties {
  const m = "3vmin";
  const s: CSSProperties = { position: "absolute" };
  if (pos.startsWith("top")) s.top = m;
  if (pos.startsWith("bottom")) s.bottom = m;
  if (pos.endsWith("left")) s.left = m;
  if (pos.endsWith("right")) s.right = m;
  if (pos.endsWith("center") || pos === "center") {
    s.left = "50%";
    s.transform = "translateX(-50%)";
  }
  if (pos === "center") {
    s.top = "50%";
    s.transform = "translate(-50%, -50%)";
  }
  return s;
}

function Frame({ w, children, className = "" }: { w: WidgetBase; children: ReactNode; className?: string }) {
  const align = w.position.endsWith("right") ? "flex-end" : w.position.endsWith("left") ? "flex-start" : "center";
  return (
    <div className={`aq-widget ${className}`} style={{ ...place(w.position), color: w.color, opacity: w.opacity, fontSize: `${w.scale}em`, alignItems: align }}>
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
    <Frame w={w} className="aq-clock">
      <div className="aq-clock-time">{time}</div>
      {w.showDate && <div className="aq-clock-date">{date}</div>}
    </Frame>
  );
}

const WMO: Record<number, [string, string]> = {
  0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"], 48: ["🌫️", "Rime fog"], 51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
  61: ["🌦️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"], 71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"],
  75: ["❄️", "Heavy snow"], 80: ["🌦️", "Showers"], 81: ["🌧️", "Showers"], 82: ["⛈️", "Violent showers"],
  95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunder & hail"], 99: ["⛈️", "Thunder & hail"],
};

export function Weather({ w }: { w: WidgetsConfig["weather"] }) {
  const [data, setData] = useState<{ temp: number; code: number; wind: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${w.latitude}&longitude=${w.longitude}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=${w.units}`;
        const j = await (await fetch(u)).json();
        if (alive) setData({ temp: j.current.temperature_2m, code: j.current.weather_code, wind: j.current.wind_speed_10m });
      } catch {
        /* offline: keep last value */
      }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [w.latitude, w.longitude, w.units]);
  if (!data) return null;
  const [icon, label] = WMO[data.code] ?? ["🌡️", ""];
  return (
    <Frame w={w} className="aq-weather">
      <div className="aq-weather-main">
        <span className="aq-weather-icon">{icon}</span>
        <span>{Math.round(data.temp)}°{w.units === "celsius" ? "C" : "F"}</span>
      </div>
      <div className="aq-weather-sub">{w.place} · {label} · {Math.round(data.wind)} km/h</div>
    </Frame>
  );
}

function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="aq-ring">
      <svg viewBox="0 0 64 64" width="4.2em" height="4.2em">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(c * Math.min(100, value)) / 100} ${c}`} transform="rotate(-90 32 32)" style={{ transition: "stroke-dasharray 0.8s ease" }} />
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
      </div>
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
    ctx.fillStyle = w.color;
    ctx.strokeStyle = w.color;
    ctx.shadowColor = w.color;
    ctx.shadowBlur = 12 * dpr;
    const bw = W / n;
    if (w.style === "wave") {
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = i * bw + bw / 2;
        const y = H - v * H * 0.95;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      vals.forEach((v, i) => {
        const bh = Math.max(2 * dpr, v * H * (w.style === "mirror" ? 0.5 : 1));
        const x = i * bw + bw * 0.15;
        if (w.style === "mirror") ctx.fillRect(x, H / 2 - bh, bw * 0.7, bh * 2);
        else ctx.fillRect(x, H - bh, bw * 0.7, bh);
      });
    }
  }, [spectrum, w, paused]);
  const top = w.position.startsWith("top");
  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", left: "10%", width: "80%", height: `${w.height * 100}%`, [top ? "top" : "bottom"]: 0, opacity: w.opacity, pointerEvents: "none" }}
    />
  );
}

export function Widgets({ config, spectrum, paused }: { config: WidgetsConfig; spectrum: number[]; paused: boolean }) {
  return (
    <div className="aq-widgets">
      {config.visualizer.enabled && <Visualizer w={config.visualizer} spectrum={spectrum} paused={paused} />}
      {config.clock.enabled && <Clock w={config.clock} />}
      {config.weather.enabled && (
        <Weather w={{ ...config.weather, position: config.clock.enabled && config.clock.position === config.weather.position ? shift(config.weather.position) : config.weather.position }} />
      )}
      {config.sysmon.enabled && <SysMon w={config.sysmon} />}
    </div>
  );
}

/** Avoid stacking weather exactly on top of the clock. */
function shift(p: WidgetPosition): WidgetPosition {
  if (p.startsWith("top")) return p.replace("top", "bottom") as WidgetPosition;
  if (p.startsWith("bottom")) return p.replace("bottom", "top") as WidgetPosition;
  return "top-center";
}
