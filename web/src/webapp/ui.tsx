import type { ReactNode } from "react";

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="w-row" title={hint}>
      <span className="w-row-label">{label}</span>
      <span className="w-row-ctl">{children}</span>
    </label>
  );
}

export function Slider({ label, value, min, max, step = 0.01, onChange, format, hint }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; hint?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <Row label={label} hint={hint}>
      <input className="w-range" type="range" min={min} max={max} step={step} value={value} style={{ ["--fill" as string]: `${Math.max(0, Math.min(100, fill))}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-val">{format ? format(value) : value.toFixed(step >= 1 ? 0 : 2)}</span>
    </Row>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Row label={label} hint={hint}>
      <button type="button" className={`w-switch ${value ? "on" : ""}`} onClick={() => onChange(!value)} aria-pressed={value}><span /></button>
    </Row>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Row label={label}>
      <select className="w-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Row>
  );
}

export function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <input className="w-color" type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </Row>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="w-seg">
      {options.map((o) => <button key={o.value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const times = (v: number) => `${v.toFixed(2)}×`;
