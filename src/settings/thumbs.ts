// Thumbnail service for the gallery: renders each preset once on a shared
// offscreen WebGL renderer and caches the JPEG data URL (by settings hash).
import { Renderer } from "../engine/Renderer";
import type { Preset } from "../shared/types";

let renderer: Renderer | null = null;
const cache = new Map<string, string>();
const queue: { p: Preset; key: string; resolve: (u: string | null) => void }[] = [];
let running = false;
let resolveUrl: (p: string) => string = (p) => p;

export function setThumbUrlResolver(fn: (p: string) => string) {
  resolveUrl = fn;
}

function keyOf(p: Preset) {
  const { name: _n, favorite: _f, description: _d, ...rest } = p;
  const src = p.kind === "water" ? rest.water : p.kind === "shader" ? rest.shader : p.kind === "video" ? rest.video.path : rest.image.path;
  return p.id + ":" + JSON.stringify([src, rest.filters, p.kind === "water" ? 0 : rest.effects.ripples.enabled]);
}

export function cachedThumb(p: Preset): string | undefined {
  return cache.get(keyOf(p));
}

/** First frame of a video (from ~10% in) as a JPEG data URL. */
export async function videoPoster(url: string, w = 384, h = 216): Promise<string | null> {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.src = url;
  try {
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej();
      setTimeout(() => rej(), 8000);
    });
    v.currentTime = Math.min(v.duration * 0.1, 3);
    await new Promise<void>((res, rej) => {
      v.onseeked = () => res();
      setTimeout(() => rej(), 8000);
    });
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const s = Math.max(w / v.videoWidth, h / v.videoHeight);
    ctx.drawImage(v, (w - v.videoWidth * s) / 2, (h - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s);
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift()!;
    if (cache.has(job.key)) {
      job.resolve(cache.get(job.key)!);
      continue;
    }
    let url: string | null = null;
    try {
      if (job.p.kind === "video") {
        url = job.p.video.path ? await videoPoster(resolveUrl(job.p.video.path)) : null;
      } else if (job.p.kind === "image") {
        url = job.p.image.path ? resolveUrl(job.p.image.path) : null;
      } else {
        if (!renderer) {
          const c = document.createElement("canvas");
          renderer = new Renderer(c, { resolveVideoUrl: resolveUrl, offscreen: { width: 384, height: 216 } });
        }
        url = renderer.thumbnail(job.p, 30);
      }
    } catch {
      url = null;
    }
    if (url) cache.set(job.key, url);
    job.resolve(url);
    // yield to the UI between thumbnails
    await new Promise((r) => setTimeout(r, 16));
  }
  running = false;
}

export function requestThumb(p: Preset): Promise<string | null> {
  const key = keyOf(p);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    queue.push({ p: structuredClone(p), key, resolve });
    pump();
  });
}

/** Render a preset at full resolution (for screenshots / static wallpaper). */
export function renderStill(p: Preset, width: number, height: number): string {
  const c = document.createElement("canvas");
  const r = new Renderer(c, { resolveVideoUrl: resolveUrl, offscreen: { width, height } });
  try {
    return r.thumbnail(p, 45);
  } finally {
    r.destroy();
  }
}
