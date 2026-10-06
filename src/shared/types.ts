import { SHADER_LIBRARY } from "../engine/shaderLibrary";

export type PresetKind = "water" | "video" | "image" | "shader";
export type Category = "water" | "nature" | "space" | "abstract" | "retro" | "cozy" | "mine";
export type LoopMode = "loop" | "pingpong" | "crossfade";
export type FitMode = "cover" | "contain" | "stretch";
export type FloorStyle = "tiles" | "mosaic" | "pebbles" | "sand" | "plain";
export type ClickEffect = "splash" | "ring" | "bubbles";
export type WidgetPosition =
  | "top-left" | "top-center" | "top-right"
  | "center"
  | "bottom-left" | "bottom-center" | "bottom-right";

export interface WaterSettings {
  clarity: number;
  waveSpeed: number;
  refraction: number;
  caustics: number;
  persistence: number;
  waveIntensity: number;
  rippleSize: number;
  mouseSensitivity: number;
  lightingDepth: number;
  specular: number;
  reflection: number;
  tileScale: number;
  floorStyle: FloorStyle;
  waterColor: string;
  deepColor: string;
  tileColor: string;
  groutColor: string;
  ambientDrops: number;
  simResolution: number;
  edgeShadow: number;
  clickEffect: ClickEffect;
  koi: number;          // number of koi fish (0..8)
  koiSpeed: number;
  lilyPads: number;     // number of lily pads (0..12)
  poolLights: number;   // underwater lamp intensity 0..2
  lightColor: string;
}

export interface VideoSettings {
  path: string;
  inPoint: number;
  outPoint: number | null;
  speed: number;
  loopMode: LoopMode;
  crossfade: number;
  frameBlend: boolean;
  fit: FitMode;
  volume: number;
  muted: boolean;
  opacity: number;
  bicubic: boolean;
}

export interface ImageSettings {
  path: string;
  fit: FitMode;
  kenBurns: number;      // 0..1 slow pan & zoom amount
  kenBurnsSpeed: number; // 0.2..3
}

export interface ShaderSettings {
  builtinId: string;
  code: string;
  speed: number;
  mouse: boolean;
}

export interface FilterSettings {
  sharpen: number;
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  gamma: number;
  temperature: number;
  blur: number;
  vignette: number;
  vignetteSoftness: number;
  grain: number;
}

export interface EffectsSettings {
  ripples: { enabled: boolean; strength: number; size: number; persistence: number; refraction: number; specular: number };
  trail: {
    enabled: boolean;
    style: "particles" | "light" | "both";
    color: string;
    rainbow: boolean;
    size: number;
    amount: number;
    length: number;
  };
  parallax: number;     // 0..1 mouse-follow depth shift
  beatPulse: number;    // 0..1 pulse on bass beats
  audioRipples: number; // 0..2 beats drop ripples into the water
}

export interface Preset {
  id: string;
  name: string;
  kind: PresetKind;
  category: Category;
  builtin?: boolean;
  favorite: boolean;
  description: string;
  water: WaterSettings;
  video: VideoSettings;
  image: ImageSettings;
  shader: ShaderSettings;
  filters: FilterSettings;
  effects: EffectsSettings;
  renderScale: number;
  fpsCap: number;
}

export interface LibraryItem {
  id: string;
  name: string;
  path: string;
  source: "file" | "url" | "baked" | "image";
  url?: string;
  addedAt: number;
}

export interface WidgetBase { enabled: boolean; position: WidgetPosition; scale: number; color: string; opacity: number }

export interface WidgetsConfig {
  allDisplays: boolean;
  clock: WidgetBase & { format24: boolean; showSeconds: boolean; showDate: boolean; style: "thin" | "bold" | "mono" };
  weather: WidgetBase & { latitude: number; longitude: number; place: string; units: "celsius" | "fahrenheit"; syncRain: boolean };
  visualizer: WidgetBase & { style: "bars" | "mirror" | "wave"; bars: number; height: number; sensitivity: number };
  sysmon: WidgetBase & { showCpu: boolean; showRam: boolean; showBattery: boolean };
  text: WidgetBase & { text: string; subtitle: string; style: "thin" | "bold" | "serif" };
  countdown: WidgetBase & { title: string; target: string };
}

export interface AppConfig {
  version: number;
  presets: Preset[];
  library: LibraryItem[];
  display: { layout: "independent" | "clone" | "span"; assignments: Record<string, string>; defaultPresetId: string };
  performance: {
    onFullscreen: "pause" | "mute" | "none";
    onMaximized: "pause" | "mute" | "none";
    onBattery: "pause" | "throttle" | "none";
    batteryThreshold: number;
    pauseOnBatterySaver: boolean;
    pollMs: number;
    cursorHz: number;
    interactWhen: "always" | "desktop";
    idleEnabled: boolean;
    idleMinutes: number;
    idleAction: "dim" | "throttle" | "pause";
    blockedApps: string[];
  };
  general: { autostart: boolean; showHud: boolean; syncStaticWallpaper: boolean; accent: string };
  transitions: { type: "fade" | "ripple" | "none"; duration: number };
  playlist: { enabled: boolean; presetIds: string[]; intervalMin: number; shuffle: boolean };
  schedule: { enabled: boolean; slots: { start: string; presetId: string }[] };
  night: { enabled: boolean; start: string; end: string; dim: number; warmth: number };
  hotkeys: { enabled: boolean; pause: string; next: string; prev: string; mute: string; settings: string };
  widgets: WidgetsConfig;
  paused: boolean;
  muted: boolean;
}

// ---------------------------------------------------------------- runtime messages

export interface Rect { x: number; y: number; w: number; h: number }
export interface MonitorInfo { id: string; name: string; rect: Rect; scale: number; primary: boolean }
export interface WallpaperTarget { label: string; presetId: string; rect: Rect; monitors: MonitorInfo[]; attachMode: string }
export interface PlaybackState { paused: boolean; muted: boolean; throttle: boolean; dim: boolean; reason: string }
export interface CursorEvent { x: number; y: number; down: boolean; overDesktop: boolean }
export interface SysStats { cpu: number; mem: number; memUsedGb: number; memTotalGb: number; battery: number | null; charging: boolean }
export interface JobEvent { id: string; kind: "download" | "bake"; status: "running" | "done" | "error" | "cancelled"; progress: number; message: string; path?: string | null }
export interface ToolStatus { ffmpeg: string | null; ffprobe: string | null; ytdlp: string | null; libraryDir: string }

// ---------------------------------------------------------------- defaults

export const DEFAULT_WATER: WaterSettings = {
  clarity: 0.85,
  waveSpeed: 1.0,
  refraction: 1.0,
  caustics: 1.0,
  persistence: 0.75,
  waveIntensity: 1.0,
  rippleSize: 1.0,
  mouseSensitivity: 1.0,
  lightingDepth: 0.5,
  specular: 1.0,
  reflection: 0.5,
  tileScale: 12,
  floorStyle: "tiles",
  waterColor: "#1b8fb3",
  deepColor: "#063a5c",
  tileColor: "#d9f1f7",
  groutColor: "#7fb8c9",
  ambientDrops: 0.4,
  simResolution: 0.33,
  edgeShadow: 0.45,
  clickEffect: "splash",
  koi: 0,
  koiSpeed: 1,
  lilyPads: 0,
  poolLights: 0,
  lightColor: "#7fd8ff",
};

export const DEFAULT_VIDEO: VideoSettings = {
  path: "", inPoint: 0, outPoint: null, speed: 1, loopMode: "loop", crossfade: 0.8, frameBlend: false,
  fit: "cover", volume: 0.5, muted: true, opacity: 1, bicubic: true,
};

export const DEFAULT_IMAGE: ImageSettings = { path: "", fit: "cover", kenBurns: 0.5, kenBurnsSpeed: 1 };

export const DEFAULT_SHADER: ShaderSettings = { builtinId: SHADER_LIBRARY[0].id, code: SHADER_LIBRARY[0].code, speed: 1, mouse: true };

export const DEFAULT_FILTERS: FilterSettings = {
  sharpen: 0, brightness: 1, contrast: 1, saturation: 1, vibrance: 0, gamma: 1, temperature: 0,
  blur: 0, vignette: 0, vignetteSoftness: 0.45, grain: 0,
};

export const DEFAULT_EFFECTS: EffectsSettings = {
  ripples: { enabled: false, strength: 1, size: 1, persistence: 0.7, refraction: 1, specular: 0.6 },
  trail: { enabled: false, style: "both", color: "#7fe7ff", rainbow: false, size: 1, amount: 1, length: 0.5 },
  parallax: 0,
  beatPulse: 0,
  audioRipples: 0,
};

export function uid(prefix = "p"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function makePreset(kind: PresetKind, name: string, patch: DeepPartial<Preset> = {}): Preset {
  return deepMerge(
    {
      id: uid(),
      name,
      kind,
      category: kind === "water" ? "water" : "mine",
      favorite: false,
      description: "",
      water: DEFAULT_WATER,
      video: DEFAULT_VIDEO,
      image: DEFAULT_IMAGE,
      shader: DEFAULT_SHADER,
      filters: DEFAULT_FILTERS,
      effects: DEFAULT_EFFECTS,
      renderScale: 1,
      fpsCap: 60,
    } as Preset,
    patch,
  );
}

const water = (id: string, name: string, description: string, w: Partial<WaterSettings>, extra: DeepPartial<Preset> = {}) =>
  makePreset("water", name, { id, builtin: true, category: "water", description, water: w, ...extra });

export function builtinPresets(): Preset[] {
  const pools: Preset[] = [
    water("builtin-pool", "Interactive Pool", "Sunlit tiled pool. Your cursor stirs the water.", {}),
    water("builtin-night-pool", "Midnight Pool", "Deep blue pool after dark, lit from below.", {
      clarity: 0.7, lightingDepth: 0.8, waterColor: "#0b3d6b", deepColor: "#020b1f", tileColor: "#5a7ca8", groutColor: "#1d2f4d",
      caustics: 1.4, specular: 1.6, poolLights: 0.8, lightColor: "#8fd4ff",
    }, { effects: { trail: { enabled: true, style: "light", color: "#9fd8ff" } } }),
    water("builtin-lagoon", "Lagoon Sand", "Clear tropical shallows over rippled sand.", {
      floorStyle: "sand", tileColor: "#e8d7a8", groutColor: "#c9b27a", waterColor: "#2bb5a8", deepColor: "#0b5e66", clarity: 0.92,
    }),
    // ---- new water scenes
    water("builtin-koi", "Koi Pond", "Koi swim around pebbles and lily pads and scatter from your cursor.", {
      floorStyle: "pebbles", tileScale: 7, tileColor: "#8c8b74", groutColor: "#3d3a2c", waterColor: "#2f6f5e", deepColor: "#0e2a24",
      clarity: 0.72, lightingDepth: 0.6, caustics: 0.8, koi: 7, lilyPads: 7, ambientDrops: 0.15, edgeShadow: 0.6, reflection: 0.6,
    }),
    water("builtin-zen", "Zen Lily Garden", "Calm, clear water with lotus pads and pale stones.", {
      floorStyle: "pebbles", tileScale: 5, tileColor: "#c9c3b2", groutColor: "#6d6656", waterColor: "#4a9a8c", deepColor: "#1d4a44",
      clarity: 0.9, caustics: 1.2, lilyPads: 10, koi: 2, koiSpeed: 0.6, ambientDrops: 0.05, waveSpeed: 0.8, edgeShadow: 0.3,
    }),
    water("builtin-rain-koi", "Rainy Koi Pond", "Steady rain on a dark pond with koi underneath.", {
      floorStyle: "pebbles", tileScale: 6, tileColor: "#5b6158", groutColor: "#23271f", waterColor: "#1d4a48", deepColor: "#081816",
      clarity: 0.6, lightingDepth: 0.8, caustics: 0.4, koi: 5, lilyPads: 5, ambientDrops: 9, rippleSize: 0.8, specular: 1.6, reflection: 0.85,
    }, { filters: { brightness: 0.9, contrast: 1.1, vignette: 0.35 } }),
    water("builtin-neon-swim", "Neon Night Swim", "A dark pool lit by magenta and cyan underwater lights.", {
      floorStyle: "tiles", tileScale: 14, tileColor: "#3a3f6b", groutColor: "#13142b", waterColor: "#4b1d7a", deepColor: "#07041a",
      clarity: 0.75, lightingDepth: 0.75, caustics: 1.5, poolLights: 1.6, lightColor: "#ff4fd8", specular: 1.8, edgeShadow: 0.7,
    }, { effects: { trail: { enabled: true, style: "both", rainbow: true } } }),
    water("builtin-mosaic-spa", "Mosaic Spa", "Warm Mediterranean mosaic under golden light.", {
      floorStyle: "mosaic", tileScale: 18, tileColor: "#e9d3a6", groutColor: "#9a6b3c", waterColor: "#2aa0a8", deepColor: "#0a4e5c",
      clarity: 0.88, caustics: 0.9, poolLights: 0.4, lightColor: "#ffd27a", lightingDepth: 0.45, refraction: 0.8,
    }, { filters: { temperature: 0.25, vibrance: 0.2 } }),
    water("builtin-glacier", "Glacier Lagoon", "Icy turquoise meltwater over pale rock.", {
      floorStyle: "pebbles", tileScale: 4, tileColor: "#d8eef2", groutColor: "#8fb3bd", waterColor: "#3fd0e0", deepColor: "#0b6d8a",
      clarity: 0.95, caustics: 1.6, refraction: 1.3, specular: 1.4, ambientDrops: 0.1, edgeShadow: 0.25,
    }, { filters: { contrast: 1.05, saturation: 1.1 } }),
  ];
  const shaders = SHADER_LIBRARY.map((s) =>
    makePreset("shader", s.name, {
      id: `builtin-shader-${s.id}`,
      builtin: true,
      category: s.category,
      description: s.description,
      shader: { builtinId: s.id, code: s.code, speed: 1, mouse: true },
      effects: s.effects ?? {},
      filters: s.filters ?? {},
    }),
  );
  return [...pools, ...shaders];
}

export function defaultConfig(): AppConfig {
  return {
    version: 2,
    presets: builtinPresets(),
    library: [],
    display: { layout: "independent", assignments: {}, defaultPresetId: "builtin-pool" },
    performance: {
      onFullscreen: "pause", onMaximized: "none", onBattery: "throttle", batteryThreshold: 100, pauseOnBatterySaver: true,
      pollMs: 750, cursorHz: 120, interactWhen: "desktop", idleEnabled: false, idleMinutes: 10, idleAction: "dim", blockedApps: [],
    },
    general: { autostart: false, showHud: false, syncStaticWallpaper: false, accent: "#3fc2ff" },
    transitions: { type: "fade", duration: 1.2 },
    playlist: { enabled: false, presetIds: [], intervalMin: 15, shuffle: false },
    schedule: {
      enabled: false,
      slots: [
        { start: "07:00", presetId: "builtin-pool" },
        { start: "18:00", presetId: "builtin-shader-ocean-sunset" },
        { start: "21:30", presetId: "builtin-night-pool" },
      ],
    },
    night: { enabled: false, start: "22:00", end: "07:00", dim: 0.35, warmth: 0.5 },
    hotkeys: { enabled: true, pause: "Ctrl+Alt+P", next: "Ctrl+Alt+Right", prev: "Ctrl+Alt+Left", mute: "Ctrl+Alt+M", settings: "Ctrl+Alt+W" },
    widgets: {
      allDisplays: false,
      clock: { enabled: true, position: "top-right", scale: 1, color: "#ffffff", opacity: 0.92, format24: true, showSeconds: false, showDate: true, style: "thin" },
      weather: { enabled: false, position: "top-left", scale: 1, color: "#ffffff", opacity: 0.9, latitude: 51.5072, longitude: -0.1276, place: "London", units: "celsius", syncRain: false },
      visualizer: { enabled: false, position: "bottom-center", scale: 1, color: "#7fe7ff", opacity: 0.8, style: "mirror", bars: 48, height: 0.18, sensitivity: 1 },
      sysmon: { enabled: false, position: "bottom-left", scale: 1, color: "#ffffff", opacity: 0.85, showCpu: true, showRam: true, showBattery: true },
      text: { enabled: false, position: "center", scale: 1, color: "#ffffff", opacity: 0.85, text: "Stay curious.", subtitle: "", style: "thin" },
      countdown: { enabled: false, position: "bottom-right", scale: 1, color: "#ffffff", opacity: 0.9, title: "New Year", target: `${new Date().getFullYear() + 1}-01-01T00:00` },
    },
    paused: false,
    muted: false,
  };
}

// ---------------------------------------------------------------- normalization

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge `value` over `defaults`; arrays and primitives from `value` win. */
export function deepMerge<T>(defaults: T, value: unknown): T {
  if (!isObj(defaults) || !isObj(value)) {
    if (value === undefined) return structuredClone(defaults);
    if (isObj(defaults) && !isObj(value)) return structuredClone(defaults);
    if (typeof defaults === "number" && typeof value !== "number") return defaults;
    if (typeof defaults === "boolean" && typeof value !== "boolean") return defaults;
    if (typeof defaults === "string" && typeof value !== "string") return defaults;
    return value as T;
  }
  const out: Record<string, unknown> = {};
  const d = defaults as Record<string, unknown>;
  for (const k of new Set([...Object.keys(d), ...Object.keys(value)])) {
    out[k] = k in d ? deepMerge(d[k], value[k]) : value[k];
  }
  return out as T;
}

/** Fill missing fields with defaults and add any newly shipped built-ins. */
export function normalizeConfig(raw: unknown): AppConfig {
  const base = defaultConfig();
  if (!isObj(raw)) return base;
  const merged = deepMerge(base, raw);
  const builtins = builtinPresets();
  const rawPresets = Array.isArray(raw.presets) ? (raw.presets as unknown[]) : [];
  const presets: Preset[] = rawPresets.filter(isObj).map((p) => {
    const kind = (p.kind as PresetKind) || "water";
    const b = builtins.find((x) => x.id === p.id);
    const merged = deepMerge(b ?? makePreset(kind, "Untitled"), p);
    if (b) {
      // Built-in shader code always comes from the app (keeps fixes flowing).
      if (b.kind === "shader" && merged.shader.builtinId === b.shader.builtinId) merged.shader.code = b.shader.code;
      merged.builtin = true;
      merged.category = b.category;
      merged.description = b.description;
    }
    return merged;
  });
  for (const b of builtins) if (!presets.some((p) => p.id === b.id)) presets.push(b);
  // Keep built-ins in shipped order, then user wallpapers.
  const order = new Map(builtins.map((b, i) => [b.id, i]));
  presets.sort((a, b) => (order.get(a.id) ?? 1e6) - (order.get(b.id) ?? 1e6));
  merged.presets = presets;
  merged.version = 2;
  if (!presets.some((p) => p.id === merged.display.defaultPresetId)) merged.display.defaultPresetId = "builtin-pool";
  return merged;
}

export function presetForTarget(cfg: AppConfig, presetId: string | undefined): Preset {
  return (
    cfg.presets.find((p) => p.id === presetId) ??
    cfg.presets.find((p) => p.id === cfg.display.defaultPresetId) ??
    cfg.presets[0] ??
    builtinPresets()[0]
  );
}

export const CATEGORY_LABEL: Record<Category, string> = {
  water: "Water", nature: "Nature", space: "Space", abstract: "Abstract", retro: "Retro", cozy: "Cozy", mine: "My wallpapers",
};

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/** Is local time inside [start, end) (handles windows over midnight)? */
export function inWindow(start: string, end: string, d = new Date()): boolean {
  const a = parseHHMM(start), b = parseHHMM(end);
  if (a == null || b == null) return false;
  const n = d.getHours() * 60 + d.getMinutes();
  return a <= b ? n >= a && n < b : n >= a || n < b;
}
