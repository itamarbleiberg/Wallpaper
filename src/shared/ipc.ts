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
    case "set_config": {
      localStorage.setItem("aquawall-config", JSON.stringify(args!.config));
      emitLocal("config-changed", args!.config);
      return undefined as T;
    }
    case "list_monitors":
      return [mon] as T;
    case "get_targets": {
      const cfg: AppConfig = load();
      const t: WallpaperTarget = { label: "wallpaper-0", presetId: cfg.display.defaultPresetId, rect: mon.rect, monitors: [mon], attachMode: "browser" };
      return [t] as T;
    }
    case "get_playback":
      return {} as Record<string, PlaybackState> as T;
    case "tool_status":
      return { ffmpeg: null, ffprobe: null, ytdlp: null, libraryDir: "(browser preview)" } satisfies ToolStatus as T;
    case "import_url":
    case "bake_video":
      throw new Error("Downloading and baking require the desktop app.");
    default:
      return undefined as T;
  }
}

export type { JobEvent };
