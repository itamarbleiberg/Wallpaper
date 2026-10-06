import { FullscreenTri, GL, Program, Target, bindTarget, createTarget, disposeTarget, hexToRgb } from "./gl";
import { FULLSCREEN_VS, SIM_DROP_FS, SIM_UPDATE_FS, WATER_FS } from "./shaders";
import type { WaterSettings } from "../shared/types";
import type { PondLife } from "./PondLife";

export interface Drop { ax: number; ay: number; bx: number; by: number; radius: number; strength: number }

/** GPU height-field wave simulation (ping-pong half-float textures). */
export class WaterSim {
  private a: Target;
  private b: Target;
  private update: Program;
  private drop: Program;
  private acc = 0;
  aspect = 16 / 9;

  constructor(private gl: GL, private tri: FullscreenTri, w: number, h: number) {
    const fmt = WaterSim.format(gl);
    this.a = createTarget(gl, w, h, fmt.internal, gl.RGBA, fmt.type);
    this.b = createTarget(gl, w, h, fmt.internal, gl.RGBA, fmt.type);
    this.clear();
    this.update = new Program(gl, FULLSCREEN_VS, SIM_UPDATE_FS);
    this.drop = new Program(gl, FULLSCREEN_VS, SIM_DROP_FS);
  }

  static format(gl: GL) {
    if (gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float")) {
      return { internal: gl.RGBA16F, type: gl.HALF_FLOAT };
    }
    throw new Error("This GPU/driver does not support float render targets (EXT_color_buffer_float).");
  }

  get width() { return this.a.w; }
  get height() { return this.a.h; }
  get texture() { return this.a.tex; }

  resize(w: number, h: number) {
    if (w === this.a.w && h === this.a.h) return;
    const gl = this.gl;
    const fmt = WaterSim.format(gl);
    disposeTarget(gl, this.a);
    disposeTarget(gl, this.b);
    this.a = createTarget(gl, w, h, fmt.internal, gl.RGBA, fmt.type);
    this.b = createTarget(gl, w, h, fmt.internal, gl.RGBA, fmt.type);
    this.clear();
  }

  clear() {
    const gl = this.gl;
    for (const t of [this.a, this.b]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private swap() {
    const t = this.a;
    this.a = this.b;
    this.b = t;
  }

  addDrop(d: Drop) {
    const gl = this.gl;
    bindTarget(gl, this.b);
    this.drop.use()
      .tex("uState", 0, this.a.tex)
      .f2("uA", d.ax, d.ay)
      .f2("uB", d.bx, d.by)
      .f1("uRadius", Math.max(d.radius, 0.002))
      .f1("uStrength", d.strength)
      .f1("uAspect", this.aspect);
    this.tri.draw();
    this.swap();
  }

  /** Advance with a fixed 60 Hz timestep. `waveSpeed` 0.2..3, `persistence` 0..1. */
  step(dt: number, waveSpeed: number, persistence: number) {
    this.acc = Math.min(this.acc + dt, 0.1);
    const tick = 1 / 60;
    const steps = Math.max(1, Math.ceil(waveSpeed));
    const coeff = Math.min(1.6, Math.max(0.12, (1.6 * waveSpeed) / steps));
    const damping = 0.95 + 0.0495 * Math.min(1, Math.max(0, persistence));
    const gl = this.gl;
    while (this.acc >= tick) {
      this.acc -= tick;
      for (let i = 0; i < steps; i++) {
        bindTarget(gl, this.b);
        this.update.use()
          .tex("uState", 0, this.a.tex)
          .f2("uTexel", 1 / this.a.w, 1 / this.a.h)
          .f1("uSpeed", coeff)
          .f1("uDamping", damping);
        this.tri.draw();
        this.swap();
      }
    }
  }

  dispose() {
    disposeTarget(this.gl, this.a);
    disposeTarget(this.gl, this.b);
    this.update.dispose();
    this.drop.dispose();
  }
}

export interface WaterLook {
  waveIntensity: number;
  refraction: number;
  caustics: number;
  clarity: number;
  depth: number;
  specular: number;
  reflection: number;
}

/** Renders the pool scene, or refracts a source texture through the ripples. */
export class WaterRenderer {
  private prog: Program;
  private life: PondLife | null = null;
  constructor(private gl: GL, private tri: FullscreenTri) {
    this.prog = new Program(gl, FULLSCREEN_VS, WATER_FS);
  }

  renderPool(target: Target | null, w: number, h: number, sim: WaterSim, s: WaterSettings, time: number, life: PondLife | null) {
    this.life = life;
    this.draw(target, w, h, sim, time, null, {
      waveIntensity: s.waveIntensity,
      refraction: s.refraction,
      caustics: s.caustics,
      clarity: s.clarity,
      depth: s.lightingDepth,
      specular: s.specular,
      reflection: s.reflection,
    }, s);
  }

  renderOverlay(target: Target | null, w: number, h: number, sim: WaterSim, source: WebGLTexture, look: WaterLook, time: number) {
    this.life = null;
    this.draw(target, w, h, sim, time, source, look, null);
  }

  private draw(target: Target | null, w: number, h: number, sim: WaterSim, time: number, source: WebGLTexture | null, look: WaterLook, s: WaterSettings | null) {
    const gl = this.gl;
    bindTarget(gl, target, w, h);
    const p = this.prog.use()
      .tex("uHeight", 0, sim.texture)
      .tex("uSource", 1, source)
      .i1("uUseSource", source ? 1 : 0)
      .f2("uSimTexel", 1 / sim.width, 1 / sim.height)
      .f2("uResolution", w, h)
      .f1("uTime", time)
      .f1("uWaveIntensity", look.waveIntensity)
      .f1("uRefraction", look.refraction)
      .f1("uCaustics", look.caustics)
      .f1("uClarity", look.clarity)
      .f1("uDepth", look.depth)
      .f1("uSpecular", look.specular)
      .f1("uReflection", look.reflection)
      .f3("uSunDir", 0.35, 0.55, 0.76);
    if (s) {
      const floors = { tiles: 0, sand: 1, plain: 2, mosaic: 3, pebbles: 4 } as const;
      p.f1("uTileScale", s.tileScale)
        .f1("uEdgeShadow", s.edgeShadow)
        .i1("uFloorStyle", floors[s.floorStyle] ?? 0)
        .f1("uPoolLights", s.poolLights)
        .c3("uLightColor", hexToRgb(s.lightColor))
        .i1("uFishCount", this.life ? this.life.fishCount : 0)
        .i1("uLilyCount", this.life ? this.life.padCount : 0);
      if (this.life) p.f4v("uFish", this.life.fishData).f4v("uLily", this.life.padData);
      p
        .c3("uWaterColor", hexToRgb(s.waterColor))
        .c3("uDeepColor", hexToRgb(s.deepColor))
        .c3("uTileColor", hexToRgb(s.tileColor))
        .c3("uGroutColor", hexToRgb(s.groutColor));
    } else {
      p.f1("uTileScale", 8).f1("uEdgeShadow", 0).i1("uFloorStyle", 2).f1("uPoolLights", 0).i1("uFishCount", 0).i1("uLilyCount", 0)
        .f3("uWaterColor", 0, 0, 0).f3("uDeepColor", 0, 0, 0).f3("uTileColor", 1, 1, 1).f3("uGroutColor", 1, 1, 1);
    }
    this.tri.draw();
  }

  dispose() { this.prog.dispose(); }
}
