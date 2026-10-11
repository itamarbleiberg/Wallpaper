import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "../shared/ipc";
import { Icon } from "./icons";
import { useStore, type Page } from "./store";

interface Action { id: string; label: string; detail: string; icon: string; run: () => void | Promise<void> }

const NAV: { page: Page; label: string; icon: string }[] = [
  { page: "gallery", label: "Open Gallery", icon: "gallery" },
  { page: "editor", label: "Open Editor", icon: "edit" },
  { page: "widgets", label: "Open Widgets", icon: "widgets" },
  { page: "automation", label: "Open Automation", icon: "automation" },
  { page: "displays", label: "Open Displays", icon: "displays" },
  { page: "performance", label: "Open Performance", icon: "performance" },
  { page: "settings", label: "Open Settings", icon: "settings" },
  { page: "help", label: "Open Help Center", icon: "info" },
];

/** Ctrl+K command center: pages, playback actions, repair, and wallpaper search. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, go, select, edit, applyPreset, notify } = useStore();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    setQ("");
    setIndex(0);
    requestAnimationFrame(() => input.current?.focus());
    const close = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      requestAnimationFrame(() => previousFocus.current?.focus());
    };
  }, [open, onClose]);

  const actions = useMemo<Action[]>(() => {
    if (!config) return [];
    const call = (cmd: string, args?: Record<string, unknown>) => async () => { await invoke(cmd, args); };
    const basic: Action[] = [
      { id: "pause", label: config.paused ? "Resume wallpapers" : "Pause wallpapers", detail: "Playback", icon: config.paused ? "play" : "pause", run: call("set_paused", { paused: !config.paused }) },
      { id: "next", label: "Next wallpaper", detail: "Playback", icon: "next", run: call("step_wallpaper", { dir: 1 }) },
      { id: "prev", label: "Previous wallpaper", detail: "Playback", icon: "prev", run: call("step_wallpaper", { dir: -1 }) },
      { id: "random", label: "Surprise me", detail: "Playback", icon: "shuffle", run: call("step_wallpaper", { dir: 0 }) },
      { id: "reattach", label: "Re-attach wallpapers to desktop", detail: "Repair", icon: "reset", run: async () => { await invoke("reattach"); notify("Re-attached wallpaper windows"); } },
    ];
    const pages: Action[] = NAV.map((n) => ({ id: `page-${n.page}`, label: n.label, detail: "Navigate", icon: n.icon, run: () => go(n.page) }));
    const walls: Action[] = config.presets.map((p) => ({
      id: `wall-${p.id}`,
      label: `Apply: ${p.name}`,
      detail: p.category,
      icon: p.kind === "water" ? "water" : p.kind === "video" ? "video" : p.kind === "image" ? "image" : "code",
      run: () => { applyPreset(p.id); select(p.id); edit(p.id); },
    }));
    return [...basic, ...pages, ...walls];
  }, [config, go, select, edit, applyPreset, notify]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? actions.filter((a) => `${a.label} ${a.detail}`.toLowerCase().includes(needle)) : actions;
  }, [actions, q]);
  useEffect(() => setIndex((i) => Math.min(i, Math.max(0, filtered.length - 1))), [filtered.length]);
  if (!open) return null;

  const run = async (a: Action) => {
    onClose();
    try { await a.run(); }
    catch (e) { notify(`Command failed: ${String(e)}`, "error"); }
  };

  return (
    <div className="cmd-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmd" role="dialog" aria-modal="true" aria-label="Command center">
        <div className="cmd-input">
          <Icon name="search" size={18} />
          <input ref={input} value={q} placeholder="Search commands and wallpapers…" onChange={(e) => { setQ(e.target.value); setIndex(0); }} onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(filtered.length - 1, i + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter" && filtered[index]) { e.preventDefault(); run(filtered[index]); }
          }} />
        </div>
        <div className="cmd-list">
          {filtered.map((a, i) => <button key={a.id} className={i === index ? "active" : ""} onMouseEnter={() => setIndex(i)} onClick={() => run(a)}><Icon name={a.icon} size={16} /><span>{a.label}</span><small>{a.detail}</small></button>)}
          {!filtered.length && <div className="cmd-empty">No commands or wallpapers match “{q}”.</div>}
        </div>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> select</span><span><kbd>Esc</kbd> close</span></footer>
      </div>
    </div>
  );
}
