import { GL, Program, hexToRgb, hslToRgb } from "./gl";
import { PARTICLE_FS, PARTICLE_VS } from "./shaders";
import type { EffectsSettings } from "../shared/types";

const MAX = 4096;
const STRIDE = 7; // x, y, size, r, g, b, a

/** Cursor particles + glowing light trail, drawn as additive point sprites. */
export class TrailFX {
  private prog: Program;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private data = new Float32Array(MAX * STRIDE);
  // particle state (pixels)
  private px = new Float32Array(MAX);
  private py = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private hue = new Float32Array(MAX);
  private count = 0;
  private trail: { x: number; y: number; t: number }[] = [];
  private emitAcc = 0;

  constructor(private gl: GL) {
    this.prog = new Program(gl, PARTICLE_VS, PARTICLE_FS);
    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const B = 4 * STRIDE;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, B, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, B, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, B, 12);
    gl.bindVertexArray(null);
  }

  reset() {
    this.count = 0;
    this.trail = [];
  }

  private spawn(x: number, y: number, vx: number, vy: number, s: number, life: number, hue: number) {
    if (this.count >= MAX) return;
    const i = this.count++;
    this.px[i] = x; this.py[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.size[i] = s; this.life[i] = life; this.maxLife[i] = life; this.hue[i] = hue;
  }

  /**
   * @param x,y   cursor in pixels (bottom-left origin)
   * @param vx,vy cursor velocity px/s
   */
  update(dt: number, now: number, x: number, y: number, vx: number, vy: number, active: boolean, e: EffectsSettings["trail"], pxScale: number) {
    const speed = Math.hypot(vx, vy);
    const hueBase = (now * 0.00008) % 1;
    if (active && (e.style === "particles" || e.style === "both")) {
      this.emitAcc += dt * Math.min(600, speed * 0.08 * e.amount) + (speed > 30 ? dt * 20 * e.amount : 0);
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const sp = (20 + Math.random() * 90) * pxScale;
        this.spawn(
          x + (Math.random() - 0.5) * 6 * pxScale,
          y + (Math.random() - 0.5) * 6 * pxScale,
          vx * 0.15 + Math.cos(a) * sp,
          vy * 0.15 + Math.sin(a) * sp,
          (4 + Math.random() * 10) * e.size * pxScale,
          0.5 + Math.random() * 0.9,
          hueBase + Math.random() * 0.08,
        );
      }
    }
    // integrate + compact
    let w = 0;
    const drag = Math.exp(-dt * 2.5);
    for (let i = 0; i < this.count; i++) {
      const l = this.life[i] - dt;
      if (l <= 0) continue;
      this.px[w] = this.px[i] + this.vx[i] * dt;
      this.py[w] = this.py[i] + this.vy[i] * dt;
      this.vx[w] = this.vx[i] * drag;
      this.vy[w] = this.vy[i] * drag + 18 * pxScale * dt; // gentle float upward
      this.life[w] = l;
      this.maxLife[w] = this.maxLife[i];
      this.size[w] = this.size[i];
      this.hue[w] = this.hue[i];
      w++;
    }
    this.count = w;

    // light trail history
    if (active && (e.style === "light" || e.style === "both")) {
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > 1) this.trail.push({ x, y, t: now });
    }
    const maxAge = Math.max(0.05, e.length) * 1000;
    while (this.trail.length && now - this.trail[0].t > maxAge) this.trail.shift();
    if (this.trail.length > 400) this.trail.splice(0, this.trail.length - 400);
  }

  draw(w: number, h: number, now: number, e: EffectsSettings["trail"], pxScale: number) {
    const base = hexToRgb(e.color);
    const color = (hue: number): [number, number, number] => (e.rainbow ? hslToRgb(hue % 1, 0.9, 0.62) : base);
    let n = 0;
    const d = this.data;
    const put = (x: number, y: number, s: number, c: [number, number, number], a: number) => {
      if (n >= MAX) return;
      const o = n * STRIDE;
      d[o] = x; d[o + 1] = y; d[o + 2] = s; d[o + 3] = c[0]; d[o + 4] = c[1]; d[o + 5] = c[2]; d[o + 6] = a;
      n++;
    };
    // trail: densely sampled sprites along the polyline, tapering with age
    const maxAge = Math.max(0.05, e.length) * 1000;
    const step = 2.5 * pxScale;
    for (let i = 1; i < this.trail.length; i++) {
      const p0 = this.trail[i - 1];
      const p1 = this.trail[i];
      const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const k = Math.max(1, Math.ceil(len / step));
      for (let j = 0; j < k; j++) {
        const f = j / k;
        const t = p0.t + (p1.t - p0.t) * f;
        const age = 1 - (now - t) / maxAge;
        if (age <= 0) continue;
        const hue = (t * 0.0002) % 1;
        put(p0.x + (p1.x - p0.x) * f, p0.y + (p1.y - p0.y) * f, (6 + 22 * age) * e.size * pxScale, color(hue), 0.35 * age * age);
      }
    }
    for (let i = 0; i < this.count; i++) {
      const a = this.life[i] / this.maxLife[i];
      put(this.px[i], this.py[i], this.size[i] * (0.4 + 0.6 * a), color(this.hue[i]), 0.9 * a);
    }
    if (!n) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.prog.use().f2("uResolution", w, h);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * STRIDE);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  get idle() {
    return this.count === 0 && this.trail.length === 0;
  }

  dispose() {
    this.prog.dispose();
    this.gl.deleteBuffer(this.buf);
    this.gl.deleteVertexArray(this.vao);
  }
}
