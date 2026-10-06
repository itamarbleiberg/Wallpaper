import { FullscreenTri, GL, Program, Target, bindTarget, createTexture } from "./gl";
import { FULLSCREEN_VS, SHADERTOY_PREFIX_LINES, wrapShadertoy } from "./shaders";

/** Shadertoy-compatible shader wallpapers (mainImage entry point). */
export class ShaderSource {
  private prog: Program | null = null;
  private code = "";
  private frame = 0;
  readonly audioTex: WebGLTexture;
  private audioData = new Uint8Array(64);
  error: string | null = null;

  constructor(private gl: GL, private tri: FullscreenTri) {
    this.audioTex = createTexture(gl, 64, 1, gl.R8, gl.RED, gl.UNSIGNED_BYTE);
  }

  /** Compile new code. Keeps the last working program on error. */
  setCode(code: string): string | null {
    if (code === this.code) return this.error;
    this.code = code;
    try {
      const p = new Program(this.gl, FULLSCREEN_VS, wrapShadertoy(code));
      this.prog?.dispose();
      this.prog = p;
      this.error = null;
    } catch (e) {
      this.error = ShaderSource.mapErrors(String((e as Error).message ?? e));
    }
    return this.error;
  }

  static mapErrors(log: string): string {
    return log.replace(/ERROR: 0:(\d+):/g, (_m, n) => `Line ${Math.max(1, Number(n) - SHADERTOY_PREFIX_LINES)}:`).trim();
  }

  setAudio(bands: ArrayLike<number>) {
    const n = Math.min(64, bands.length);
    for (let i = 0; i < n; i++) this.audioData[i] = Math.max(0, Math.min(255, bands[i] * 255));
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.audioTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.RED, gl.UNSIGNED_BYTE, this.audioData);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  render(target: Target, time: number, dt: number, mouse: [number, number, number, number]) {
    const gl = this.gl;
    bindTarget(gl, target);
    if (!this.prog) {
      gl.clearColor(0.02, 0.02, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    const d = new Date();
    this.prog.use()
      .f3("iResolution", target.w, target.h, 1)
      .f1("iTime", time)
      .f1("iTimeDelta", dt)
      .i1("iFrame", this.frame++)
      .f4("iMouse", mouse[0], mouse[1], mouse[2], mouse[3])
      .f4("iDate", d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000)
      .tex("iChannel0", 0, this.audioTex);
    this.tri.draw();
  }

  dispose() {
    this.prog?.dispose();
    this.gl.deleteTexture(this.audioTex);
  }
}
