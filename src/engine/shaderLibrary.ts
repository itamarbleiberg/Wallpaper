// Built-in Shadertoy-style wallpapers (all original). Uniforms available:
//   iResolution (vec3), iTime, iTimeDelta, iFrame, iMouse (vec4, px),
//   iDate, iChannel0 (64x1 live audio spectrum, .r = level 0..1)
import type { Category, EffectsSettings, FilterSettings } from "../shared/types";

export interface LibraryShader {
  id: string;
  name: string;
  category: Category;
  description: string;
  code: string;
  effects?: Partial<Omit<EffectsSettings, "trail" | "ripples">> & { trail?: Partial<EffectsSettings["trail"]>; ripples?: Partial<EffectsSettings["ripples"]> };
  filters?: Partial<FilterSettings>;
}

// Shared helpers prepended to every built-in (kept in the visible code so
// users can fork any built-in into a custom shader).
const LIB = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.02 + 1.7; a *= 0.5; }
  return v;
}
float bass() { return texture(iChannel0, vec2(0.04, 0.5)).r; }
vec2 mouseUv() { return iMouse.x <= 0.0 && iMouse.y <= 0.0 ? vec2(0.5) : iMouse.xy / iResolution.xy; }
`;

const sh = (body: string) => (LIB + body).trim();

// ---------------------------------------------------------------- originals (v1)

const aurora = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 m = mouseUv();
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = iTime * 0.08;
  vec3 col = mix(vec3(0.01, 0.015, 0.05), vec3(0.02, 0.05, 0.12), uv.y);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float band = fbm(vec2(p.x * 1.4 + t * (1.0 + fi * 0.4) + fi * 3.7, t * 0.5 + fi));
    float y = 0.58 + 0.34 * (band - 0.5) + fi * 0.07 + (m.x - 0.5) * 0.04;
    float d = uv.y - y;
    float glow = exp(-abs(d) * (16.0 - fi * 4.0)) * smoothstep(-0.25, 0.05, d) * smoothstep(0.1, 0.45, uv.y);
    vec3 c = mix(vec3(0.1, 1.0, 0.6), vec3(0.65, 0.3, 1.0), clamp(fi / 2.0 + 0.3 * sin(t * 3.0 + p.x), 0.0, 1.0));
    float curtain = fbm(vec2(p.x * 9.0 + fi * 10.0, uv.y * 1.5 - t * 5.0));
    col += c * glow * (0.45 + curtain) * (0.6 + bass() * 0.8);
  }
  float s = hash21(floor(fragCoord / 2.5));
  col += step(0.9985, s) * (0.55 + 0.45 * sin(iTime * 2.0 + s * 100.0)) * vec3(0.9);
  // dark mountain silhouette
  float ridge = 0.12 + 0.06 * fbm(vec2(p.x * 2.0, 3.0)) + 0.03 * sin(p.x * 3.0);
  col = mix(col, vec3(0.005, 0.01, 0.02), smoothstep(ridge + 0.004, ridge - 0.004, uv.y));
  fragColor = vec4(col, 1.0);
}`);

const neonGrid = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = mouseUv() - 0.5;
  float b = bass();
  vec3 col;
  float horizon = -0.05;
  if (uv.y > horizon) {
    float h = uv.y - horizon;
    col = mix(vec3(0.95, 0.25, 0.55), vec3(0.04, 0.0, 0.14), smoothstep(0.0, 0.5, h));
    vec2 sp = uv - vec2(m.x * 0.25, horizon + 0.2);
    float r = length(sp);
    float sun = smoothstep(0.205, 0.2, r);
    float stripes = step(0.45, fract(sp.y * 28.0 - iTime * 0.4));
    float cut = sp.y < 0.0 ? stripes : 1.0;
    vec3 sunCol = mix(vec3(1.0, 0.2, 0.45), vec3(1.0, 0.85, 0.3), smoothstep(-0.2, 0.2, sp.y));
    col = mix(col, sunCol, sun * cut);
    col += vec3(1.0, 0.3, 0.6) * exp(-r * 4.0) * (0.25 + b * 0.5);
    float s = hash21(floor(fragCoord / 3.0));
    col += step(0.997, s) * smoothstep(0.1, 0.4, h) * 0.8;
  } else {
    float z = 0.35 / (horizon - uv.y + 0.0005);
    vec2 g = vec2((uv.x + m.x * 0.6) * z, z + iTime * 1.6);
    vec2 gw = fwidth(g);
    vec2 dist = 0.5 - abs(fract(g) - 0.5);
    vec2 l = 1.0 - smoothstep(vec2(0.0), gw * 1.6, dist);
    float line = max(l.x, l.y);
    float fade = exp(-z * 0.06);
    col = vec3(0.03, 0.0, 0.08) + vec3(1.0, 0.2, 0.85) * line * fade * (1.0 + b);
    col += vec3(0.9, 0.2, 0.6) * exp(-(horizon - uv.y) * 14.0) * 0.5;
  }
  fragColor = vec4(col, 1.0);
}`);

const plasma = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = (mouseUv() - 0.5) * iResolution.xy / iResolution.y;
  float t = iTime * 0.3;
  vec2 p = uv * 3.0;
  float d = length(uv - m);
  p += 0.5 * normalize(uv - m + 1e-4) * exp(-d * 4.0) * sin(d * 20.0 - iTime * 4.0);
  float v = 0.0;
  v += sin(p.x * 1.3 + t);
  v += sin((p.y * 1.7 + t * 0.8));
  v += sin((p.x + p.y) * 1.1 + t * 1.3);
  v += sin(length(p + vec2(sin(t * 0.5) * 2.0, cos(t * 0.4) * 2.0)) * 2.0);
  v *= 0.5;
  vec3 col = 0.55 + 0.45 * cos(6.2831 * (v * 0.35 + vec3(0.0, 0.1, 0.25)) + vec3(t * 0.4, t * 0.4 + 1.0, t * 0.4 + 2.2));
  col = mix(col, vec3(0.2, 0.05, 0.35), smoothstep(0.6, -0.8, v) * 0.5);
  col *= 0.75 + 0.35 * bass() + 0.15 * sin(v * 6.2831);
  fragColor = vec4(col, 1.0);
}`);

// ---------------------------------------------------------------- new (v2)

const deepSpace = sh(`
vec3 stars(vec2 uv, float scale, float seed) {
  vec2 p = uv * scale;
  vec2 g = floor(p), f = fract(p);
  vec3 c = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 id = g + o;
    float h = hash21(id + seed);
    if (h > 0.4) continue;
    vec2 d = o + hash22(id + seed * 1.3) - f;
    float s = 0.03 + 0.06 * hash21(id * 1.7 + seed);
    float tw = 0.65 + 0.35 * sin(iTime * (0.6 + 2.5 * h) + h * 50.0);
    vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.62, 0.8, 1.0), hash21(id * 3.1));
    float r = length(d);
    c += tint * (exp(-r * r / (s * s * 0.25)) + 0.08 * s / (r + 0.02)) * tw;
  }
  return c;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = (mouseUv() - 0.5);
  float t = iTime * 0.01;
  vec2 q = uv + m * 0.02;
  float n = fbm(q * 1.4 + vec2(t, -t * 0.6));
  float n2 = fbm(q * 2.6 - vec2(t * 0.8, 3.1));
  vec3 col = vec3(0.004, 0.006, 0.02);
  col += vec3(0.42, 0.12, 0.65) * smoothstep(0.35, 0.9, n) * 1.1;
  col += vec3(0.08, 0.4, 0.7) * smoothstep(0.4, 0.95, n2) * 0.9;
  col += vec3(1.0, 0.45, 0.35) * smoothstep(0.55, 1.0, n * n2 * 1.8) * 0.5;
  col += stars(uv + m * 0.01 + vec2(t, 0.0), 6.0, 1.0) * 1.1;
  col += stars(uv + m * 0.03 + vec2(t * 2.0, 0.0), 12.0, 7.0) * 0.7;
  col += stars(uv + m * 0.06 + vec2(t * 4.0, 0.0), 26.0, 13.0) * 0.45;
  fragColor = vec4(col, 1.0);
}`);

const nebula = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = mouseUv() - 0.5;
  float t = iTime * 0.03;
  vec2 p = uv * 1.6 + m * 0.25;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + t * 1.5), fbm(p + 3.5 * q + vec2(8.3, 2.8)));
  float f = fbm(p + 3.0 * r);
  vec3 col = mix(vec3(0.03, 0.01, 0.09), vec3(0.55, 0.08, 0.45), clamp(f * f * 3.0, 0.0, 1.0));
  col = mix(col, vec3(0.05, 0.45, 0.8), clamp(length(q) - 0.4, 0.0, 1.0) * 0.7);
  col = mix(col, vec3(1.0, 0.7, 0.4), clamp(r.x * r.x - 0.2, 0.0, 1.0) * 0.6);
  col *= 0.35 + f * 1.4;
  col *= 1.0 + bass() * 0.4;
  float s = hash21(floor(fragCoord / 2.0));
  col += step(0.998, s) * vec3(0.9) * (0.6 + 0.4 * sin(iTime + s * 80.0));
  fragColor = vec4(col, 1.0);
}`);

const oceanSunset = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 m = mouseUv();
  float hz = 0.4;
  vec2 sun = vec2(0.5 + (m.x - 0.5) * 0.15, hz + 0.1);
  vec3 col;
  if (uv.y > hz) {
    float h = (uv.y - hz) / (1.0 - hz);
    col = mix(vec3(1.0, 0.55, 0.25), vec3(0.95, 0.35, 0.35), smoothstep(0.0, 0.3, h));
    col = mix(col, vec3(0.28, 0.16, 0.42), smoothstep(0.25, 1.0, h));
    vec2 d = (uv - sun) * vec2(aspect, 1.0);
    float r = length(d);
    col += vec3(1.0, 0.75, 0.4) * exp(-r * 6.0) * 0.7;
    col = mix(col, vec3(1.0, 0.92, 0.7), smoothstep(0.062, 0.058, r));
    float cl = fbm(vec2(uv.x * aspect * 2.0 + iTime * 0.01, uv.y * 7.0));
    float band = smoothstep(0.55, 0.8, cl) * smoothstep(hz + 0.05, hz + 0.3, uv.y) * (1.0 - smoothstep(0.75, 1.0, uv.y));
    col = mix(col, mix(vec3(0.95, 0.45, 0.4), vec3(0.4, 0.2, 0.4), h), band * 0.75);
  } else {
    float depth = hz - uv.y;
    float z = 0.05 / (depth + 0.012);
    vec2 wp = vec2((uv.x - 0.5) * aspect * z * 3.0, z * 4.0 + iTime * 0.6);
    float w = noise(wp) * 0.6 + noise(wp * 2.3 + iTime * 0.3) * 0.4;
    vec3 sky = mix(vec3(1.0, 0.55, 0.3), vec3(0.3, 0.18, 0.42), smoothstep(0.0, 0.4, depth));
    col = mix(vec3(0.05, 0.05, 0.14), sky * 0.55, exp(-depth * 4.0));
    float path = exp(-abs(uv.x - sun.x) * aspect * (6.0 + 30.0 * depth));
    float glint = smoothstep(0.55, 0.85, w) * path;
    col += vec3(1.0, 0.75, 0.45) * (glint * 1.4 + path * 0.25 * exp(-depth * 3.0));
    col += (w - 0.5) * 0.06;
  }
  fragColor = vec4(col, 1.0);
}`);

const rainGlass = sh(`
vec3 bokeh(vec2 uv) {
  vec3 c = mix(vec3(0.02, 0.03, 0.06), vec3(0.08, 0.05, 0.1), uv.y + 0.5);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 p = uv * (2.2 + fl * 1.8) + vec2(fl * 7.3, iTime * 0.02 * (fl + 1.0));
    vec2 g = floor(p);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 id = g + vec2(float(x), float(y));
      float h = hash21(id * 1.3 + fl);
      if (h < 0.35) continue;
      vec2 cpos = id + 0.5 + (hash22(id + fl) - 0.5) * 0.8;
      float r = length(p - cpos);
      float size = 0.25 + 0.3 * hash21(id + 4.0);
      vec3 tint = mix(vec3(1.0, 0.6, 0.25), vec3(0.3, 0.55, 1.0), step(0.65, h));
      tint = mix(tint, vec3(1.0, 0.3, 0.35), step(0.88, h));
      c += tint * smoothstep(size, size * 0.8, r) * (0.22 + 0.08 * sin(iTime * 0.5 + h * 20.0));
    }
  }
  return c;
}
vec2 drops(vec2 uv, float t) {
  vec2 n = vec2(0.0);
  // static droplets
  vec2 p = uv * 9.0;
  vec2 g = floor(p), f = fract(p) - 0.5;
  vec2 o = (hash22(g) - 0.5) * 0.7;
  float life = fract(t * 0.05 + hash21(g));
  float r = 0.1 + 0.14 * hash21(g + 3.0);
  vec2 d = f - o;
  float m = smoothstep(r, r * 0.7, length(d)) * smoothstep(1.0, 0.8, life) * step(0.45, hash21(g + 9.0));
  n += d * m * 2.0;
  // sliding drops
  vec2 sp = uv * vec2(5.0, 1.0);
  float col = floor(sp.x);
  float speed = 0.15 + 0.2 * hash11(col);
  float y = fract(-t * speed + hash11(col * 7.0));
  vec2 dp = vec2(fract(sp.x) - 0.5 + 0.1 * sin(y * 20.0 + col), (fract(uv.y) - y) * 5.0);
  float dm = smoothstep(0.18, 0.1, length(dp * vec2(1.0, 0.6)));
  float trail = smoothstep(0.06, 0.02, abs(dp.x)) * step(0.0, dp.y) * smoothstep(1.2, 0.0, dp.y) * 0.4;
  n += dp * dm * 1.5 + vec2(dp.x * trail, 0.0);
  return n;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 n = drops(uv, iTime);
  vec3 bg = bokeh(uv * 0.9);
  vec3 sharp = bokeh(uv * 0.9 + n * 0.25);
  float mask = clamp(length(n) * 6.0, 0.0, 1.0);
  vec3 col = mix(bg * 0.75, sharp * 1.25 + 0.03, mask);
  col += vec3(0.6, 0.7, 0.9) * pow(mask, 4.0) * 0.08;
  fragColor = vec4(col, 1.0);
}`);

const lavaLamp = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float aspect = iResolution.x / iResolution.y;
  vec2 m = (mouseUv() - 0.5) * vec2(aspect, 1.0);
  float t = iTime * 0.3;
  float field = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 c = vec2((hash11(fi * 3.7) - 0.5) * aspect * 0.8 + sin(t * 0.3 + fi) * 0.08,
                  sin(t * (0.25 + 0.07 * fi) + fi * 1.9) * 0.42);
    float r = 0.06 + 0.04 * hash11(fi);
    vec2 d = uv - c;
    field += r * r / (dot(d, d) + 0.0002);
  }
  vec2 dm = uv - m;
  field += 0.004 / (dot(dm, dm) + 0.0002);
  float blob = smoothstep(0.95, 1.1, field);
  float rim = smoothstep(0.6, 0.95, field) * (1.0 - blob);
  vec3 bg = mix(vec3(0.1, 0.02, 0.16), vec3(0.28, 0.04, 0.22), uv.y + 0.5);
  bg += vec3(0.25, 0.06, 0.12) * exp(-abs(uv.x) * 2.5) * 0.4;
  vec3 hot = mix(vec3(1.0, 0.3, 0.12), vec3(1.0, 0.72, 0.25), clamp(uv.y + 0.6, 0.0, 1.0));
  vec3 col = bg + vec3(1.0, 0.25, 0.3) * rim * 0.35;
  float shade = clamp((field - 1.0) * 0.4, 0.0, 1.0);
  col = mix(col, hot * (0.75 + 0.35 * shade), blob);
  fragColor = vec4(col, 1.0);
}`);

const digitalRain = sh(`
float glyph(vec2 p, float seed) {
  vec2 g = floor(p * vec2(4.0, 6.0));
  if (g.x < 0.0 || g.y < 0.0 || g.x > 3.0 || g.y > 5.0) return 0.0;
  return step(0.45, hash21(g + seed * 13.0));
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float cell = max(10.0, iResolution.y / 60.0);
  vec2 cuv = fragCoord / cell;
  vec2 id = floor(cuv);
  vec2 f = fract(cuv);
  float speed = 6.0 + 10.0 * hash11(id.x);
  float rows = iResolution.y / cell;
  float head = mod(iTime * speed + hash11(id.x * 3.7) * 200.0, rows + 30.0);
  float y = rows - id.y;
  float d = head - y;
  float tail = d < 0.0 ? 0.0 : exp(-d * 0.12) * step(d, 28.0);
  float seed = floor(hash21(id) * 40.0 + iTime * (0.5 + 3.0 * hash21(id + 1.0)));
  float g = glyph((f - vec2(0.15, 0.1)) / vec2(0.7, 0.8), seed);
  vec2 m = mouseUv() * iResolution.xy / cell;
  float near = exp(-abs(id.x - m.x) * 0.25) * 0.5;
  vec3 col = vec3(0.1, 1.0, 0.35) * g * tail * (0.8 + near);
  col += vec3(0.75, 1.0, 0.8) * g * step(abs(d), 0.6);
  col += vec3(0.0, 0.05, 0.02);
  fragColor = vec4(col, 1.0);
}`);

const fireflies = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = mouseUv();
  vec3 col = mix(vec3(0.02, 0.05, 0.06), vec3(0.03, 0.08, 0.14), uv.y);
  vec2 moon = vec2(aspect * 0.75, 0.78);
  col += vec3(0.5, 0.65, 0.8) * exp(-length(p - moon) * 5.0) * 0.4;
  col = mix(col, vec3(0.85, 0.9, 0.95), smoothstep(0.052, 0.048, length(p - moon)));
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float hgt = 0.62 - fi * 0.13 + 0.12 * fbm(vec2(p.x * (2.0 + fi) + fi * 10.0, fi));
    hgt += 0.08 * abs(sin(p.x * (9.0 + fi * 5.0) + fi)) * (1.0 - fi * 0.2);
    float layer = smoothstep(hgt + 0.003, hgt - 0.003, uv.y);
    vec3 tc = mix(vec3(0.03, 0.08, 0.1), vec3(0.005, 0.015, 0.02), fi / 3.0);
    col = mix(col, tc, layer);
    float fog = smoothstep(hgt + 0.08, hgt - 0.02, uv.y) * (1.0 - layer) * 0.15;
    col += vec3(0.3, 0.45, 0.5) * fog * (3.0 - fi) / 3.0;
  }
  for (int i = 0; i < 28; i++) {
    float fi = float(i);
    vec2 base = vec2(hash11(fi * 1.3) * aspect, 0.05 + 0.5 * hash11(fi * 7.1));
    vec2 pos = base + 0.06 * vec2(sin(iTime * (0.3 + hash11(fi)) + fi), cos(iTime * (0.25 + hash11(fi * 2.0)) + fi * 2.0));
    vec2 toM = pos - vec2(m.x * aspect, m.y);
    pos += normalize(toM + 1e-4) * 0.05 * exp(-length(toM) * 8.0);
    float blink = smoothstep(0.3, 1.0, sin(iTime * (1.0 + hash11(fi * 3.0) * 2.0) + fi * 5.0));
    float d = length(p - pos);
    col += vec3(0.85, 1.0, 0.35) * (exp(-d * 80.0) * 1.8 + exp(-d * 20.0) * 0.35) * blink;
  }
  fragColor = vec4(col, 1.0);
}`);

const snowPeaks = sh(`
float ridge(float x, float seed) {
  float h = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 5; i++) { h += a * (1.0 - abs(noise(vec2(x * f + seed, seed)) * 2.0 - 1.0)); f *= 2.1; a *= 0.48; }
  return h;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 m = mouseUv() - 0.5;
  vec3 col = mix(vec3(1.0, 0.78, 0.66), vec3(0.45, 0.58, 0.85), smoothstep(0.35, 0.9, uv.y));
  col = mix(col, vec3(0.22, 0.3, 0.6), smoothstep(0.85, 1.1, uv.y));
  vec2 sp = (uv - vec2(0.7, 0.62)) * vec2(aspect, 1.0);
  col += vec3(1.0, 0.8, 0.6) * exp(-length(sp) * 6.0) * 0.5;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x = uv.x * aspect * (0.55 + fi * 0.35) + m.x * (0.04 + fi * 0.06) + fi * 3.0;
    float rr = ridge(x, fi * 5.0);
    float h = 0.36 - fi * 0.075 + (rr - 0.45) * (0.75 - fi * 0.12);
    float slope = (ridge(x + 0.02, fi * 5.0) - ridge(x - 0.02, fi * 5.0)) * 4.0;
    vec3 far = vec3(0.62, 0.68, 0.85), near = vec3(0.13, 0.16, 0.26);
    vec3 rock = mix(far, near, fi / 3.0);
    rock *= 0.85 + 0.25 * clamp(0.5 + slope, 0.0, 1.0);
    float snowline = h - 0.07 - 0.03 * noise(vec2(x * 6.0, fi));
    vec3 snow = mix(vec3(1.0, 0.96, 0.95), vec3(0.78, 0.84, 0.98), clamp(0.5 - slope, 0.0, 1.0));
    vec3 mc = mix(rock, snow * mix(1.0, 0.8, fi / 3.0), smoothstep(snowline - 0.01, snowline + 0.01, uv.y));
    float mask = smoothstep(h + 0.002, h - 0.002, uv.y);
    col = mix(col, mix(mc, col, 0.4 - fi * 0.12), mask);
  }
  float mist = smoothstep(0.3, 0.0, uv.y) * 0.25;
  col = mix(col, vec3(0.75, 0.8, 0.9), mist);
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    vec2 p = vec2(uv.x * aspect, uv.y) * (8.0 + fl * 6.0);
    p.y += iTime * (0.6 + fl * 0.3);
    p.x += sin(iTime * 0.5 + p.y * 0.3) * 0.5 + m.x * 2.0;
    vec2 g = floor(p), f = fract(p) - 0.5;
    vec2 o = hash22(g) - 0.5;
    float d = length(f - o * 0.7);
    col += vec3(1.0) * smoothstep(0.08 - fl * 0.02, 0.0, d) * step(0.7, hash21(g + fl)) * (0.6 - fl * 0.15);
  }
  fragColor = vec4(col, 1.0);
}`);

const neonTunnel = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = (mouseUv() - 0.5) * 0.4;
  uv -= m * (1.0 - length(uv));
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float z = 0.35 / (r + 0.001) + iTime * 1.2;
  float seg = a / 6.2831 * 16.0 + z * 0.15;
  float fw = fwidth(z) * 1.5 + 0.01;
  float rings = smoothstep(0.5 - fw - 0.03, 0.5, abs(fract(z) - 0.5) + 0.03);
  float sw = 0.03;
  float spokes = smoothstep(0.5 - sw - 0.02, 0.5, abs(fract(seg) - 0.5) + 0.02);
  vec3 c1 = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + floor(z) * 0.5 + iTime * 0.2);
  vec3 c2 = 0.5 + 0.5 * cos(vec3(4.0, 0.5, 2.5) + floor(z) * 0.3);
  float depthFade = smoothstep(0.02, 0.35, r);
  vec3 col = (c1 * rings * 1.4 + c2 * spokes * 0.7) * depthFade;
  col *= 1.0 + bass() * 1.2;
  col += vec3(0.25, 0.05, 0.45) * exp(-r * 4.0) * 0.8;
  col += vec3(0.05, 0.0, 0.1);
  fragColor = vec4(col, 1.0);
}`);

const inkBloom = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = (mouseUv() - 0.5) * iResolution.xy / iResolution.y;
  float t = iTime * 0.04;
  vec2 p = uv * 1.8;
  vec2 dm = uv - m;
  p += 0.15 * normalize(dm + 1e-4) * exp(-length(dm) * 4.0);
  vec2 q = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(3.3, t)));
  vec2 r = vec2(fbm(p + 2.5 * q + vec2(1.7 - t, 9.2)), fbm(p + 2.5 * q + vec2(8.3, 2.8 + t)));
  float f = fbm(p + 2.0 * r);
  vec3 paper = vec3(0.96, 0.93, 0.87);
  vec3 ink1 = vec3(0.05, 0.18, 0.35);
  vec3 ink2 = vec3(0.0, 0.45, 0.5);
  vec3 ink3 = vec3(0.75, 0.25, 0.3);
  float a = smoothstep(0.45, 0.75, f);
  vec3 col = mix(paper, ink2, smoothstep(0.35, 0.65, r.y) * 0.6);
  col = mix(col, ink1, a);
  col = mix(col, ink3, smoothstep(0.6, 0.9, q.x * f * 1.8) * 0.5);
  col *= 0.94 + 0.06 * noise(fragCoord * 0.5);
  fragColor = vec4(col, 1.0);
}`);

const dunes = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 m = mouseUv() - 0.5;
  vec3 col = mix(vec3(1.0, 0.68, 0.38), vec3(0.45, 0.32, 0.55), smoothstep(0.35, 1.0, uv.y));
  vec2 sun = vec2(0.32 + m.x * 0.05, 0.58);
  vec2 d = (uv - sun) * vec2(aspect, 1.0);
  col += vec3(1.0, 0.65, 0.3) * exp(-length(d) * 5.0) * 0.6;
  col = mix(col, vec3(1.0, 0.9, 0.65), smoothstep(0.075, 0.07, length(d)));
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x = uv.x * aspect * (1.0 + fi * 0.6) + fi * 2.7 + m.x * fi * 0.08 + iTime * 0.004 * (fi + 1.0);
    float h = 0.52 - fi * 0.1 + 0.06 * sin(x * 1.3 + fi) + 0.04 * sin(x * 2.9 + fi * 3.0) + 0.02 * noise(vec2(x * 4.0, fi));
    float slope = cos(x * 1.3 + fi) * 0.078 + cos(x * 2.9 + fi * 3.0) * 0.116;
    vec3 lit = mix(vec3(0.95, 0.6, 0.35), vec3(0.75, 0.38, 0.25), fi / 4.0);
    vec3 shade = mix(vec3(0.55, 0.3, 0.3), vec3(0.3, 0.14, 0.18), fi / 4.0);
    vec3 dc = mix(shade, lit, clamp(0.5 + slope * 3.0 + (uv.y - h) * 2.5, 0.0, 1.0));
    float ripples = 0.5 + 0.5 * sin((uv.y * 160.0 + x * 20.0) * (1.0 + fi * 0.3));
    dc *= 0.95 + 0.05 * ripples * (1.0 - fi * 0.2);
    float mask = smoothstep(h + 0.002, h - 0.002, uv.y);
    col = mix(col, mix(dc, col, 0.35 - fi * 0.07), mask);
  }
  float haze = sin(uv.y * 80.0 + iTime * 3.0) * 0.002;
  col += haze;
  fragColor = vec4(col, 1.0);
}`);

const hexPulse = sh(`
vec4 hexCoords(vec2 p) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = p - gv;
  return vec4(gv, id);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = (mouseUv() - 0.5) * iResolution.xy / iResolution.y;
  vec4 h = hexCoords(uv * 14.0);
  vec2 gv = h.xy;
  vec2 id = h.zw;
  float edge = max(abs(gv.x) * 0.866 + abs(gv.y) * 0.5, abs(gv.y));
  float border = smoothstep(0.47, 0.43, edge);
  vec2 c = id / 14.0;
  float dist = length(c - m);
  float wave = sin(dist * 18.0 - iTime * 3.0) * 0.5 + 0.5;
  float glow = exp(-dist * 4.0) * (0.6 + 0.4 * wave);
  float twinkle = step(0.97, hash21(id + floor(iTime * 2.0)));
  float b = bass();
  vec3 base = mix(vec3(0.02, 0.06, 0.12), vec3(0.04, 0.02, 0.1), uv.y + 0.5);
  vec3 lit = mix(vec3(0.1, 0.8, 1.0), vec3(0.8, 0.2, 1.0), clamp(dist * 1.5, 0.0, 1.0));
  vec3 col = base * border + lit * (glow + twinkle * 0.4 + b * 0.3 * wave) * border;
  col += lit * (1.0 - border) * 0.12 * (glow + 0.2);
  fragColor = vec4(col, 1.0);
}`);

const bokehDreams = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = (mouseUv() - 0.5);
  vec3 col = mix(vec3(0.06, 0.02, 0.1), vec3(0.02, 0.04, 0.12), uv.y + 0.5);
  for (int l = 0; l < 4; l++) {
    float fl = float(l);
    float sc = 2.5 + fl * 1.5;
    vec2 p = (uv + m * (0.02 + fl * 0.02)) * sc + vec2(fl * 4.1, -iTime * (0.03 + fl * 0.015));
    vec2 g = floor(p);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 id = g + vec2(float(x), float(y));
      float h = hash21(id + fl * 9.0);
      if (h < 0.45) continue;
      vec2 c = id + hash22(id + fl) ;
      float r = 0.25 + 0.35 * hash21(id * 2.3);
      float d = length(p - c);
      vec3 tint = 0.55 + 0.45 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)) + fl);
      float disk = smoothstep(r, r * (0.75 - fl * 0.1), d) * (0.5 + 0.5 * smoothstep(r * 0.6, r, d));
      col += tint * disk * (0.2 + 0.07 * sin(iTime + h * 30.0)) * (1.2 - fl * 0.2);
    }
  }
  fragColor = vec4(col, 1.0);
}`);

const galaxy = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = (mouseUv() - 0.5);
  uv += m * 0.08;
  float tilt = 0.55;
  vec2 p = vec2(uv.x, uv.y / tilt);
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = iTime * 0.03;
  float arms = cos(2.0 * (a - log(r + 0.001) * 2.2 + t));
  float dust = fbm(vec2(a * 2.0 + log(r) * 3.0 - t * 2.0, r * 6.0));
  float disk = exp(-r * 3.0);
  float spiral = smoothstep(0.0, 1.0, arms * 0.5 + 0.5) * disk;
  vec3 col = vec3(0.005, 0.005, 0.02);
  col += vec3(0.45, 0.55, 1.0) * spiral * (0.6 + dust) * 1.4;
  col += vec3(1.0, 0.45, 0.6) * spiral * smoothstep(0.55, 0.85, dust) * 0.8;
  col -= vec3(0.25, 0.2, 0.15) * smoothstep(0.5, 0.8, fbm(p * 9.0 + t)) * spiral;
  col += vec3(1.0, 0.85, 0.6) * exp(-r * 18.0) * 1.6;
  col += vec3(1.0, 0.7, 0.4) * exp(-r * 6.0) * 0.25;
  float s = hash21(floor(fragCoord / 2.0));
  col += step(0.9975, s) * (0.5 + 0.5 * sin(iTime * 2.0 + s * 60.0)) * 0.8;
  col = max(col, 0.0);
  fragColor = vec4(col, 1.0);
}`);

const underwaterRays = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 m = mouseUv();
  vec3 col = mix(vec3(0.0, 0.08, 0.18), vec3(0.05, 0.42, 0.62), pow(uv.y, 1.4));
  vec2 src = vec2(0.5 + (m.x - 0.5) * 0.4, 1.3);
  vec2 d = vec2((uv.x - src.x) * aspect, uv.y - src.y);
  float ang = atan(d.x, -d.y);
  float rays = 0.0;
  rays += smoothstep(0.35, 1.0, noise(vec2(ang * 9.0, iTime * 0.25)));
  rays += smoothstep(0.4, 1.0, noise(vec2(ang * 17.0 + 4.0, iTime * 0.35))) * 0.6;
  col += vec3(0.55, 0.85, 0.9) * rays * 0.35 * smoothstep(0.0, 1.0, uv.y);
  float surf = smoothstep(0.92, 1.0, uv.y);
  float wave = noise(vec2(uv.x * aspect * 12.0, iTime * 0.8)) * noise(vec2(uv.x * aspect * 25.0 - iTime, 3.0));
  col += vec3(0.6, 0.9, 1.0) * surf * (0.3 + wave);
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    vec2 p = vec2(uv.x * aspect, uv.y) * (14.0 + fl * 10.0);
    p.y -= iTime * (0.25 + fl * 0.2);
    p.x += sin(p.y * 0.4 + iTime * 0.3) * 0.4;
    vec2 g = floor(p), f = fract(p) - 0.5;
    vec2 o = hash22(g + fl) - 0.5;
    float dd = length(f - o * 0.6);
    col += vec3(0.7, 0.9, 1.0) * smoothstep(0.06, 0.0, dd) * step(0.82, hash21(g * 1.7 + fl)) * 0.5;
  }
  float floorH = 0.12 + 0.04 * fbm(vec2(uv.x * aspect * 3.0, 1.0));
  col = mix(col, vec3(0.02, 0.1, 0.14), smoothstep(floorH + 0.01, floorH - 0.01, uv.y));
  fragColor = vec4(col, 1.0);
}`);

const silk = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 m = mouseUv() - 0.5;
  float t = iTime * 0.08;
  vec3 a = vec3(0.98, 0.55, 0.6), b = vec3(0.45, 0.4, 0.95), c = vec3(0.3, 0.85, 0.9), d = vec3(1.0, 0.85, 0.55);
  vec3 col = mix(mix(a, b, uv.x), mix(c, d, uv.x), uv.y);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float y = 0.25 + fi * 0.18 + 0.08 * sin(uv.x * (2.0 + fi * 0.7) + t * (1.0 + fi * 0.3) + fi * 1.7) + m.y * 0.03 * fi;
    float band = smoothstep(0.12, 0.0, abs(uv.y - y));
    vec3 tint = 0.5 + 0.5 * cos(6.2831 * (fi * 0.21 + vec3(0.0, 0.33, 0.67)) + t);
    col = mix(col, mix(col, tint, 0.5) * 1.08, band * 0.55);
    col += vec3(1.0) * smoothstep(0.01, 0.0, abs(uv.y - y - 0.03)) * 0.06;
  }
  col = mix(col, vec3(dot(col, vec3(0.33))), 0.12);
  fragColor = vec4(col, 1.0);
}`);

const chrome = sh(`
float h(vec2 p) {
  return sin(p.x * 1.7 + iTime * 0.5) * 0.3 + sin(p.y * 1.4 - iTime * 0.4) * 0.3 + sin((p.x - p.y) * 2.3 + iTime * 0.7) * 0.18 + noise(p * 1.2 + iTime * 0.05) * 0.35;
}
float hm(vec2 p, vec2 uv, vec2 m) { return h(p) + 0.45 * exp(-dot(uv - m, uv - m) * 14.0); }
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = (mouseUv() - 0.5) * iResolution.xy / iResolution.y;
  float sc = 2.6;
  vec2 p = uv * sc;
  float e = 0.01;
  float c0 = hm(p, uv, m);
  float hx = hm(p + vec2(e, 0.0), uv + vec2(e / sc, 0.0), m);
  float hy = hm(p + vec2(0.0, e), uv + vec2(0.0, e / sc), m);
  vec3 n = normalize(vec3((c0 - hx) / e, (c0 - hy) / e, 1.0));
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  // studio environment: horizon bands + soft boxes
  float y = r.y;
  vec3 env = mix(vec3(0.03, 0.03, 0.05), vec3(0.55, 0.58, 0.66), smoothstep(-0.6, 0.0, y));
  env = mix(env, vec3(0.98), smoothstep(0.02, 0.08, y) * (1.0 - smoothstep(0.16, 0.24, y)));
  env = mix(env, vec3(0.25, 0.3, 0.42), smoothstep(0.24, 0.8, y));
  env += vec3(1.0, 0.95, 0.9) * smoothstep(0.85, 0.95, y) * 0.8;
  env += vec3(1.0, 0.55, 0.3) * smoothstep(0.6, 0.9, r.x) * 0.5;
  env += vec3(0.25, 0.6, 1.0) * smoothstep(0.6, 0.9, -r.x) * 0.45;
  vec3 col = env * vec3(0.95, 0.97, 1.0);
  col += pow(max(dot(n, normalize(vec3(0.4, 0.6, 1.0))), 0.0), 90.0) * 0.8;
  fragColor = vec4(col, 1.0);
}`);

const sakura = sh(`
float petal(vec2 p, float rot) {
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p;
  p.x *= 1.6;
  float d = length(p) - 0.5;
  float notch = length(p - vec2(0.0, 0.55)) - 0.18;
  return smoothstep(0.05, -0.05, max(d, -notch));
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 m = mouseUv() - 0.5;
  vec3 col = mix(vec3(1.0, 0.86, 0.88), vec3(0.72, 0.8, 0.98), uv.y);
  col = mix(col, vec3(1.0, 0.95, 0.9), exp(-length((uv - vec2(0.8, 0.8)) * vec2(aspect, 1.0)) * 3.0) * 0.5);
  float hill = 0.18 + 0.05 * sin(uv.x * aspect * 2.0) + 0.03 * fbm(vec2(uv.x * aspect * 3.0, 0.0));
  col = mix(col, vec3(0.86, 0.7, 0.78), smoothstep(hill + 0.003, hill - 0.003, uv.y));
  for (int l = 0; l < 3; l++) {
    float fl = float(l);
    float sc = 5.0 + fl * 4.0;
    vec2 p = vec2(uv.x * aspect, uv.y) * sc;
    p.y += iTime * (0.35 + fl * 0.15);
    p.x += iTime * (0.2 + fl * 0.08) + m.x * (1.0 + fl);
    vec2 g = floor(p), f = fract(p) - 0.5;
    float hh = hash21(g + fl * 5.0);
    if (hh > 0.45) {
      vec2 o = (hash22(g) - 0.5) * 0.5;
      float rot = iTime * (0.5 + hh) + hh * 20.0;
      float pm = petal((f - o) * (2.6 - fl * 0.4), rot);
      vec3 pc = mix(vec3(1.0, 0.62, 0.75), vec3(1.0, 0.85, 0.9), hash21(g * 3.0));
      col = mix(col, pc, pm * (0.95 - fl * 0.2));
    }
  }
  fragColor = vec4(col, 1.0);
}`);

const storm = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = iTime;
  float slot = floor(t / 2.5);
  float local = fract(t / 2.5) * 2.5;
  float strike = step(0.4, hash11(slot));
  float flash = strike * (exp(-local * 7.0) + 0.7 * exp(-abs(local - 0.15) * 25.0));
  float bx = (0.2 + 0.6 * hash11(slot * 3.1)) * aspect;
  float c1 = fbm(p * 1.6 + vec2(t * 0.03, 0.0));
  float c2 = fbm(p * 3.2 - vec2(t * 0.05, 0.0) + c1 * 1.5);
  float dens = smoothstep(0.3, 0.8, c1 * 0.6 + c2 * 0.6);
  vec3 sky = mix(vec3(0.07, 0.08, 0.12), vec3(0.16, 0.18, 0.24), uv.y);
  vec3 cloud = mix(vec3(0.2, 0.22, 0.3), vec3(0.42, 0.45, 0.55), c2);
  vec3 col = mix(sky, cloud, dens * smoothstep(0.1, 0.7, uv.y));
  float near = exp(-abs(p.x - bx) * 1.2);
  col += vec3(0.6, 0.65, 0.95) * flash * (0.25 + dens) * near * 1.2;
  col += vec3(0.25, 0.28, 0.4) * flash * 0.3;
  float xoff = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    xoff += (noise(vec2(uv.y * (5.0 + fi * 7.0), slot * 13.0 + fi)) - 0.5) * (0.14 / (fi + 1.0));
  }
  float bolt = exp(-abs(p.x - bx - xoff) * 300.0) * smoothstep(0.12, 0.55, uv.y) * smoothstep(0.95, 0.6, uv.y);
  col += vec3(0.88, 0.92, 1.0) * bolt * strike * exp(-local * 4.0) * 3.0;
  vec2 rp = vec2(p.x * 70.0 + p.y * 14.0, p.y * 5.0 + t * 12.0);
  float rain = step(0.92, hash21(floor(rp))) * smoothstep(0.0, 1.0, fract(rp.y));
  col += vec3(0.6, 0.65, 0.8) * rain * 0.12;
  float ground = 0.08 + 0.03 * fbm(vec2(p.x * 2.0, 4.0));
  col = mix(col, vec3(0.03, 0.035, 0.05) + flash * 0.05, smoothstep(ground + 0.004, ground - 0.004, uv.y));
  fragColor = vec4(col, 1.0);
}`);

const meadow = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 m = mouseUv();
  vec3 col = mix(vec3(0.75, 0.88, 1.0), vec3(0.3, 0.55, 0.95), uv.y);
  float cl = fbm(vec2(uv.x * aspect * 1.5 + iTime * 0.01, uv.y * 3.0));
  col = mix(col, vec3(1.0), smoothstep(0.55, 0.8, cl) * smoothstep(0.45, 0.8, uv.y) * 0.85);
  float hill = 0.35 + 0.08 * sin(uv.x * aspect * 1.5 + 1.0) + 0.04 * sin(uv.x * aspect * 3.7);
  col = mix(col, vec3(0.45, 0.65, 0.35), smoothstep(hill + 0.003, hill - 0.003, uv.y));
  float hill2 = 0.22 + 0.06 * sin(uv.x * aspect * 2.2 + 3.0);
  col = mix(col, vec3(0.3, 0.55, 0.2), smoothstep(hill2 + 0.003, hill2 - 0.003, uv.y));
  // grass blades swaying with "wind" from the cursor
  float wind = (m.x - 0.5) * 0.8 + sin(iTime * 0.8) * 0.3;
  vec2 gp = vec2(uv.x * aspect * 90.0, uv.y);
  float id = floor(gp.x);
  float hgt = 0.12 + 0.1 * hash11(id);
  float bend = wind * uv.y * uv.y * 6.0 * (0.6 + hash11(id * 3.0));
  float x = fract(gp.x + bend * 10.0) - 0.5;
  float blade = smoothstep(0.35, 0.0, abs(x) - (1.0 - uv.y / hgt) * 0.3) * step(uv.y, hgt);
  vec3 gc = mix(vec3(0.15, 0.4, 0.12), vec3(0.5, 0.75, 0.3), uv.y / hgt);
  col = mix(col, gc, blade * 0.9);
  // flowers
  vec2 fp = vec2(uv.x * aspect * 30.0, uv.y * 30.0);
  vec2 fg = floor(fp), ff = fract(fp) - 0.5;
  float fh = hash21(fg);
  float flower = smoothstep(0.18, 0.1, length(ff - (hash22(fg) - 0.5) * 0.5)) * step(0.88, fh) * step(uv.y, 0.15);
  col = mix(col, mix(vec3(1.0, 0.85, 0.2), vec3(1.0, 0.4, 0.6), step(0.94, fh)), flower);
  fragColor = vec4(col, 1.0);
}`);

const retroSun = sh(`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = mouseUv() - 0.5;
  float b = bass();
  vec3 col = mix(vec3(0.15, 0.02, 0.25), vec3(0.95, 0.4, 0.3), smoothstep(0.5, -0.2, uv.y));
  vec2 sp = uv - vec2(m.x * 0.1, 0.05);
  float r = length(sp);
  float bands = step(0.0, sin((sp.y + iTime * 0.02) * 70.0)) + step(0.12, sp.y);
  float sun = smoothstep(0.3, 0.295, r) * clamp(bands, 0.0, 1.0);
  col = mix(col, mix(vec3(1.0, 0.25, 0.5), vec3(1.0, 0.9, 0.35), smoothstep(-0.25, 0.25, sp.y)), sun);
  col += vec3(1.0, 0.3, 0.5) * exp(-r * 3.0) * (0.35 + b * 0.5);
  float x = uv.x * 3.0;
  float mtn = -0.12 + 0.12 * abs(fract(x * 0.5 + 0.25) - 0.5) * 2.0 * (0.6 + 0.4 * hash11(floor(x * 0.5 + 0.25)));
  float mm = smoothstep(mtn + 0.003, mtn - 0.003, uv.y);
  vec3 mcol = vec3(0.08, 0.02, 0.15);
  float edgeGlow = exp(-abs(uv.y - mtn) * 120.0) * 0.6;
  col = mix(col, mcol, mm) + vec3(0.9, 0.2, 0.9) * edgeGlow * step(uv.y, mtn + 0.02);
  if (uv.y < -0.12) {
    float z = 0.25 / (-0.12 - uv.y + 0.001);
    vec2 g = vec2(uv.x * z, z + iTime * 0.8);
    vec2 w = fwidth(g);
    vec2 l = 1.0 - smoothstep(vec2(0.0), w * 1.5, 0.5 - abs(fract(g) - 0.5));
    col = vec3(0.05, 0.0, 0.1) + vec3(0.2, 0.9, 1.0) * max(l.x, l.y) * exp(-z * 0.05);
  }
  fragColor = vec4(col, 1.0);
}`);

export const SHADER_LIBRARY: LibraryShader[] = [
  { id: "aurora", name: "Aurora Veil", category: "nature", description: "Northern lights over dark mountains.", code: aurora },
  { id: "neon-grid", name: "Neon Horizon", category: "retro", description: "Synthwave sun over an endless neon grid.", code: neonGrid, effects: { trail: { enabled: true } } },
  { id: "plasma", name: "Liquid Plasma", category: "abstract", description: "Shifting color plasma that bends around your cursor.", code: plasma },
  { id: "deep-space", name: "Deep Space Drift", category: "space", description: "Twinkling star layers over faint nebula clouds.", code: deepSpace, effects: { parallax: 0.4 } },
  { id: "nebula", name: "Nebula Bloom", category: "space", description: "Bright, slowly folding interstellar gas.", code: nebula },
  { id: "ocean-sunset", name: "Ocean Sunset", category: "nature", description: "The sun setting over glittering waves.", code: oceanSunset, effects: { ripples: { enabled: true, strength: 0.8, refraction: 0.6 } } },
  { id: "rain-glass", name: "Rain on Glass", category: "cozy", description: "Raindrops on a window with city lights blurred behind.", code: rainGlass },
  { id: "lava-lamp", name: "Lava Lamp", category: "retro", description: "Warm wax blobs rising and merging. One follows your cursor.", code: lavaLamp },
  { id: "digital-rain", name: "Digital Rain", category: "retro", description: "Falling green code that brightens near your cursor.", code: digitalRain },
  { id: "fireflies", name: "Firefly Forest", category: "nature", description: "Fireflies blinking among misty pines under the moon.", code: fireflies },
  { id: "snow-peaks", name: "Snowy Peaks", category: "nature", description: "Layered mountains at dawn with falling snow.", code: snowPeaks, effects: { parallax: 0.3 } },
  { id: "neon-tunnel", name: "Neon Tunnel", category: "abstract", description: "An endless neon tunnel that pulses to your music.", code: neonTunnel, effects: { beatPulse: 0.4 } },
  { id: "ink-bloom", name: "Ink Bloom", category: "abstract", description: "Ink swirling through water on warm paper.", code: inkBloom },
  { id: "dunes", name: "Desert Dunes", category: "nature", description: "Rolling dunes under a golden-hour sun.", code: dunes },
  { id: "hex-pulse", name: "Hex Pulse", category: "abstract", description: "A hexagon grid lighting up around your cursor.", code: hexPulse, effects: { beatPulse: 0.25 } },
  { id: "bokeh", name: "Bokeh Dreams", category: "cozy", description: "Soft, out-of-focus lights drifting upward.", code: bokehDreams, effects: { parallax: 0.5 } },
  { id: "galaxy", name: "Spiral Galaxy", category: "space", description: "A spiral galaxy turning slowly, with dust lanes.", code: galaxy },
  { id: "underwater", name: "Sunbeams Below", category: "nature", description: "Sun rays and drifting particles under the sea.", code: underwaterRays, effects: { ripples: { enabled: true, strength: 0.7, refraction: 0.8 } } },
  { id: "silk", name: "Silk Gradient", category: "abstract", description: "Calm pastel ribbons for a clean desktop.", code: silk },
  { id: "chrome", name: "Liquid Chrome", category: "abstract", description: "Molten metal that bulges under your cursor.", code: chrome },
  { id: "sakura", name: "Sakura Drift", category: "cozy", description: "Cherry blossom petals tumbling through spring air.", code: sakura },
  { id: "storm", name: "Thunderstorm", category: "nature", description: "Rolling storm clouds, rain and lightning strikes.", code: storm },
  { id: "meadow", name: "Windy Meadow", category: "nature", description: "Grass and flowers sway in a breeze you control with the mouse.", code: meadow },
  { id: "retro-sun", name: "Outrun Sunset", category: "retro", description: "Striped sun, purple mountains and a glowing grid.", code: retroSun, effects: { beatPulse: 0.3 } },
];
