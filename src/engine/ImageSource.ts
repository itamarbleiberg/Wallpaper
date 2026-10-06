import { FullscreenTri, GL, Program, Target, bindTarget } from "./gl";
import { FULLSCREEN_VS, IMAGE_FS } from "./shaders";
import type { ImageSettings } from "../shared/types";

/** Still-image wallpaper with optional Ken Burns pan & zoom. */
export class ImageSource {
  private tex: WebGLTexture;
  private prog: Program;
  private url = "";
  private w = 0;
  private h = 0;
  ready = false;
  onError?: (msg: string) => void;

  constructor(private gl: GL, private tri: FullscreenTri) {
    this.tex = gl.createTexture()!;
    this.prog = new Program(gl, FULLSCREEN_VS, IMAGE_FS);
  }

  load(url: string) {
    if (url === this.url) return;
    this.url = url;
    this.ready = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (this.url !== url) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.w = img.naturalWidth;
      this.h = img.naturalHeight;
      this.ready = true;
    };
    img.onerror = () => this.onError?.("Could not load image.");
    img.src = url;
  }

  render(target: Target, time: number, s: ImageSettings) {
    const gl = this.gl;
    bindTarget(gl, target);
    if (!this.ready) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    const k = Math.max(0, Math.min(1, s.kenBurns));
    const t = time * 0.05 * s.kenBurnsSpeed;
    const scale = 1 + k * (0.08 + 0.06 * Math.sin(t * 0.9));
    const pan = [Math.sin(t * 0.7) * 0.03 * k, Math.cos(t * 0.53) * 0.02 * k];
    this.prog.use()
      .tex("uTex", 0, this.tex)
      .f2("uSize", this.w, this.h)
      .f2("uOut", target.w, target.h)
      .i1("uFit", s.fit === "cover" ? 0 : s.fit === "contain" ? 1 : 2)
      .f1("uScale", scale)
      .f2("uPan", pan[0], pan[1]);
    this.tri.draw();
  }

  dispose() {
    this.gl.deleteTexture(this.tex);
    this.prog.dispose();
  }
}
