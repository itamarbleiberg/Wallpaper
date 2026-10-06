// Built-in Shadertoy-style wallpapers. Available uniforms:
//   iResolution (vec3), iTime, iTimeDelta, iFrame, iMouse (vec4, px),
//   iDate, iChannel0 (64x1 audio spectrum, .r = level 0..1)

export interface BuiltinShader { id: string; name: string; code: string }

const aurora = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 m = iMouse.xy / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = iTime * 0.08;
  float bass = texture(iChannel0, vec2(0.04, 0.5)).r;
  vec3 col = mix(vec3(0.01, 0.015, 0.05), vec3(0.02, 0.05, 0.12), uv.y);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float band = fbm(vec2(p.x * 1.4 + t * (1.0 + fi * 0.4) + fi * 3.7, t * 0.5 + fi));
    float y = 0.58 + 0.34 * (band - 0.5) + fi * 0.07 + (m.x - 0.5) * 0.04;
    float d = uv.y - y;
    float glow = exp(-abs(d) * (16.0 - fi * 4.0)) * smoothstep(-0.25, 0.05, d) * smoothstep(0.1, 0.45, uv.y);
    vec3 c = mix(vec3(0.1, 1.0, 0.6), vec3(0.65, 0.3, 1.0), clamp(fi / 2.0 + 0.3 * sin(t * 3.0 + p.x), 0.0, 1.0));
    float curtain = fbm(vec2(p.x * 9.0 + fi * 10.0, uv.y * 1.5 - t * 5.0));
    col += c * glow * (0.45 + curtain) * (0.6 + bass * 0.8);
  }
  vec2 g = floor(fragCoord / 2.5);
  float s = hash(g);
  col += step(0.9985, s) * (0.55 + 0.45 * sin(iTime * 2.0 + s * 100.0)) * vec3(0.9);
  float md = length((uv - m) * vec2(aspect, 1.0));
  col += vec3(0.15, 0.5, 0.45) * exp(-md * 7.0) * 0.18;
  fragColor = vec4(col, 1.0);
}
`;

const neonGrid = /* glsl */ `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  vec2 m = iMouse.xy / iResolution.xy - 0.5;
  float bass = texture(iChannel0, vec2(0.05, 0.5)).r;
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
    col += vec3(1.0, 0.3, 0.6) * exp(-r * 4.0) * (0.25 + bass * 0.5);
  } else {
    float z = 0.35 / (horizon - uv.y + 0.0005);
    vec2 g = vec2((uv.x + m.x * 0.6) * z, z + iTime * 1.6);
    vec2 gw = fwidth(g);
    vec2 dist = 0.5 - abs(fract(g) - 0.5);
    vec2 l = 1.0 - smoothstep(vec2(0.0), gw * 1.6, dist);
    float line = max(l.x, l.y);
    float fade = exp(-z * 0.06);
    col = vec3(0.03, 0.0, 0.08) + vec3(1.0, 0.2, 0.85) * line * fade * (1.0 + bass);
    col += vec3(0.9, 0.2, 0.6) * exp(-(horizon - uv.y) * 14.0) * 0.5;
  }
  fragColor = vec4(col, 1.0);
}
`;

const plasma = /* glsl */ `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.y;
  vec2 m = iMouse.xy / iResolution.y;
  float t = iTime * 0.25;
  float bass = texture(iChannel0, vec2(0.05, 0.5)).r;
  vec2 p = uv * 2.5;
  float d = length(uv - m);
  p += 0.35 * vec2(sin(d * 12.0 - iTime * 3.0), cos(d * 12.0 - iTime * 3.0)) * exp(-d * 3.5);
  for (int i = 1; i < 6; i++) {
    float fi = float(i);
    p += vec2(0.6 / fi * sin(fi * p.y + t + 0.3 * fi), 0.6 / fi * cos(fi * p.x + t * 1.3 + 0.3 * fi));
  }
  vec3 col = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + p.x + p.y + t * 2.0);
  col = pow(col, vec3(1.3)) * (0.7 + bass * 0.5);
  fragColor = vec4(col, 1.0);
}
`;

export const BUILTIN_SHADERS: BuiltinShader[] = [
  { id: "aurora", name: "Aurora Veil", code: aurora.trim() },
  { id: "neon-grid", name: "Neon Horizon", code: neonGrid.trim() },
  { id: "plasma", name: "Liquid Plasma", code: plasma.trim() },
];
