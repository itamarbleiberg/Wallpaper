import { create } from "zustand";
import { invoke, listen } from "../shared/ipc";
import type { AppConfig, JobEvent, LibraryItem, MonitorInfo, Preset, ToolStatus, WallpaperTarget } from "../shared/types";
import { makePreset, normalizeConfig, uid } from "../shared/types";

export type Tab = "library" | "water" | "video" | "shader" | "effects" | "enhance" | "widgets" | "displays" | "performance";

interface JobInfo extends JobEvent { label: string; onDone?: (path: string) => void }

interface Store {
  config: AppConfig | null;
  selectedId: string;
  tab: Tab;
  monitors: MonitorInfo[];
  targets: WallpaperTarget[];
  tools: ToolStatus | null;
  jobs: Record<string, JobInfo>;
  previewError: { shader: string | null; video: string | null };
  videoTime: { t: number; duration: number };
  toast: string | null;

  init(): Promise<void>;
  setTab(t: Tab): void;
  select(id: string): void;
  update(fn: (c: AppConfig) => void, immediate?: boolean): Promise<void>;
  updatePreset(fn: (p: Preset) => void): void;
  selected(): Preset | null;
  applyPreset(id: string, monitorId?: string): void;
  addVideo(path: string, source: LibraryItem["source"], name?: string, url?: string): Promise<Preset>;
  startJob(id: string, label: string, onDone?: (path: string) => void): void;
  notify(msg: string): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastSent = "";

function fileName(p: string) {
  const n = p.split(/[\\/]/).pop() ?? p;
  return n.replace(/\.[^.]+$/, "");
}

export const useStore = create<Store>()((set, get) => ({
  config: null,
  selectedId: "builtin-pool",
  tab: "library",
  monitors: [],
  targets: [],
  tools: null,
  jobs: {},
  previewError: { shader: null, video: null },
  videoTime: { t: 0, duration: 0 },
  toast: null,

  async init() {
    const raw = await invoke<unknown>("get_config");
    const config = normalizeConfig(raw);
    set({ config, selectedId: config.display.defaultPresetId });
    // Persist normalized config (first run writes defaults).
    lastSent = JSON.stringify(config);
    await invoke("set_config", { config });
    const [monitors, targets, tools] = await Promise.all([
      invoke<MonitorInfo[]>("list_monitors"),
      invoke<WallpaperTarget[]>("get_targets"),
      invoke<ToolStatus>("tool_status"),
    ]);
    set({ monitors, targets, tools });

    await listen<unknown>("config-changed", (c) => {
      const s = JSON.stringify(c);
      if (s === lastSent) return; // our own echo
      lastSent = s;
      set({ config: normalizeConfig(c) });
    });
    await listen<WallpaperTarget[]>("targets-changed", async (targets) => {
      set({ targets, monitors: await invoke<MonitorInfo[]>("list_monitors") });
    });
    await listen<JobEvent>("job-progress", (e) => {
      const prev = get().jobs[e.id];
      const job: JobInfo = { ...(prev ?? { label: e.kind }), ...e };
      set({ jobs: { ...get().jobs, [e.id]: job } });
      if (e.status === "done" && e.path && prev?.onDone) prev.onDone(e.path);
      if (e.status === "error") get().notify(`${job.label} failed`);
    });
  },

  setTab: (tab) => set({ tab }),
  select: (id) => set({ selectedId: id }),

  async update(fn, immediate = false) {
    const cur = get().config;
    if (!cur) return;
    const next = structuredClone(cur);
    fn(next);
    set({ config: next });
    const send = async () => {
      const cfg = get().config!;
      lastSent = JSON.stringify(cfg);
      await invoke("set_config", { config: cfg });
    };
    clearTimeout(saveTimer);
    if (immediate) await send();
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
    get().update((c) => {
      if (monitorId && c.display.layout === "independent") c.display.assignments[monitorId] = id;
      else if (monitorId && c.display.layout === "span") c.display.assignments.span = id;
      else {
        c.display.defaultPresetId = id;
        c.display.assignments = {};
      }
    }, true);
  },

  async addVideo(path, source, name, url) {
    const item: LibraryItem = { id: uid("v"), name: name ?? fileName(path), path, source, url, addedAt: Date.now() };
    const preset = makePreset("video", item.name);
    preset.video.path = path;
    await get().update((c) => {
      if (!c.library.some((l) => l.path === path)) c.library.push(item);
      c.presets.push(preset);
    }, true);
    set({ selectedId: preset.id, tab: "video" });
    return preset;
  },

  startJob(id, label, onDone) {
    set({ jobs: { ...get().jobs, [id]: { id, kind: "download", status: "running", progress: 0, message: "", label, onDone } } });
  },

  notify(msg) {
    set({ toast: msg });
    setTimeout(() => get().toast === msg && set({ toast: null }), 4000);
  },
}));
