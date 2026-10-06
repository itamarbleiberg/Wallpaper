import { BUILTIN_SHADERS } from "../engine/builtinShaders";

export type PresetKind = "water" | "video" | "shader";
export type LoopMode = "loop" | "pingpong" | "crossfade";
export type FitMode = "cover" | "contain" | "stretch";
export type WidgetPosition =
  | "top-left" | "top-center" | "top-right"
  | "center"
  | "bottom-left" | "bottom-center" | "bottom-right";

export interface WaterSettings {
  clarity: number;          // 0..1  (murky -> crystal)
  waveSpeed: number;        // 0.2..3
  refraction: number;       // 0..2
  caustics: number;         // 0..2
  persistence: number;      // 0..1  (how long ripples last)
  waveIntensity: number;    // 0..3  (visual height of waves)
  rippleSize: number;       // 0.2..3
  mouseSensitivity: number; // 0..3
  lightingDepth: number;    // 0..1  (pool depth / light falloff)
  specular: number;         // 0..2
  reflection: number;       // 0..1
  tileScale: number;        // tiles per screen height
  floorStyle: "tiles" | "sand" | "plain";
  waterColor: string;
  deepColor: string;
  tileColor: string;
  groutColor: string;
  ambientDrops: number;     // random drops per second
  simResolution: number;    // 0.15..0.6 of render size
  edgeShadow: number;       // 0..1
}

export interface VideoSettings {
  path: string;
  inPoint: number;
  outPoint: number | null;
  speed: number;            // 0.25..4
  loopMode: LoopMode;
  crossfade: number;        // seconds
  frameBlend: boolean;      // realtime frame interpolation (blend)
  fit: FitMode;
  volume: number;
  muted: boolean;
  opacity: number;
  bicubic: boolean;         // high-quality upscaling sampler
}

export interface ShaderSettings {
  builtinId: string;        // "" = custom code
  code: string;
  speed: number;
  mouse: boolean;
}

export interface FilterSettings {
  sharpen: number;     // 0..1 (contrast adaptive sharpening)
  brightness: number;  // 0.5..1.5
  contrast: number;    // 0.5..1.5
  saturation: number;  // 0..2
  vibrance: number;    // -1..1
  gamma: number;       // 0.5..2
  temperature: number; // -1..1
  blur: number;        // 0..1
  vignette: number;    // 0..1
  vignetteSoftness: number; // 0.05..1
  grain: number;       // 0..1
}

export interface EffectsSettings {
  ripples: { enabled: boolean; strength: number; size: number; persistence: number; refraction: number; specular: number };
  trail: {
    enabled: boolean;
    style: "particles" | "light" | "both";
    color: string;
    rainbow: boolean;
    size: number;     // 0.2..3
    amount: number;   // 0..2
    length: number;   // seconds 0.1..2
  };
}

export interface Preset {
  id: string;
  name: string;
  kind: PresetKind;
  builtin?: boolean;
  water: WaterSettings;
  video: VideoSettings;
  shader: ShaderSettings;
  filters: FilterSettings;
  effects: EffectsSettings;
  renderScale: number; // 0.5..1
  fpsCap: number;      // 24..144
}

export interface LibraryItem {
  id: string;
  name: string;
  path: string;
  source: "file" | "url" | "baked";
  url?: string;
  addedAt: number;
}

export interface WidgetBase { enabled: boolean; position: WidgetPosition; scale: number; color: string; opacity: number }

export interface WidgetsConfig {
  allDisplays: boolean;
  clock: WidgetBase & { format24: boolean; showSeconds: boolean; showDate: boolean };
  weather: WidgetBase & { latitude: number; longitude: number; place: string; units: "celsius" | "fahrenheit" };
  visualizer: WidgetBase & { style: "bars" | "mirror" | "wave"; bars: number; height: number; sensitivity: number };
  sysmon: WidgetBase & { showCpu: boolean; showRam: boolean };
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
  };
  general: { autostart: boolean };
  widgets: WidgetsConfig;
  paused: boolean;
}

// ---------------------------------------------------------------- runtime messages

export interface Rect { x: number; y: number; w: number; h: number }
export interface MonitorInfo { id: string; name: string; rect: Rect; scale: number; primary: boolean }
export interface WallpaperTarget { label: string; presetId: string; rect: Rect; monitors: MonitorInfo[]; attachMode: string }
export interface PlaybackState { paused: boolean; muted: boolean; throttle: boolean; reason: string }
export interface CursorEvent { x: number; y: number; down: boolean; overDesktop: boolean }
export interface SysStats { cpu: number; mem: number; memUsedGb: number; memTotalGb: number }
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
};

export const DEFAULT_VIDEO: VideoSettings = {
  path: "",
  inPoint: 0,
  outPoint: null,
  speed: 1,
  loopMode: "loop",
  crossfade: 0.8,
  frameBlend: false,
  fit: "cover",
  volume: 0.5,
  muted: true,
  opacity: 1,
  bicubic: true,
};

export const DEFAULT_SHADER: ShaderSettings = {
  builtinId: "aurora",
  code: BUILTIN_SHADERS[0].code,
  speed: 1,
  mouse: true,
};

export const DEFAULT_FILTERS: FilterSettings = {
  sharpen: 0,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  vibrance: 0,
  gamma: 1,
  temperature: 0,
  blur: 0,
  vignette: 0,
  vignetteSoftness: 0.45,
  grain: 0,
};

export const DEFAULT_EFFECTS: EffectsSettings = {
  ripples: { enabled: false, strength: 1, size: 1, persistence: 0.7, refraction: 1, specular: 0.6 },
  trail: { enabled: false, style: "both", color: "#7fe7ff", rainbow: false, size: 1, amount: 1, length: 0.5 },
};

export function uid(prefix = "p"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makePreset(kind: PresetKind, name: string, patch: Partial<Preset> = {}): Preset {
  return deepMerge(
    {
      id: uid(),
      name,
      kind,
      water: DEFAULT_WATER,
      video: DEFAULT_VIDEO,
      shader: DEFAULT_SHADER,
      filters: DEFAULT_FILTERS,
      effects: DEFAULT_EFFECTS,
      renderScale: 1,
      fpsCap: 60,
    } as Preset,
    patch,
  );
}

export function builtinPresets(): Preset[] {
  return [
    makePreset("water", "Interactive Pool", { id: "builtin-pool", builtin: true }),
    makePreset("water", "Midnight Pool", {
      id: "builtin-night-pool",
      builtin: true,
      water: {
        ...DEFAULT_WATER,
        clarity: 0.7,
        lightingDepth: 0.8,
        waterColor: "#0b3d6b",
        deepColor: "#020b1f",
        tileColor: "#5a7ca8",
        groutColor: "#1d2f4d",
        caustics: 1.4,
        specular: 1.6,
      },
      effects: { ...DEFAULT_EFFECTS, trail: { ...DEFAULT_EFFECTS.trail, enabled: true, style: "light", color: "#9fd8ff" } },
    }),
    makePreset("water", "Lagoon Sand", {
      id: "builtin-lagoon",
      builtin: true,
      water: { ...DEFAULT_WATER, floorStyle: "sand", tileColor: "#e8d7a8", groutColor: "#c9b27a", waterColor: "#2bb5a8", deepColor: "#0b5e66", clarity: 0.92 },
    }),
    ...BUILTIN_SHADERS.map((s) =>
      makePreset("shader", s.name, {
        id: `builtin-shader-${s.id}`,
        builtin: true,
        shader: { builtinId: s.id, code: s.code, speed: 1, mouse: true },
        effects: { ...DEFAULT_EFFECTS, trail: { ...DEFAULT_EFFECTS.trail, enabled: s.id === "neon-grid" } },
      }),
    ),
  ];
}

export function defaultConfig(): AppConfig {
  return {
    version: 1,
    presets: builtinPresets(),
    library: [],
    display: { layout: "independent", assignments: {}, defaultPresetId: "builtin-pool" },
    performance: {
      onFullscreen: "pause",
      onMaximized: "none",
      onBattery: "throttle",
      batteryThreshold: 100,
      pauseOnBatterySaver: true,
      pollMs: 750,
      cursorHz: 120,
      interactWhen: "desktop",
    },
    general: { autostart: false },
    widgets: {
      allDisplays: false,
      clock: { enabled: true, position: "top-right", scale: 1, color: "#ffffff", opacity: 0.9, format24: true, showSeconds: false, showDate: true },
      weather: { enabled: false, position: "top-right", scale: 1, color: "#ffffff", opacity: 0.9, latitude: 51.5072, longitude: -0.1276, place: "London", units: "celsius" },
      visualizer: { enabled: false, position: "bottom-center", scale: 1, color: "#7fe7ff", opacity: 0.8, style: "mirror", bars: 48, height: 0.18, sensitivity: 1 },
      sysmon: { enabled: false, position: "bottom-left", scale: 1, color: "#ffffff", opacity: 0.85, showCpu: true, showRam: true },
    },
    paused: false,
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
    return value as T;
  }
  const out: Record<string, unknown> = {};
  const d = defaults as Record<string, unknown>;
  for (const k of new Set([...Object.keys(d), ...Object.keys(value)])) {
    out[k] = k in d ? deepMerge(d[k], value[k]) : value[k];
  }
  return out as T;
}

/** Fill any missing fields (old/partial config files) with defaults. */
export function normalizeConfig(raw: unknown): AppConfig {
  const base = defaultConfig();
  if (!isObj(raw) || !Array.isArray(raw.presets) || raw.presets.length === 0) {
    return isObj(raw) ? { ...deepMerge(base, raw), presets: base.presets } : base;
  }
  const merged = deepMerge(base, raw);
  merged.presets = (raw.presets as unknown[]).map((p) => {
    const kind = (isObj(p) && (p.kind as PresetKind)) || "water";
    return deepMerge(makePreset(kind, "Untitled"), p);
  });
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
