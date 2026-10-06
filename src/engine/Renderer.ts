import { FullscreenTri, GL, Target, createTarget, disposeTarget, resizeTarget } from "./gl";
import { WaterRenderer, WaterSim } from "./WaterSim";
import { VideoSource } from "./VideoSource";
import { ShaderSource } from "./ShaderSource";
import { PostFX } from "./PostFX";
import { TrailFX } from "./TrailFX";
import type { Preset } from "../shared/types";

export interface RendererOptions {
  /** Map a local file path to a URL the <video> element can load. */
  resolveVideoUrl: (path: string) => string;
  onError?: (source: "shader" | "video" | "gl", msg: string | null) => void;
  onFps?: (fps: number) => void;
  onVideoTime?: (t: number, duration: number) => void;
}

/**
 * Spring-damper follower for the cursor: smooths jittery input and gives the
 * wake a natural, slightly elastic feel. Positions in UV (0..1, y up).
 */
class Pointer {
  tx = 0.5; ty = 0.5;
  x = 0.5; y = 0.5;
  vx = 0; vy = 0;
  px = 0.5; py = 0.5;
  inside = false;
  down = false;
  wasDown = false;
  private init = false;

  set(u: number, v: number, down: boolean, inside: boolean) {
    this.tx = u;
    this.ty = v;
    this.down = down && inside;
    if (inside && !this.inside) this.init = false;
    this.inside = inside;
  }

  update(dt: number, aspect: number) {
    this.px = this.x;
    this.py = this.y;
    const jump = Math.hypot((this.tx - this.x) * aspect, this.ty - this.y);
    if (!this.init || jump > 0.35) {
      this.x = this.px = this.tx;
      this.y = this.py = this.ty;
      this.vx = this.vy = 0;
      this.init = true;
      return;
    }
    const k = 260;
    const c = 2 * Math.sqrt(k) * 0.72;
    const sub = 3;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const ax = (this.tx - this.x) * k - this.vx * c;
      const ay = (this.ty - this.y) * k - this.vy * c;
      this.vx += ax * h;
      this.vy += ay * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
    }
  }

  /** Speed in screen-heights per second (aspect corrected). */
  speed(aspect: number) {
    return Math.hypot(this.vx * aspect, this.vy);
  }
}

export class Renderer {
  private gl: GL;
  private tri: FullscreenTri;
  private sim: WaterSim;
  private water: WaterRenderer;
  private video: VideoSource | null = null;
  private shader: ShaderSource | null = null;
  private post: PostFX;
  private trail: TrailFX;
  private src: Target;
  private rip: Target;
  private preset: Preset | null = null;
  private pointer = new Pointer();
  private raf = 0;
  private last = 0;
  private lastDraw = 0;
  private time = 0;
  private paused = false;
  private throttle = false;
  private muted = false;
  private destroyed = false;
  private ro: ResizeObserver;
  private fpsFrames = 0;
  private fpsAt = 0;
  private ambientAcc = 0;
  private w = 1;
  private h = 1;

  constructor(private canvas: HTMLCanvasElement, private opts: RendererOptions) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
      desynchronized: true,
    });
    if (!gl) throw new Error("WebGL2 is not available.");
    this.gl = gl;
    this.tri = new FullscreenTri(gl);
    this.sim = new WaterSim(gl, this.tri, 64, 36);
    this.water = new WaterRenderer(gl, this.tri);
    this.post = new PostFX(gl, this.tri);
    this.trail = new TrailFX(gl);
    this.src = createTarget(gl, 1, 1);
    this.rip = createTarget(gl, 1, 1);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.opts.onError?.("gl", "GPU context lost - reloading");
      setTimeout(() => location.reload(), 1500);
    });
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  private resize() {
    const p = this.preset;
    const scale = Math.min(1, Math.max(0.25, p?.renderScale ?? 1));
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr * scale));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr * scale));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.w = w;
    this.h = h;
    resizeTarget(this.gl, this.src, w, h);
    resizeTarget(this.gl, this.rip, w, h);
    this.resizeSim();
  }

  private resizeSim() {
    const p = this.preset;
    const frac = p?.kind === "water" ? p.water.simResolution : 0.25;
    const sh = Math.max(32, Math.min(720, Math.round(this.h * Math.min(0.6, Math.max(0.1, frac)))));
    const sw = Math.max(32, Math.min(1280, Math.round(sh * (this.w / this.h))));
    this.sim.resize(sw, sh);
    this.sim.aspect = this.w / this.h;
  }

  setPreset(p: Preset) {
    const prev = this.preset;
    this.preset = structuredClone(p);
    if (!prev || prev.renderScale !== p.renderScale || prev.water.simResolution !== p.water.simResolution || prev.kind !== p.kind) this.resize();
    if (p.kind === "video") {
      if (!this.video) {
        this.video = new VideoSource(this.gl, this.tri);
        this.video.onError = (m) => this.opts.onError?.("video", m);
        this.video.onTime = (t, d) => this.opts.onVideoTime?.(t, d);
      }
      if (p.video.path) {
        this.opts.onError?.("video", null);
        this.video.configure(this.opts.resolveVideoUrl(p.video.path), p.video);
      }
      this.video.setMuted(this.muted);
      this.video.setPaused(this.paused);
    } else if (this.video) {
      this.video.dispose();
      this.video = null;
    }
    if (p.kind === "shader") {
      if (!this.shader) this.shader = new ShaderSource(this.gl, this.tri);
      this.opts.onError?.("shader", this.shader.setCode(p.shader.code));
    }
    if (prev && prev.kind !== p.kind) {
      this.sim.clear();
      this.trail.reset();
    }
  }

  /** Cursor in UV with top-left origin (as from screen coords). */
  setPointer(u: number, v: number, down: boolean, inside: boolean) {
    this.pointer.set(u, 1 - v, down, inside);
  }

  setAudio(bands: ArrayLike<number>) {
    this.shader?.setAudio(bands);
  }

  setPaused(p: boolean) {
    if (p === this.paused) return;
    this.paused = p;
    this.video?.setPaused(p);
    if (!p && !this.destroyed) {
      this.last = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.loop);
    }
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.video?.setMuted(m);
  }
  setThrottle(t: boolean) {
    this.throttle = t;
  }

  /** Inject a splash (used by the preview for demo / tests). */
  splash(u: number, v: number, strength = 0.4) {
    const r = 0.05 * (this.preset?.water.rippleSize ?? 1);
    this.sim.addDrop({ ax: u, ay: 1 - v, bx: u, by: 1 - v, radius: r, strength });
  }

  private interact(dt: number, sensitivity: number, size: number, aspect: number) {
    const pt = this.pointer;
    pt.update(dt, aspect);
    if (!pt.inside) {
      pt.wasDown = false;
      return;
    }
    const sp = pt.speed(aspect);
    const radius = 0.028 * size * (0.75 + 0.25 * Math.min(1, sp));
    if (sp > 0.02) {
      const strength = -Math.min(0.09, sp * 0.022) * sensitivity;
      this.sim.addDrop({ ax: pt.px, ay: pt.py, bx: pt.x, by: pt.y, radius, strength });
    }
    if (pt.down && !pt.wasDown) {
      this.sim.addDrop({ ax: pt.x, ay: pt.y, bx: pt.x, by: pt.y, radius: radius * 2.2, strength: 0.35 * sensitivity });
    } else if (pt.down) {
      this.sim.addDrop({ ax: pt.x, ay: pt.y, bx: pt.x, by: pt.y, radius: radius * 1.2, strength: 0.01 * sensitivity });
    }
    pt.wasDown = pt.down;
  }

  private loop = (now: number) => {
    if (this.destroyed || this.paused) return;
    this.raf = requestAnimationFrame(this.loop);
    const p = this.preset;
    if (!p) return;
    const cap = this.throttle ? Math.min(30, p.fpsCap) : p.fpsCap;
    if (now - this.lastDraw < 1000 / Math.max(10, cap) - 1.5) return;
    this.lastDraw = now;
    const dt = Math.min(0.1, Math.max(0.001, (now - (this.last || now)) / 1000));
    this.last = now;
    this.time += dt * (p.kind === "shader" ? p.shader.speed : 1);
    this.frame(p, now, dt);

    this.fpsFrames++;
    if (now - this.fpsAt > 1000) {
      this.opts.onFps?.((this.fpsFrames * 1000) / (now - this.fpsAt));
      this.fpsFrames = 0;
      this.fpsAt = now;
    }
  };

  private frame(p: Preset, now: number, dt: number) {
    const gl = this.gl;
    const { w, h } = this;
    const aspect = w / h;
    const isWater = p.kind === "water";
    const rip = p.effects.ripples;
    const needsSim = isWater || rip.enabled;

    if (needsSim) {
      if (isWater) {
        this.interact(dt, p.water.mouseSensitivity, p.water.rippleSize, aspect);
        this.ambientAcc += dt * p.water.ambientDrops;
        while (this.ambientAcc >= 1) {
          this.ambientAcc -= 1;
          const x = Math.random(), y = Math.random();
          this.sim.addDrop({ ax: x, ay: y, bx: x, by: y, radius: 0.012 + Math.random() * 0.012, strength: 0.06 + Math.random() * 0.08 });
        }
        this.sim.step(dt, p.water.waveSpeed, p.water.persistence);
      } else {
        this.interact(dt, rip.strength, rip.size, aspect);
        this.sim.step(dt, 1, rip.persistence);
      }
    } else {
      this.pointer.update(dt, aspect);
    }

    // 1) source
    let tex: WebGLTexture;
    if (isWater) {
      this.water.renderPool(this.src, w, h, this.sim, p.water, this.time);
      tex = this.src.tex;
    } else if (p.kind === "video" && this.video) {
      this.video.update(now, dt);
      this.video.render(this.src, now);
      tex = this.src.tex;
    } else if (p.kind === "shader" && this.shader) {
      const pt = this.pointer;
      const mx = p.shader.mouse ? pt.x * w : w / 2;
      const my = p.shader.mouse ? pt.y * h : h / 2;
      this.shader.render(this.src, this.time, dt, [mx, my, pt.down ? mx : -mx, pt.down ? my : -my]);
      tex = this.src.tex;
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.src.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      tex = this.src.tex;
    }

    // 2) interactive ripple overlay on video / shader wallpapers
    if (!isWater && rip.enabled) {
      this.water.renderOverlay(this.rip, w, h, this.sim, tex, {
        waveIntensity: 1,
        refraction: rip.refraction,
        caustics: 0.6,
        clarity: 1,
        depth: 0.4,
        specular: rip.specular,
        reflection: 0.25,
      }, this.time);
      tex = this.rip.tex;
    }

    // 3) post processing to screen
    this.post.render(tex, w, h, w, h, p.filters, this.time);

    // 4) cursor trail / particles
    const t = p.effects.trail;
    if (t.enabled || !this.trail.idle) {
      const pt = this.pointer;
      const pxScale = h / 1080;
      this.trail.update(dt, now, pt.x * w, pt.y * h, pt.vx * w, pt.vy * h, t.enabled && pt.inside, t, pxScale);
      this.trail.draw(w, h, now, t, pxScale);
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.video?.dispose();
    this.shader?.dispose();
    this.sim.dispose();
    this.water.dispose();
    this.post.dispose();
    this.trail.dispose();
    disposeTarget(this.gl, this.src);
    disposeTarget(this.gl, this.rip);
    this.tri.dispose();
  }
}
