// Thin wrappers over Tauri IPC with a browser fallback (localStorage) so the UI
// can be developed with `npm run dev` in a normal browser.
import type { AppConfig, JobEvent, MonitorInfo, ToolStatus, WallpaperTarget, PlaybackState } from "./types";
import { normalizeConfig } from "./types";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Unlisten = () => void;

async function tauriCore() {
  return import("@tauri-apps/api/core");
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return browserInvoke<T>(cmd, args);
  const { invoke } = await tauriCore();
  return invoke<T>(cmd, args);
}

export async function listen<T>(event: string, cb: (payload: T) => void): Promise<Unlisten> {
  if (!isTauri) {
    const h = (e: Event) => cb((e as CustomEvent<T>).detail);
    window.addEventListener(`aq:${event}`, h);
    const bc = new BroadcastChannel("aquawall");
    bc.onmessage = (m) => m.data?.event === event && cb(m.data.payload as T);
    return () => {
      window.removeEventListener(`aq:${event}`, h);
      bc.close();
    };
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, (e) => cb(e.payload));
}

/** URL a <video> element can load for a local file (custom streaming protocol). */
export async function videoUrlResolver(): Promise<(path: string) => string> {
  if (!isTauri) return (p) => p;
  const { convertFileSrc } = await tauriCore();
  return (p) => (/^(https?|blob|data):/i.test(p) ? p : convertFileSrc(p, "wallvid"));
}

export async function currentLabel(): Promise<string> {
  if (!isTauri) return new URLSearchParams(location.search).get("label") ?? "wallpaper-0";
  const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  return getCurrentWebviewWindow().label;
}

export async function pickVideoFile(): Promise<string | null> {
  if (!isTauri) {
    return new Promise((resolve) => {
      const i = document.createElement("input");
      i.type = "file";
      i.accept = "video/mp4,video/webm,video/quicktime,.mov,.m4v,.mkv";
      i.onchange = () => resolve(i.files?.[0] ? URL.createObjectURL(i.files[0]) : null);
      i.click();
    });
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Video", extensions: ["mp4", "webm", "mov", "m4v", "mkv"] }],
  });
  return typeof r === "string" ? r : null;
}

export async function pickImageFile(): Promise<string | null> {
  if (!isTauri) {
    return new Promise((resolve) => {
      const i = document.createElement("input");
      i.type = "file";
      i.accept = "image/*";
      i.onchange = () => resolve(i.files?.[0] ? URL.createObjectURL(i.files[0]) : null);
      i.click();
    });
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ multiple: false, directory: false, filters: [{ name: "Image", extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif"] }] });
  return typeof r === "string" ? r : null;
}

/** Save text to a user-chosen file. Returns false if cancelled. */
export async function exportText(defaultName: string, text: string, ext: string): Promise<boolean> {
  if (!isTauri) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = defaultName;
    a.click();
    return true;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({ defaultPath: defaultName, filters: [{ name: "AquaWall", extensions: [ext, "json"] }] });
  if (!path) return false;
  await invoke("write_text_file", { path, contents: text });
  return true;
}

/** Let the user pick a text file and return its contents (null if cancelled). */
export async function importText(exts: string[]): Promise<string | null> {
  if (!isTauri) {
    return new Promise((resolve) => {
      const i = document.createElement("input");
      i.type = "file";
      i.accept = exts.map((e) => "." + e).join(",");
      i.onchange = async () => resolve(i.files?.[0] ? await i.files[0].text() : null);
      i.click();
    });
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ multiple: false, directory: false, filters: [{ name: "AquaWall", extensions: exts }] });
  if (typeof r !== "string") return null;
  return invoke<string>("read_text_file", { path: r });
}

export async function onFileDrop(cb: (paths: string[]) => void): Promise<Unlisten> {
  if (!isTauri) return () => undefined;
  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  return getCurrentWebview().onDragDropEvent((e) => {
    if (e.payload.type === "drop") cb(e.payload.paths);
  });
}

// ------------------------------------------------------------------ browser fallback

function emitLocal(event: string, payload: unknown) {
  window.dispatchEvent(new CustomEvent(`aq:${event}`, { detail: payload }));
  const bc = new BroadcastChannel("aquawall");
  bc.postMessage({ event, payload });
  bc.close();
}

async function browserInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const load = () => normalizeConfig(JSON.parse(localStorage.getItem("aquawall-config") ?? "null"));
  const mon: MonitorInfo = { id: "Display 1", name: "Display 1", rect: { x: 0, y: 0, w: screen.width * devicePixelRatio, h: screen.height * devicePixelRatio }, scale: devicePixelRatio, primary: true };
  switch (cmd) {
    case "get_config":
      return load() as T;
    case "list_monitors":
      return [mon] as T;
    case "get_targets": {
      const cfg: AppConfig = load();
      const t: WallpaperTarget = { label: "wallpaper-0", presetId: cfg.display.defaultPresetId, rect: mon.rect, monitors: [mon], attachMode: "browser" };
      return [t] as T;
    }
    case "diagnostics":
      return ["Browser preview - no desktop embedding."] as T;
    case "list_window_apps":
      return ["chrome.exe", "code.exe", "photoshop.exe", "steam.exe"] as T;
    case "set_paused": {
      const c = load();
      c.paused = !!args!.paused;
      localStorage.setItem("aquawall-config", JSON.stringify(c));
      emitLocal("config-changed", c);
      return undefined as T;
    }
    case "step_wallpaper": {
      const c = load();
      const ids = c.presets.map((p) => p.id);
      const i = ids.indexOf(c.display.defaultPresetId);
      const d = Number(args!.dir);
      c.display.defaultPresetId = d === 0 ? ids[Math.floor(Math.random() * ids.length)] : ids[(i + d + ids.length) % ids.length];
      localStorage.setItem("aquawall-config", JSON.stringify(c));
      emitLocal("config-changed", c);
      emitLocal("targets-changed", [{ label: "wallpaper-0", presetId: c.display.defaultPresetId, rect: mon.rect, monitors: [mon], attachMode: "browser" }]);
      return undefined as T;
    }
    case "set_config": {
      const cfg = args!.config as AppConfig;
      localStorage.setItem("aquawall-config", JSON.stringify(cfg));
      emitLocal("config-changed", cfg);
      emitLocal("targets-changed", [{ label: "wallpaper-0", presetId: cfg.display.defaultPresetId, rect: mon.rect, monitors: [mon], attachMode: "browser" }]);
      return [] as T;
    }
    case "get_playback":
      return {} as Record<string, PlaybackState> as T;
    case "tool_status":
      return { ffmpeg: null, ffprobe: null, ytdlp: null, libraryDir: "(browser preview)" } satisfies ToolStatus as T;
    case "import_url":
    case "bake_video":
    case "save_image":
      throw new Error("This needs the AquaWall desktop app.");
    default:
      return undefined as T;
  }
}

export type { JobEvent };
