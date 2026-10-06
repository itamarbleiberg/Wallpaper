import { FullscreenTri, GL, Program, Target, bindTarget, createTexture } from "./gl";
import { FULLSCREEN_VS, VIDEO_FS } from "./shaders";
import type { VideoSettings } from "../shared/types";

type RVFC = (cb: (now: number, meta: { mediaTime: number }) => void) => number;

class VideoSlot {
  readonly el: HTMLVideoElement;
  tex: WebGLTexture;
  prev: WebGLTexture;
  w = 0;
  h = 0;
  lastFrameAt = 0;
  interval = 33;
  pending = false;
  hasFrame = false;
  private rvfc: boolean;

  constructor(private gl: GL) {
    const el = document.createElement("video");
    el.crossOrigin = "anonymous";
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.loop = false;
    this.el = el;
    this.tex = this.blank();
    this.prev = this.blank();
    this.rvfc = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
    if (this.rvfc) this.watch();
    el.addEventListener("seeked", () => (this.pending = true));
    el.addEventListener("loadeddata", () => (this.pending = true));
  }

  private blank(): WebGLTexture {
    const gl = this.gl;
    const t = createTexture(gl, 1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    return t;
  }

  private watch() {
    const r = (this.el as unknown as { requestVideoFrameCallback: RVFC }).requestVideoFrameCallback.bind(this.el);
    const cb = () => {
      this.pending = true;
      r(cb);
    };
    r(cb);
  }

  load(url: string) {
    this.hasFrame = false;
    this.el.src = url;
    this.el.load();
  }

  /** Upload the newest decoded frame (keeps the previous one for blending). */
  upload(now: number) {
    const el = this.el;
    if (el.readyState < 2) return;
    if (this.rvfc && !this.pending) return;
    if (!this.rvfc && el.paused && this.hasFrame) return;
    this.pending = false;
    const gl = this.gl;
    const t = this.prev;
    this.prev = this.tex;
    this.tex = t;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
    } catch (e) {
      console.warn("video upload failed", e);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (!this.hasFrame) {
      // first frame: make prev identical to avoid blending with black
      const p = this.prev;
      gl.bindTexture(gl.TEXTURE_2D, p);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, el); } catch { /* ignore */ }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    this.w = el.videoWidth;
    this.h = el.videoHeight;
    const d = now - this.lastFrameAt;
    if (this.hasFrame && d > 4 && d < 500) this.interval = this.interval * 0.8 + d * 0.2;
    this.lastFrameAt = now;
    this.hasFrame = true;
  }

  blend(now: number, enabled: boolean): number {
    if (!enabled || this.el.paused) return 1;
    return Math.min(1, Math.max(0, (now - this.lastFrameAt) / Math.max(this.interval, 1)));
  }

  dispose() {
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
    this.gl.deleteTexture(this.tex);
    this.gl.deleteTexture(this.prev);
  }
}

/**
 * Video wallpaper source with seamless looping:
 *  - loop: a second, pre-seeked decoder takes over at the out point (no seek hitch)
 *  - crossfade: the second decoder starts early and the shader blends both
 *  - pingpong: forward playback, then reverse by stepping (bake for perfect results)
 */
export class VideoSource {
  private slots: [VideoSlot, VideoSlot];
  private front = 0;
  private prog: Program;
  private url = "";
  private s: VideoSettings | null = null;
  private dir = 1;
  private mix = 0;
  private paused = false;
  private forceMuted = false;
  error: string | null = null;
  onError?: (msg: string) => void;
  onTime?: (t: number, duration: number) => void;

  constructor(private gl: GL, private tri: FullscreenTri) {
    this.slots = [new VideoSlot(gl), new VideoSlot(gl)];
    this.prog = new Program(gl, FULLSCREEN_VS, VIDEO_FS);
    for (const sl of this.slots) {
      sl.el.addEventListener("error", () => {
        const code = sl.el.error?.code;
        this.error = code === 4 ? "This video format/codec is not supported. Use 'Bake' to convert it to H.264 MP4." : "Could not load video.";
        this.onError?.(this.error);
      });
      sl.el.addEventListener("loadedmetadata", () => this.prime());
    }
  }

  get duration() {
    const d = this.slots[0].el.duration;
    return Number.isFinite(d) ? d : 0;
  }

  private get outPoint() {
    const s = this.s!;
    const d = this.duration;
    const o = s.outPoint == null || s.outPoint <= 0 ? d : Math.min(s.outPoint, d || s.outPoint);
    return Math.max(o, s.inPoint + 0.1);
  }

  configure(url: string, s: VideoSettings) {
    const prev = this.s;
    this.s = s;
    if (url !== this.url) {
      this.url = url;
      this.error = null;
      this.front = 0;
      this.mix = 0;
      this.dir = 1;
      for (const sl of this.slots) sl.load(url);
      return;
    }
    if (!prev || prev.inPoint !== s.inPoint || prev.outPoint !== s.outPoint || prev.loopMode !== s.loopMode) this.prime();
    this.applyAudio();
    for (const sl of this.slots) sl.el.playbackRate = this.rate();
  }

  private rate() {
    return Math.min(4, Math.max(0.25, this.s?.speed ?? 1));
  }

  /** Seek both decoders to the in point and start the front one. */
  private prime() {
    if (!this.s || !this.duration) return;
    const inP = Math.min(this.s.inPoint, Math.max(0, this.duration - 0.2));
    this.mix = 0;
    this.dir = 1;
    this.slots.forEach((sl, i) => {
      sl.el.playbackRate = this.rate();
      sl.el.currentTime = inP;
      if (i !== this.front) sl.el.pause();
    });
    this.applyAudio();
    if (!this.paused) this.play(this.slots[this.front]);
  }

  private play(sl: VideoSlot) {
    sl.el.play().catch(() => {
      sl.el.muted = true;
      sl.el.play().catch(() => undefined);
    });
  }

  private applyAudio() {
    if (!this.s) return;
    const muted = this.s.muted || this.forceMuted;
    const v = Math.min(1, Math.max(0, this.s.volume));
    this.slots.forEach((sl, i) => {
      sl.el.muted = muted;
      sl.el.volume = i === this.front ? v * (1 - this.mix) : v * this.mix;
    });
  }

  setPaused(p: boolean) {
    if (p === this.paused) return;
    this.paused = p;
    for (const sl of this.slots) {
      if (p) sl.el.pause();
    }
    if (!p && this.s) {
      this.play(this.slots[this.front]);
      if (this.mix > 0) this.play(this.slots[1 - this.front]);
    }
  }

  setMuted(m: boolean) {
    this.forceMuted = m;
    this.applyAudio();
  }

  private swap() {
    const old = this.slots[this.front];
    this.front = 1 - this.front;
    this.mix = 0;
    old.el.pause();
    old.el.currentTime = this.s!.inPoint;
    this.applyAudio();
  }

  update(now: number, dt: number) {
    const s = this.s;
    if (!s || !this.duration || this.paused) {
      this.slots.forEach((sl) => sl.upload(now));
      return;
    }
    const f = this.slots[this.front];
    const b = this.slots[1 - this.front];
    const inP = s.inPoint;
    const outP = this.outPoint;
    const t = f.el.currentTime;
    const eps = 0.035;

    if (t < inP - 0.25 || t > outP + 0.5) {
      f.el.currentTime = inP;
    } else if (s.loopMode === "pingpong") {
      if (this.dir > 0 && (t >= outP - eps || f.el.ended)) {
        f.el.pause();
        this.dir = -1;
      } else if (this.dir < 0) {
        if (!f.el.seeking) {
          const nt = t - dt * this.rate();
          if (nt <= inP) {
            f.el.currentTime = inP;
            this.dir = 1;
            this.play(f);
          } else {
            f.el.currentTime = nt;
          }
        }
      }
    } else if (s.loopMode === "crossfade") {
      const span = outP - inP;
      const cf = Math.min(Math.max(0.05, s.crossfade * this.rate()), span / 2);
      const start = outP - cf;
      if (t >= start) {
        if (b.el.paused) this.play(b);
        this.mix = Math.min(1, (t - start) / cf);
        this.applyAudio();
      }
      if (t >= outP - eps || f.el.ended) {
        if (b.el.paused) this.play(b);
        this.swap();
      }
    } else {
      if (t >= outP - eps || f.el.ended) {
        this.play(b);
        this.swap();
      }
    }

    for (const sl of this.slots) sl.upload(now);
    this.onTime?.(this.slots[this.front].el.currentTime, this.duration);
  }

  render(target: Target, now: number) {
    const gl = this.gl;
    const s = this.s;
    bindTarget(gl, target);
    const f = this.slots[this.front];
    const b = this.slots[1 - this.front];
    if (!s || !f.hasFrame) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    const blendOn = s.frameBlend;
    this.prog.use()
      .tex("uFront", 0, f.tex)
      .tex("uFrontPrev", 1, f.prev)
      .tex("uBack", 2, b.tex)
      .tex("uBackPrev", 3, b.prev)
      .f1("uFrontBlend", f.blend(now, blendOn))
      .f1("uBackBlend", b.blend(now, blendOn))
      .f1("uMix", b.hasFrame ? this.mix : 0)
      .f2("uFrontSize", f.w, f.h)
      .f2("uBackSize", b.w || f.w, b.h || f.h)
      .f2("uOut", target.w, target.h)
      .i1("uFit", s.fit === "cover" ? 0 : s.fit === "contain" ? 1 : 2)
      .i1("uBicubic", s.bicubic ? 1 : 0)
      .f1("uOpacity", Math.min(1, Math.max(0, s.opacity)));
    this.tri.draw();
  }

  dispose() {
    this.slots.forEach((s) => s.dispose());
    this.prog.dispose();
  }
}
