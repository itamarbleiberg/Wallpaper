import { FullscreenTri, GL, Program, Target, bindTarget, createTarget, disposeTarget, resizeTarget } from "./gl";
import { WaterRenderer, WaterSim } from "./WaterSim";
import { VideoSource } from "./VideoSource";
import { ShaderSource } from "./ShaderSource";
import { ImageSource } from "./ImageSource";
import { PostFX, type PostView } from "./PostFX";
import { TrailFX } from "./TrailFX";
import { PondLife } from "./PondLife";
import { FULLSCREEN_VS, TRANSITION_FS } from "./shaders";
import type { Preset } from "../shared/types";

export interface RendererOptions {
  /** Map a local file path to a URL the <video>/<img> element can load. */
  resolveVideoUrl: (path: string) => string;
  onError?: (source: "shader" | "video" | "image" | "gl", msg: string | null) => void;
  onFps?: (fps: number) => void;
  onVideoTime?: (t: number, duration: number) => void;
  /** Render at a fixed size without a RAF loop (thumbnails). */
  offscreen?: { width: number; height: number };
}

export interface GlobalAdjust { brightness: number; warmth: number }

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
  private image: ImageSource | null = null;
  private post: PostFX;
  private trail: TrailFX;
  private life = new PondLife();
  private transProg: Program;
  private src: Target;
  private rip: Target;
  private from: Target;
  private to: Target;
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
  private ro: ResizeObserver | null = null;
  private fpsFrames = 0;
  private fpsAt = 0;
  private ambientAcc = 0;
  private w = 1;
  private h = 1;
  private hasFrame = false;
  // transitions
  private trans = { active: false, t: 0, duration: 1, type: 0 };
  transition: { type: "fade" | "ripple" | "none"; duration: number } = { type: "fade", duration: 1.2 };
  // audio
  private bassAvg = 0;
  private lastBeat = 0;
  private pulse = 0;
  // extras
  private rain = 0;
  private adjust: GlobalAdjust = { brightness: 1, warmth: 0 };
  private par = { x: 0, y: 0 };

  constructor(private canvas: HTMLCanvasElement, private opts: RendererOptions) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
      desynchronized: !opts.offscreen,
    });
    if (!gl) throw new Error("WebGL2 is not available on this system.");
    this.gl = gl;
    this.tri = new FullscreenTri(gl);
    this.sim = new WaterSim(gl, this.tri, 64, 36);
    this.water = new WaterRenderer(gl, this.tri);
    this.post = new PostFX(gl, this.tri);
    this.trail = new TrailFX(gl);
    this.transProg = new Program(gl, FULLSCREEN_VS, TRANSITION_FS);
    this.src = createTarget(gl, 1, 1);
    this.rip = createTarget(gl, 1, 1);
    this.from = createTarget(gl, 1, 1);
    this.to = createTarget(gl, 1, 1);
    canvas.addEventListener("webglcontextlost", (e) => {
      if (this.destroyed) return;
      e.preventDefault();
      this.opts.onError?.("gl", "GPU context lost - reloading");
      if (!opts.offscreen) setTimeout(() => location.reload(), 1500);
    });
    if (opts.offscreen) {
      this.setSize(opts.offscreen.width, opts.offscreen.height);
    } else {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
      this.resize();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private setSize(w: number, h: number) {
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.w = w;
    this.h = h;
    for (const t of [this.src, this.rip, this.from, this.to]) resizeTarget(this.gl, t, w, h);
    this.resizeSim();
  }

  private resize() {
    if (this.opts.offscreen) return;
    const p = this.preset;
    const scale = Math.min(1, Math.max(0.25, p?.renderScale ?? 1));
    const dpr = window.devicePixelRatio || 1;
    this.setSize(
      Math.max(1, Math.round(this.canvas.clientWidth * dpr * scale)),
      Math.max(1, Math.round(this.canvas.clientHeight * dpr * scale)),
    );
  }

  private resizeSim() {
    const p = this.preset;
    const frac = p?.kind === "water" ? p.water.simResolution : 0.25;
    const sh = Math.max(32, Math.min(720, Math.round(this.h * Math.min(0.6, Math.max(0.1, frac)))));
    const sw = Math.max(32, Math.min(1280, Math.round(sh * (this.w / this.h))));
    this.sim.resize(sw, sh);
    this.sim.aspect = this.w / this.h;
  }

  get currentPresetId() {
    return this.preset?.id ?? null;
  }

  setPreset(p: Preset) {
    const prev = this.preset;
    const switching = !!prev && prev.id !== p.id;
    // Freeze the outgoing wallpaper for the transition.
    if (switching && this.hasFrame && this.transition.type !== "none" && !this.opts.offscreen && !this.paused) {
      this.frame(prev!, performance.now(), 1 / 60, this.from);
      this.trans = { active: true, t: 0, duration: Math.max(0.2, this.transition.duration), type: this.transition.type === "ripple" ? 1 : 0 };
    }
    this.preset = structuredClone(p);
    if (!prev || prev.renderScale !== p.renderScale || prev.water.simResolution !== p.water.simResolution || prev.kind !== p.kind) this.resize();
    if (this.opts.offscreen && (!prev || prev.kind !== p.kind || prev.water.simResolution !== p.water.simResolution)) this.resizeSim();

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
    if (p.kind === "image") {
      if (!this.image) {
        this.image = new ImageSource(this.gl, this.tri);
        this.image.onError = (m) => this.opts.onError?.("image", m);
      }
      if (p.image.path) {
        this.opts.onError?.("image", null);
        this.image.load(this.opts.resolveVideoUrl(p.image.path));
      }
    }
    if (p.kind === "shader") {
      if (!this.shader) this.shader = new ShaderSource(this.gl, this.tri);
      this.opts.onError?.("shader", this.shader.setCode(p.shader.code));
    }
    if (p.kind === "water") this.life.configure(p.water.koi, p.water.lilyPads, this.w / this.h);
    if (switching || (prev && prev.kind !== p.kind)) {
      this.sim.clear();
      this.trail.reset();
      if (this.trans.active && this.trans.type === 1) this.splash(0.5, 0.5, 0.5);
    }
  }

  setPointer(u: number, v: number, down: boolean, inside: boolean) {
    this.pointer.set(u, 1 - v, down, inside);
  }

  /** 64 log-spaced bands 0..1 from the system audio loopback. */
  setAudio(bands: ArrayLike<number>) {
    this.shader?.setAudio(bands);
    let b = 0;
    for (let i = 0; i < 5 && i < bands.length; i++) b += bands[i];
    b /= 5;
    this.bassAvg = this.bassAvg * 0.92 + b * 0.08;
    const now = performance.now();
    if (b > 0.28 && b > this.bassAvg * 1.3 && now - this.lastBeat > 180) {
      this.lastBeat = now;
      this.onBeat(Math.min(1, (b - this.bassAvg) * 3));
    }
  }

  private onBeat(power: number) {
    const p = this.preset;
    if (!p) return;
    this.pulse = Math.max(this.pulse, power);
    const amt = p.effects.audioRipples;
    if (amt > 0 && (p.kind === "water" || p.effects.ripples.enabled)) {
      const n = 1 + Math.round(power * 2);
      for (let i = 0; i < n; i++) {
        const x = 0.1 + Math.random() * 0.8, y = 0.1 + Math.random() * 0.8;
        this.sim.addDrop({ ax: x, ay: y, bx: x, by: y, radius: 0.03 + 0.03 * power, strength: (0.15 + 0.25 * power) * amt });
      }
    }
  }

  /** 0..1 extra rain (weather sync). */
  setRain(intensity: number) {
    this.rain = Math.max(0, Math.min(1, intensity));
  }

  setGlobalAdjust(a: GlobalAdjust) {
    this.adjust = a;
  }

  setPaused(p: boolean) {
    if (p === this.paused) return;
    this.paused = p;
    this.video?.setPaused(p);
    if (!p && !this.destroyed && !this.opts.offscreen) {
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

  splash(u: number, v: number, strength = 0.4) {
    const r = 0.05 * (this.preset?.water.rippleSize ?? 1);
    this.sim.addDrop({ ax: u, ay: 1 - v, bx: u, by: 1 - v, radius: r, strength });
  }

  private click(x: number, y: number, radius: number, sensitivity: number) {
    const p = this.preset!;
    const effect = p.kind === "water" ? p.water.clickEffect : "splash";
    if (effect === "ring") {
      this.sim.addDrop({ ax: x, ay: y, bx: x, by: y, radius: radius * 3.2, strength: 0.3 * sensitivity });
      this.sim.addDrop({ ax: x, ay: y, bx: x, by: y, radius: radius * 1.8, strength: -0.45 * sensitivity });
    } else if (effect === "bubbles") {
      this.sim.addDrop({ ax: x, ay: y, bx: x, by: y, radius: radius * 1.4, strength: 0.18 * sensitivity });
      this.trail.burst(x * this.w, y * this.h, 60, this.h / 1080, p.effects.trail.color);
    } else {
      this.sim.addDrop({ ax: x, ay: y, bx: x, by: y, radius: radius * 2.2, strength: 0.35 * sensitivity });
    }
    this.life.startle(x, y, 1);
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
    if (pt.down && !pt.wasDown) this.click(pt.x, pt.y, radius, sensitivity);
    else if (pt.down) this.sim.addDrop({ ax: pt.x, ay: pt.y, bx: pt.x, by: pt.y, radius: radius * 1.2, strength: 0.01 * sensitivity });
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
    this.step(p, now, dt);

    this.fpsFrames++;
    if (now - this.fpsAt > 1000) {
      this.opts.onFps?.((this.fpsFrames * 1000) / (now - this.fpsAt));
      this.fpsFrames = 0;
      this.fpsAt = now;
    }
  };

  /** Advance simulation + draw one frame to the screen (with transition/trails). */
  private step(p: Preset, now: number, dt: number) {
    this.time += dt * (p.kind === "shader" ? p.shader.speed : 1);
    this.pulse *= Math.exp(-dt * 6);
    if (this.trans.active) {
      this.trans.t += dt / this.trans.duration;
      this.frame(p, now, dt, this.to);
      const gl = this.gl;
      bindTarget(gl, null, this.w, this.h);
      this.transProg.use()
        .tex("uFrom", 0, this.from.tex)
        .tex("uTo", 1, this.to.tex)
        .f1("uProgress", Math.min(1, this.trans.t))
        .i1("uType", this.trans.type)
        .f2("uCenter", this.pointer.inside ? this.pointer.x : 0.5, this.pointer.inside ? this.pointer.y : 0.5)
        .f1("uAspect", this.w / this.h);
      this.tri.draw();
      if (this.trans.t >= 1) this.trans.active = false;
    } else {
      this.frame(p, now, dt, null);
    }
    const t = p.effects.trail;
    if (t.enabled || !this.trail.idle) {
      const pt = this.pointer;
      const pxScale = this.h / 1080;
      this.trail.update(dt, now, pt.x * this.w, pt.y * this.h, pt.vx * this.w, pt.vy * this.h, t.enabled && pt.inside, t, pxScale);
      this.trail.draw(this.w, this.h, now, t, pxScale);
    }
    this.hasFrame = true;
  }

  private frame(p: Preset, now: number, dt: number, out: Target | null) {
    const gl = this.gl;
    const { w, h } = this;
    const aspect = w / h;
    const isWater = p.kind === "water";
    const rip = p.effects.ripples;
    const needsSim = isWater || rip.enabled;
    const pt = this.pointer;

    if (out !== this.from) {
      if (needsSim) {
        if (isWater) {
          this.interact(dt, p.water.mouseSensitivity, p.water.rippleSize, aspect);
          this.ambientAcc += dt * (p.water.ambientDrops + this.rain * 25);
          this.life.update(dt, p.water.koiSpeed, pt.x, pt.y, pt.vx, pt.vy, pt.inside);
        } else {
          this.interact(dt, rip.strength, rip.size, aspect);
          this.ambientAcc += dt * this.rain * 20;
        }
        while (this.ambientAcc >= 1) {
          this.ambientAcc -= 1;
          const x = Math.random(), y = Math.random();
          this.sim.addDrop({ ax: x, ay: y, bx: x, by: y, radius: 0.01 + Math.random() * 0.012, strength: 0.06 + Math.random() * 0.08 });
        }
        if (isWater) this.sim.step(dt, p.water.waveSpeed, p.water.persistence);
        else this.sim.step(dt, 1, rip.persistence);
      } else {
        pt.update(dt, aspect);
      }
    }

    // 1) source
    let tex: WebGLTexture = this.src.tex;
    if (isWater) {
      this.water.renderPool(this.src, w, h, this.sim, p.water, this.time, this.life);
    } else if (p.kind === "video" && this.video) {
      if (out !== this.from) this.video.update(now, dt);
      this.video.render(this.src, now);
    } else if (p.kind === "image" && this.image) {
      this.image.render(this.src, this.time, p.image);
    } else if (p.kind === "shader" && this.shader) {
      const mx = p.shader.mouse ? pt.x * w : w / 2;
      const my = p.shader.mouse ? pt.y * h : h / 2;
      this.shader.render(this.src, this.time, dt, [mx, my, pt.down ? mx : -mx, pt.down ? my : -my]);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.src.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // 2) ripple overlay on video / image / shader wallpapers
    if (!isWater && rip.enabled) {
      this.water.renderOverlay(this.rip, w, h, this.sim, tex, {
        waveIntensity: 1, refraction: rip.refraction, caustics: 0.6, clarity: 1, depth: 0.4, specular: rip.specular, reflection: 0.25,
      }, this.time);
      tex = this.rip.tex;
    }

    // 3) post processing (parallax, beat pulse, grading)
    const par = p.effects.parallax;
    const tx = pt.inside ? (pt.x - 0.5) : 0;
    const ty = pt.inside ? (pt.y - 0.5) : 0;
    const k = 1 - Math.exp(-dt * 3);
    this.par.x += (tx - this.par.x) * k;
    this.par.y += (ty - this.par.y) * k;
    const pulse = this.pulse * p.effects.beatPulse;
    const view: PostView = {
      offsetX: this.par.x * par * 0.035,
      offsetY: this.par.y * par * 0.035,
      zoom: 1 + par * 0.08 + pulse * 0.025,
      brightness: this.adjust.brightness * (1 + pulse * 0.22),
      warmth: this.adjust.warmth,
    };
    this.post.render(tex, w, h, out, w, h, p.filters, this.time, view);
  }

  /** Render the current preset at its current size and return a PNG data URL. */
  capture(type = "image/png", quality?: number): string {
    if (this.preset) this.frame(this.preset, performance.now(), 1 / 60, null);
    return this.canvas.toDataURL(type, quality);
  }

  /** Offscreen thumbnail: simulate a few frames (with a scripted swipe) and grab the result. */
  thumbnail(p: Preset, frames = 24): string {
    this.preset = null;
    this.trans.active = false;
    this.setPreset(p);
    this.sim.clear();
    this.time = 3 + (p.id.length % 7);
    const dt = 1 / 30;
    for (let i = 0; i < frames; i++) {
      const f = i / frames;
      this.setPointer(0.3 + 0.4 * f, 0.6 + 0.08 * Math.sin(f * 6), false, true);
      this.time += dt;
      this.frame(p, i * 33, dt, null);
    }
    this.setPointer(0.5, 0.5, false, false);
    return this.canvas.toDataURL("image/jpeg", 0.82);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.video?.dispose();
    this.shader?.dispose();
    this.image?.dispose();
    this.sim.dispose();
    this.water.dispose();
    this.post.dispose();
    this.trail.dispose();
    this.transProg.dispose();
    for (const t of [this.src, this.rip, this.from, this.to]) disposeTarget(this.gl, t);
    this.tri.dispose();
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
