import { create } from "zustand";
import { invoke, listen } from "../shared/ipc";
import type { AppConfig, Category, JobEvent, LibraryItem, MonitorInfo, PlaybackState, Preset, PresetKind, ToolStatus, WallpaperTarget } from "../shared/types";
import { builtinPresets, makePreset, normalizeConfig, uid } from "../shared/types";

export type Page = "gallery" | "editor" | "widgets" | "automation" | "displays" | "performance" | "settings";

interface JobInfo extends JobEvent { label: string; onDone?: (path: string) => void }

interface UpdateOpts { immediate?: boolean; history?: boolean }

interface Store {
  config: AppConfig | null;
  page: Page;
  selectedId: string;
  editorTab: string;
  monitors: MonitorInfo[];
  targets: WallpaperTarget[];
  playback: Record<string, PlaybackState>;
  tools: ToolStatus | null;
  jobs: Record<string, JobInfo>;
  previewError: { shader: string | null; video: string | null; image: string | null };
  videoTime: { t: number; duration: number };
  toast: { msg: string; kind: "info" | "error" } | null;
  hotkeyErrors: string[];
  past: AppConfig[];
  future: AppConfig[];
  search: string;
  category: Category | "all" | "favorites";

  init(): Promise<void>;
  go(page: Page): void;
  edit(id: string, tab?: string): void;
  select(id: string): void;
  setEditorTab(t: string): void;
  update(fn: (c: AppConfig) => void, opts?: UpdateOpts): Promise<void>;
  updatePreset(fn: (p: Preset) => void): void;
  selected(): Preset | null;
  applyPreset(id: string, monitorId?: string): void;
  ensureNature(id: string): Promise<void>;
  addMedia(path: string, kind: "video" | "image", source: LibraryItem["source"], name?: string, url?: string): Promise<Preset>;
  createPreset(kind: PresetKind, name: string, patch?: Partial<Preset>): Preset;
  duplicate(id: string): void;
  remove(id: string): void;
  resetPreset(id: string): void;
  toggleFavorite(id: string): void;
  undo(): void;
  redo(): void;
  startJob(id: string, label: string, onDone?: (path: string) => void): void;
  notify(msg: string, kind?: "info" | "error"): void;
  setSearch(s: string): void;
  setCategory(c: Store["category"]): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastSent = "";
let lastHistoryAt = 0;

function fileName(p: string) {
  const n = p.split(/[\\/]/).pop() ?? p;
  return n.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").slice(0, 60) || "Untitled";
}

export const useStore = create<Store>()((set, get) => ({
  config: null,
  page: "gallery",
  selectedId: "builtin-pool",
  editorTab: "",
  monitors: [],
  targets: [],
  playback: {},
  tools: null,
  jobs: {},
  previewError: { shader: null, video: null, image: null },
  videoTime: { t: 0, duration: 0 },
  toast: null,
  hotkeyErrors: [],
  past: [],
  future: [],
  search: "",
  category: "all",

  async init() {
    const raw = await invoke<unknown>("get_config");
    const config = normalizeConfig(raw);
    set({ config, selectedId: config.display.defaultPresetId });
    lastSent = JSON.stringify(config);
    await invoke("set_config", { config });
    const [monitors, targets, tools, playback, hotkeyErrors] = await Promise.all([
      invoke<MonitorInfo[]>("list_monitors"),
      invoke<WallpaperTarget[]>("get_targets"),
      invoke<ToolStatus>("tool_status"),
      invoke<Record<string, PlaybackState>>("get_playback"),
      invoke<string[]>("hotkey_errors").catch(() => [] as string[]),
    ]);
    set({ monitors, targets, tools, playback: playback ?? {}, hotkeyErrors: hotkeyErrors ?? [] });

    await listen<unknown>("config-changed", (c) => {
      const s = JSON.stringify(c);
      if (s === lastSent) return;
      lastSent = s;
      set({ config: normalizeConfig(c) });
    });
    await listen<WallpaperTarget[]>("targets-changed", async (targets) => {
      set({ targets, monitors: await invoke<MonitorInfo[]>("list_monitors") });
    });
    await listen<Record<string, PlaybackState>>("playback", (playback) => set({ playback }));
    await listen<JobEvent>("job-progress", (e) => {
      const prev = get().jobs[e.id];
      const job: JobInfo = { ...(prev ?? { label: e.kind }), ...e };
      set({ jobs: { ...get().jobs, [e.id]: job } });
      if (e.status === "done" && e.path && prev?.onDone) prev.onDone(e.path);
      if (e.status === "error") get().notify(`${job.label} failed`, "error");
    });
  },

  go: (page) => set({ page }),
  edit: (id, tab) => set({ selectedId: id, page: "editor", editorTab: tab ?? "" }),
  select: (id) => set({ selectedId: id }),
  setEditorTab: (editorTab) => set({ editorTab }),
  setSearch: (search) => set({ search }),
  setCategory: (category) => set({ category }),

  async update(fn, opts = {}) {
    const cur = get().config;
    if (!cur) return;
    const next = structuredClone(cur);
    fn(next);
    const now = Date.now();
    if (opts.history !== false && now - lastHistoryAt > 700) {
      set({ past: [...get().past.slice(-59), cur], future: [] });
    }
    lastHistoryAt = now;
    set({ config: next });
    const send = async () => {
      const cfg = get().config!;
      lastSent = JSON.stringify(cfg);
      const errs = await invoke<string[] | undefined>("set_config", { config: cfg });
      if (Array.isArray(errs)) set({ hotkeyErrors: errs });
    };
    clearTimeout(saveTimer);
    if (opts.immediate) await send();
    else saveTimer = setTimeout(send, 150);
  },

  updatePreset(fn) {
    const id = get().selectedId;
    get().update((c) => {
      const p = c.presets.find((x) => x.id === id);
      if (p) fn(p);
    });
  },

  selected() {
    const { config, selectedId } = get();
    return config?.presets.find((p) => p.id === selectedId) ?? config?.presets[0] ?? null;
  },

  applyPreset(id, monitorId) {
    get().ensureNature(id);
    get().update((c) => {
      if (monitorId && c.display.layout === "independent") c.display.assignments[monitorId] = id;
      else if (monitorId && c.display.layout === "span") c.display.assignments.span = id;
      else {
        c.display.defaultPresetId = id;
        c.display.assignments = {};
      }
    }, { immediate: true });
  },

  /** Download a built-in nature clip on first use, then store its local path. */
  async ensureNature(id) {
    const p = get().config?.presets.find((x) => x.id === id);
    if (!p || p.kind !== "video" || !p.video.sourceUrl || p.video.path) return;
    try {
      const res = await invoke<{ path: string; jobId: string | null }>("ensure_nature", { presetId: id, url: p.video.sourceUrl });
      if (res.path) {
        get().update((c) => { const pr = c.presets.find((x) => x.id === id); if (pr) pr.video.path = res.path; }, { immediate: true });
      } else if (res.jobId) {
        get().startJob(res.jobId, `Fetch ${p.name}`, (path) => {
          get().update((c) => { const pr = c.presets.find((x) => x.id === id); if (pr) pr.video.path = path; }, { immediate: true });
          get().notify(`${p.name} is ready`);
        });
        get().notify(`Downloading ${p.name}…`);
      }
    } catch (e) {
      get().notify(String(e), "error");
    }
  },

  createPreset(kind, name, patch = {}) {
    const p = makePreset(kind, name, { category: "mine", ...patch });
    get().update((c) => { c.presets.push(p); });
    return p;
  },

  async addMedia(path, kind, source, name, url) {
    const item: LibraryItem = { id: uid("m"), name: name ?? fileName(path), path, source, url, addedAt: Date.now() };
    const preset = makePreset(kind, item.name, { category: "mine" });
    if (kind === "video") preset.video.path = path;
    else {
      preset.image.path = path;
      preset.effects.parallax = 0.3;
    }
    await get().update((c) => {
      if (!c.library.some((l) => l.path === path)) c.library.push(item);
      c.presets.push(preset);
    }, { immediate: true });
    set({ selectedId: preset.id, page: "editor", editorTab: "" });
    return preset;
  },

  duplicate(id) {
    const src = get().config?.presets.find((p) => p.id === id);
    if (!src) return;
    const copy: Preset = { ...structuredClone(src), id: uid(), name: `${src.name} (copy)`, builtin: false, category: "mine", favorite: false };
    get().update((c) => { c.presets.push(copy); });
    set({ selectedId: copy.id });
    get().notify(`Created “${copy.name}”`);
  },

  remove(id) {
    const p = get().config?.presets.find((x) => x.id === id);
    if (!p || p.builtin) return;
    get().update((c) => {
      c.presets = c.presets.filter((x) => x.id !== id);
      if (c.display.defaultPresetId === id) c.display.defaultPresetId = "builtin-pool";
      for (const [k, v] of Object.entries(c.display.assignments)) if (v === id) delete c.display.assignments[k];
      c.playlist.presetIds = c.playlist.presetIds.filter((x) => x !== id);
      c.schedule.slots = c.schedule.slots.filter((s) => s.presetId !== id);
    }, { immediate: true });
    if (get().selectedId === id) set({ selectedId: "builtin-pool", page: "gallery" });
    get().notify(`Deleted “${p.name}” (Ctrl+Z to undo)`);
  },

  resetPreset(id) {
    get().update((c) => {
      const i = c.presets.findIndex((x) => x.id === id);
      if (i < 0) return;
      const cur = c.presets[i];
      const shipped = builtinPresets().find((b) => b.id === id);
      if (shipped) {
        c.presets[i] = { ...shipped, favorite: cur.favorite };
      } else {
        const fresh = makePreset(cur.kind, cur.name);
        c.presets[i] = { ...fresh, id: cur.id, category: cur.category, favorite: cur.favorite, video: { ...fresh.video, path: cur.video.path }, image: { ...fresh.image, path: cur.image.path }, shader: cur.shader };
      }
    });
    get().notify("Reset to defaults (Ctrl+Z to undo)");
  },

  toggleFavorite(id) {
    get().update((c) => {
      const p = c.presets.find((x) => x.id === id);
      if (p) p.favorite = !p.favorite;
    }, { history: false });
  },

  undo() {
    const { past, config } = get();
    if (!past.length || !config) return;
    const prev = past[past.length - 1];
    set({ past: past.slice(0, -1), future: [config, ...get().future].slice(0, 60) });
    clearTimeout(saveTimer);
    set({ config: prev });
    lastSent = JSON.stringify(prev);
    invoke("set_config", { config: prev });
  },

  redo() {
    const { future, config } = get();
    if (!future.length || !config) return;
    const next = future[0];
    clearTimeout(saveTimer);
    set({ future: future.slice(1), past: [...get().past, config] });
    set({ config: next });
    lastSent = JSON.stringify(next);
    invoke("set_config", { config: next });
  },

  startJob(id, label, onDone) {
    set({ jobs: { ...get().jobs, [id]: { id, kind: "download", status: "running", progress: 0, message: "", label, onDone } } });
  },

  notify(msg, kind = "info") {
    const t = { msg, kind };
    set({ toast: t });
    setTimeout(() => get().toast === t && set({ toast: null }), 4200);
  },
}));
