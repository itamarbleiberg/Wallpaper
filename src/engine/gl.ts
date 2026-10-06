export type GL = WebGL2RenderingContext;

export class ShaderError extends Error {}

function compile(gl: GL, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "unknown error";
    gl.deleteShader(sh);
    throw new ShaderError(log);
  }
  return sh;
}

export class Program {
  readonly prog: WebGLProgram;
  private locs = new Map<string, WebGLUniformLocation | null>();

  constructor(private gl: GL, vs: string, fs: string) {
    const v = compile(gl, gl.VERTEX_SHADER, vs);
    let f: WebGLShader;
    try {
      f = compile(gl, gl.FRAGMENT_SHADER, fs);
    } catch (e) {
      gl.deleteShader(v);
      throw e;
    }
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p) ?? "link error";
      gl.deleteProgram(p);
      throw new ShaderError(log);
    }
    this.prog = p;
  }

  use(): this {
    this.gl.useProgram(this.prog);
    return this;
  }
  private loc(name: string) {
    let l = this.locs.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.prog, name);
      this.locs.set(name, l);
    }
    return l;
  }
  f1(n: string, a: number) { this.gl.uniform1f(this.loc(n), a); return this; }
  f2(n: string, a: number, b: number) { this.gl.uniform2f(this.loc(n), a, b); return this; }
  f3(n: string, a: number, b: number, c: number) { this.gl.uniform3f(this.loc(n), a, b, c); return this; }
  f4(n: string, a: number, b: number, c: number, d: number) { this.gl.uniform4f(this.loc(n), a, b, c, d); return this; }
  i1(n: string, a: number) { this.gl.uniform1i(this.loc(n), a); return this; }
  c3(n: string, rgb: [number, number, number]) { return this.f3(n, rgb[0], rgb[1], rgb[2]); }
  tex(n: string, unit: number, t: WebGLTexture | null) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(this.loc(n), unit);
    return this;
  }
  dispose() { this.gl.deleteProgram(this.prog); }
}

export interface Target { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number; internal: number; format: number; type: number }

export function createTexture(gl: GL, w: number, h: number, internal: number, format: number, type: number, filter: number = gl.LINEAR): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function createTarget(gl: GL, w: number, h: number, internal: number = gl.RGBA8, format: number = gl.RGBA, type: number = gl.UNSIGNED_BYTE): Target {
  const tex = createTexture(gl, w, h, internal, format, type);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) throw new Error(`Framebuffer incomplete (${w}x${h})`);
  return { fbo, tex, w, h, internal, format, type };
}

export function resizeTarget(gl: GL, t: Target, w: number, h: number) {
  if (t.w === w && t.h === h) return;
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, t.internal, w, h, 0, t.format, t.type, null);
  t.w = w;
  t.h = h;
}

export function disposeTarget(gl: GL, t: Target | null) {
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

export function bindTarget(gl: GL, t: Target | null, w?: number, h?: number) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
  gl.viewport(0, 0, t ? t.w : w!, t ? t.h : h!);
}

/** A single oversized triangle covering the viewport. */
export class FullscreenTri {
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  constructor(private gl: GL) {
    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }
  draw() {
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
    this.gl.bindVertexArray(null);
  }
  dispose() {
    this.gl.deleteBuffer(this.buf);
    this.gl.deleteVertexArray(this.vao);
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}
