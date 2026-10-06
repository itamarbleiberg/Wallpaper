import { FullscreenTri, GL, Program, Target, bindTarget, createTarget, disposeTarget, resizeTarget } from "./gl";
import { BLUR_FS, FULLSCREEN_VS, POST_FS } from "./shaders";
import type { FilterSettings } from "../shared/types";

/** Sharpening, color grading, blur, vignette and grain in (at most) 3 passes. */
export class PostFX {
  private post: Program;
  private blur: Program;
  private bA: Target | null = null;
  private bB: Target | null = null;

  constructor(private gl: GL, private tri: FullscreenTri) {
    this.post = new Program(gl, FULLSCREEN_VS, POST_FS);
    this.blur = new Program(gl, FULLSCREEN_VS, BLUR_FS);
  }

  private ensureBlur(w: number, h: number) {
    const bw = Math.max(1, w >> 1);
    const bh = Math.max(1, h >> 1);
    if (!this.bA) {
      this.bA = createTarget(this.gl, bw, bh);
      this.bB = createTarget(this.gl, bw, bh);
    } else {
      resizeTarget(this.gl, this.bA, bw, bh);
      resizeTarget(this.gl, this.bB!, bw, bh);
    }
  }

  render(src: WebGLTexture, srcW: number, srcH: number, outW: number, outH: number, f: FilterSettings, time: number) {
    const gl = this.gl;
    let blurTex: WebGLTexture | null = null;
    if (f.blur > 0.001) {
      this.ensureBlur(srcW, srcH);
      const radius = 1 + f.blur * 5;
      let input: WebGLTexture = src;
      for (let i = 0; i < 2; i++) {
        bindTarget(gl, this.bA);
        this.blur.use().tex("uSrc", 0, input).f2("uDir", radius / this.bA!.w, 0);
        this.tri.draw();
        bindTarget(gl, this.bB);
        this.blur.use().tex("uSrc", 0, this.bA!.tex).f2("uDir", 0, radius / this.bB!.h);
        this.tri.draw();
        input = this.bB!.tex;
      }
      blurTex = this.bB!.tex;
    }
    bindTarget(gl, null, outW, outH);
    this.post.use()
      .tex("uSrc", 0, src)
      .tex("uBlurTex", 1, blurTex)
      .i1("uHasBlur", blurTex ? 1 : 0)
      .f2("uTexel", 1 / srcW, 1 / srcH)
      .f2("uResolution", outW, outH)
      .f1("uTime", time)
      .f1("uSharpen", f.sharpen)
      .f1("uBlur", f.blur)
      .f1("uBrightness", f.brightness)
      .f1("uContrast", f.contrast)
      .f1("uSaturation", f.saturation)
      .f1("uVibrance", f.vibrance)
      .f1("uGamma", f.gamma)
      .f1("uTemperature", f.temperature)
      .f1("uVignette", f.vignette)
      .f1("uVignetteSoft", f.vignetteSoftness)
      .f1("uGrain", f.grain);
    this.tri.draw();
  }

  dispose() {
    this.post.dispose();
    this.blur.dispose();
    disposeTarget(this.gl, this.bA);
    disposeTarget(this.gl, this.bB);
  }
}
