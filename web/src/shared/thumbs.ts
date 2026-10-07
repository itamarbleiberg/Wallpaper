// Shared offscreen renderer that produces JPEG thumbnails for gallery cards,
// one at a time, cached by preset id + settings.
import { Renderer } from "@engine/Renderer";
import type { Preset } from "@shared/types";

let renderer: Renderer | null = null;
const cache = new Map<string, string>();
const queue: { p: Preset; key: string; resolve: (u: string | null) => void }[] = [];
let running = false;

function keyOf(p: Preset): string {
  const src = p.kind === "shader" ? p.shader.builtinId || p.shader.code.length : p.kind === "water" ? JSON.stringify(p.water) : p.kind === "video" ? p.video.path : p.image.path;
  return `${p.id}:${JSON.stringify([src, p.filters])}`;
}

export function cachedThumb(p: Preset): string | undefined {
  return cache.get(keyOf(p));
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
      if (job.p.kind === "video") url = job.p.video.path || null; // poster not needed for library demo
      else if (job.p.kind === "image") url = job.p.image.path || null;
      else {
        if (!renderer) {
          const c = document.createElement("canvas");
          renderer = new Renderer(c, { resolveVideoUrl: (p) => p, offscreen: { width: 420, height: 236 } });
        }
        url = renderer.thumbnail(job.p, 34);
      }
    } catch {
      url = null;
    }
    if (url) cache.set(job.key, url);
    job.resolve(url);
    await new Promise((r) => setTimeout(r, 12));
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
