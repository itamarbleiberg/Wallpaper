import { FullscreenTri, GL, Program, Target, bindTarget, createTarget, disposeTarget, hexToRgb, resizeTarget } from "./gl";
import { BLUR_FS, FULLSCREEN_VS, GEOM_FS, POST_FS } from "./shaders";
import type { ChromaSettings, FilterSettings, GradeSettings, TransformSettings } from "../shared/types";

export interface PostView { offsetX: number; offsetY: number; zoom: number; brightness: number; warmth: number }

/** The full v3 "look" applied after the source renders. */
export interface Look {
  filters: FilterSettings;
  grade: GradeSettings;
  transform: TransformSettings;
  chroma: ChromaSettings;
  bloom: number;
  chromatic: number;
  mirror: "none" | "x" | "y" | "quad" | "kaleido";
}

const MIRROR = { none: 0, x: 1, y: 2, quad: 3, kaleido: 4 } as const;

/** Geometry/chroma stage, sharpening, grading, blur, bloom, vignette, grain. */
export class PostFX {
  private geom: Program;
  private post: Program;
  private blur: Program;
  private geomTarget: Target | null = null;
  private bA: Target | null = null;
  private bB: Target | null = null;

  constructor(private gl: GL, private tri: FullscreenTri) {
    this.geom = new Program(gl, FULLSCREEN_VS, GEOM_FS);
    this.post = new Program(gl, FULLSCREEN_VS, POST_FS);
    this.blur = new Program(gl, FULLSCREEN_VS, BLUR_FS);
  }

  private ensure(ref: "bA" | "bB" | "geomTarget", w: number, h: number) {
    const cur = this[ref];
    if (!cur) this[ref] = createTarget(this.gl, w, h);
    else resizeTarget(this.gl, cur, w, h);
    return this[ref]!;
  }

  render(src: WebGLTexture, srcW: number, srcH: number, out: Target | null, outW: number, outH: number, look: Look, time: number, view: PostView) {
    const gl = this.gl;
    const f = look.filters;
    const g = look.grade;
    const t = look.transform;
    const needGeom =
      look.mirror !== "none" ||
      look.chroma.enabled ||
      (t.enabled && (t.zoom !== 1 || t.posX || t.posY || t.rotate || t.flipH || t.flipV || t.cropL || t.cropR || t.cropT || t.cropB));

    // Stage 1: geometry + chroma into geomTarget (optional).
    let input = src;
    if (needGeom) {
      const gt = this.ensure("geomTarget", srcW, srcH);
      bindTarget(gl, gt);
      const key = hexToRgb(look.chroma.color);
      const back = hexToRgb(look.chroma.backdrop);
      this.geom.use()
        .tex("uSrc", 0, src)
        .f1("uAspect", srcW / srcH)
        .f1("uZoom", t.enabled ? Math.max(0.2, t.zoom) : 1)
        .f2("uPos", t.enabled ? t.posX : 0, t.enabled ? t.posY : 0)
        .f1("uRot", t.enabled ? (t.rotate * Math.PI) / 180 : 0)
        .f2("uFlip", t.enabled && t.flipH ? -1 : 1, t.enabled && t.flipV ? -1 : 1)
        .f4("uCrop", t.enabled ? t.cropL : 0, t.enabled ? t.cropR : 0, t.enabled ? t.cropT : 0, t.enabled ? t.cropB : 0)
        .f1("uFeather", t.enabled ? t.cropFeather : 0)
        .i1("uMirror", MIRROR[look.mirror])
        .i1("uChroma", look.chroma.enabled ? 1 : 0)
        .f3("uKeyCol", key[0], key[1], key[2])
        .f1("uSimil", look.chroma.similarity)
        .f1("uSmooth", look.chroma.smoothness)
        .f1("uSpill", look.chroma.spill)
        .f3("uBackdrop", back[0], back[1], back[2]);
      this.tri.draw();
      input = gt.tex;
    }

    // Stage 2: blur buffer (shared by blur filter + bloom).
    const needBlur = f.blur > 0.001 || look.bloom > 0.001;
    let blurTex: WebGLTexture | null = null;
    if (needBlur) {
      const bw = Math.max(1, srcW >> 1);
      const bh = Math.max(1, srcH >> 1);
      const a = this.ensure("bA", bw, bh);
      const b = this.ensure("bB", bw, bh);
      const radius = 1 + Math.max(f.blur, look.bloom) * 5;
      let bin: WebGLTexture = input;
      for (let i = 0; i < 2; i++) {
        bindTarget(gl, a);
        this.blur.use().tex("uSrc", 0, bin).f2("uDir", radius / a.w, 0);
        this.tri.draw();
        bindTarget(gl, b);
        this.blur.use().tex("uSrc", 0, a.tex).f2("uDir", 0, radius / b.h);
        this.tri.draw();
        bin = b.tex;
      }
      blurTex = b.tex;
    }

    // Stage 3: color + grade + bloom + vignette + grain, to screen/target.
    const w = (x: GradeSettings["lift"]) => [x.r + x.master, x.g + x.master, x.b + x.master] as const;
    const [lr, lg2, lb] = w(g.lift);
    const [gr, gg, gb] = w(g.gamma);
    const [ar, ag, ab] = w(g.gain);
    const [or, og, ob] = w(g.offset);
    bindTarget(gl, out, outW, outH);
    this.post.use()
      .tex("uSrc", 0, input)
      .tex("uBlurTex", 1, blurTex)
      .i1("uHasBlur", blurTex ? 1 : 0)
      .f2("uTexel", 1 / srcW, 1 / srcH)
      .f2("uResolution", outW, outH)
      .f1("uTime", time)
      .f1("uSharpen", f.sharpen)
      .f1("uBlur", f.blur)
      .f1("uBrightness", f.brightness * view.brightness)
      .f1("uContrast", f.contrast)
      .f1("uSaturation", f.saturation)
      .f1("uVibrance", f.vibrance)
      .f1("uGamma", f.gamma)
      .f1("uTemperature", f.temperature + view.warmth)
      .f1("uVignette", f.vignette)
      .f1("uVignetteSoft", f.vignetteSoftness)
      .f1("uGrain", f.grain)
      .f2("uOffset", view.offsetX, view.offsetY)
      .f1("uZoom", view.zoom)
      .i1("uGrade", g.enabled ? 1 : 0)
      .f3("uLift", lr, lg2, lb)
      .f3("uGamma3", gr, gg, gb)
      .f3("uGain", ar, ag, ab)
      .f3("uGOffset", or, og, ob)
      .f1("uHue", g.hue)
      .f1("uTint", g.tint)
      .f1("uPivot", g.pivot)
      .i1("uLut", lutIndex(g.lut))
      .f1("uLutAmt", g.lutAmount)
      .f1("uHi", g.highlights)
      .f1("uLo", g.shadows)
      .f1("uBloom", look.bloom)
      .f1("uChromatic", look.chromatic);
    this.tri.draw();
  }

  dispose() {
    this.geom.dispose();
    this.post.dispose();
    this.blur.dispose();
    disposeTarget(this.gl, this.geomTarget);
    disposeTarget(this.gl, this.bA);
    disposeTarget(this.gl, this.bB);
  }
}

const LUT_IDS = ["", "teal-orange", "cine-noir", "warm-film", "cool-blue", "vibrant-pop", "faded-vhs", "moody-forest", "golden-hour", "cyberpunk", "bw-contrast"];
function lutIndex(id: string): number {
  const i = LUT_IDS.indexOf(id);
  return i < 0 ? 0 : i;
}
