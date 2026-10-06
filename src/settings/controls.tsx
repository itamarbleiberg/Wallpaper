import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";

export function Card({ title, subtitle, icon, children, right, className = "" }: { title?: string; subtitle?: string; icon?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="card-head">
          <div className="card-title">
            {icon && <span className="card-icon"><Icon name={icon} size={16} /></span>}
            <div>
              {title && <h3>{title}</h3>}
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          {right && <div className="card-right">{right}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, stacked }: { label: string; hint?: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={`field ${stacked ? "stacked" : ""}`}>
      <div className="field-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="field-control">{children}</div>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 0.01, onChange, format, hint }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string; hint?: string;
}) {
  const pctv = ((value - min) / (max - min)) * 100;
  return (
    <Field label={label} hint={hint}>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ["--fill" as string]: `${Math.max(0, Math.min(100, pctv))}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => undefined}
      />
      <span className="value">{format ? format(value) : value.toFixed(step >= 1 ? 0 : 2)}</span>
    </Field>
  );
}

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" className={`switch ${value ? "on" : ""}`} onClick={() => onChange(!value)} aria-pressed={value} aria-label={label}>
      <span />
    </button>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Switch value={value} onChange={onChange} label={label} />
    </Field>
  );
}

export function Select<T extends string>({ label, value, options, onChange, hint }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <label className="color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="mono">{value.toUpperCase()}</span>
      </label>
    </Field>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly { value: T; label: string; icon?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, onEnter, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; onEnter?: () => void; mono?: boolean }) {
  return (
    <input
      className={`input ${mono ? "mono" : ""}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
    />
  );
}

/** Text input that only commits on blur/Enter (avoids saving every keystroke). */
export function LazyInput({ value, onCommit, placeholder, type = "text" }: { value: string; onCommit: (v: string) => void; placeholder?: string; type?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className="input"
      type={type}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

export function Button({ children, onClick, kind = "default", icon, disabled, small, title }: {
  children?: ReactNode; onClick?: () => void; kind?: "default" | "primary" | "ghost" | "danger"; icon?: string; disabled?: boolean; small?: boolean; title?: string;
}) {
  return (
    <button type="button" className={`btn ${kind} ${small ? "small" : ""} ${children ? "" : "icon-only"}`} onClick={onClick} disabled={disabled} title={title}>
      {icon && <Icon name={icon} size={small ? 14 : 16} />}
      {children}
    </button>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: readonly { id: T; label: string }[]; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" className={t.id === value ? "active" : ""} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <header><h3>{title}</h3><Button kind="ghost" icon="x" onClick={onClose} small /></header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function Note({ children, kind = "info" }: { children: ReactNode; kind?: "info" | "warn" | "error" | "ok" }) {
  return <div className={`note ${kind}`}><Icon name={kind === "ok" ? "check" : "info"} size={15} /><div>{children}</div></div>;
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const times = (v: number) => `${v.toFixed(2)}×`;
export function fmtTime(s: number) {
  if (!Number.isFinite(s)) return "0:00.00";
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
}
