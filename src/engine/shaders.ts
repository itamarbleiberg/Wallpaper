// All GLSL ES 3.00 sources used by the engine.

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// ------------------------------------------------------------------ water simulation
// State texture: R = height, G = vertical velocity.

export const SIM_UPDATE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uSpeed;    // propagation coefficient (0..1.95)
uniform float uDamping;  // velocity damping per step
void main() {
  vec4 s = texture(uState, vUv);
  // Isotropic 9-point average (round ripples instead of square ones).
  vec2 tx = vec2(uTexel.x, 0.0), ty = vec2(0.0, uTexel.y);
  float cross = texture(uState, vUv + tx).r + texture(uState, vUv - tx).r +
                texture(uState, vUv + ty).r + texture(uState, vUv - ty).r;
  float diag = texture(uState, vUv + tx + ty).r + texture(uState, vUv - tx + ty).r +
               texture(uState, vUv + tx - ty).r + texture(uState, vUv - tx - ty).r;
  float avg = cross * 0.2 + diag * 0.05;
  s.g += (avg - s.r) * uSpeed;
  s.g *= uDamping;
  s.r += s.g;
  s.r *= 0.9992; // slow drift back to rest
  outColor = vec4(s.rg, 0.0, 1.0);
}`;

// Adds a smooth capsule-shaped impulse along the segment A->B (velocity-based wake).
export const SIM_DROP_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uA;
uniform vec2 uB;
uniform float uRadius;   // in units of screen height
uniform float uStrength;
uniform float uAspect;
const float PI = 3.14159265;
void main() {
  vec4 s = texture(uState, vUv);
  vec2 sc = vec2(uAspect, 1.0);
  vec2 p = vUv * sc, a = uA * sc, b = uB * sc;
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  float d = length(pa - ba * h);
  float drop = max(0.0, 1.0 - d / uRadius);
  drop = 0.5 - cos(drop * PI) * 0.5;
  s.r += drop * uStrength;
  outColor = vec4(s.rg, 0.0, 1.0);
}`;

// ------------------------------------------------------------------ water rendering
// Renders either the procedural pool (uUseSource = 0) or refracts an arbitrary
// source texture through the ripple surface (uUseSource = 1, video/shader overlay).

export const WATER_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uHeight;
uniform vec2 uSimTexel;
uniform sampler2D uSource;
uniform int uUseSource;
uniform vec2 uResolution;
uniform float uTime;

uniform float uWaveIntensity;
uniform float uRefraction;
uniform float uCaustics;
uniform float uClarity;
uniform float uDepth;
uniform float uSpecular;
uniform float uReflection;
uniform float uTileScale;
uniform float uEdgeShadow;
uniform int uFloorStyle;
uniform vec3 uWaterColor;
uniform vec3 uDeepColor;
uniform vec3 uTileColor;
uniform vec3 uGroutColor;
uniform vec3 uSunDir;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

// Animated cellular edge distance: bright thin network like pool caustics.
float cellEdge(vec2 p, float t) {
  vec2 g = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 r = hash22(g + o);
      r = 0.5 + 0.45 * sin(t + 6.2831 * r);
      vec2 d = o + r - f;
      float dd = dot(d, d);
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
float causticPattern(vec2 p, float t) {
  vec2 w = 0.25 * vec2(sin(t * 0.31 + p.y * 1.3), cos(t * 0.27 + p.x * 1.1));
  float a = cellEdge(p + w, t * 0.9);
  float b = cellEdge(p * 1.7 + vec2(3.1, 7.7) - w, t * 1.2);
  float c = pow(1.0 - smoothstep(0.0, 0.22, a), 3.0);
  c += 0.6 * pow(1.0 - smoothstep(0.0, 0.18, b), 3.0);
  return c;
}

vec3 poolFloor(vec2 uv, float aspect) {
  vec2 p = uv * vec2(aspect, 1.0) * uTileScale;
  if (uFloorStyle == 0) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    float h = hash12(cell);
    vec2 e = min(f, 1.0 - f);
    float edge = min(e.x, e.y);
    float aa = uTileScale / uResolution.y * 1.5;
    float grout = 1.0 - smoothstep(0.022, 0.022 + aa, edge);
    vec3 tile = uTileColor * (0.9 + 0.14 * h);
    tile *= 0.94 + 0.06 * smoothstep(0.0, 0.2, edge);
    // a dark lane stripe every 6 tiles, like a lap pool
    float isLane = 1.0 - step(0.5, abs(mod(cell.y, 6.0) - 3.0));
    float lane = isLane * (1.0 - smoothstep(0.16, 0.16 + aa, abs(f.y - 0.5)));
    tile = mix(tile, uGroutColor * 0.5, lane * 0.8);
    return mix(tile, uGroutColor, grout);
  }
  if (uFloorStyle == 1) {
    float n = vnoise(p * 3.0) * 0.5 + vnoise(p * 9.0) * 0.3 + vnoise(p * 27.0) * 0.2;
    float ripple = 0.5 + 0.5 * sin(p.x * 2.2 + vnoise(p * 0.8) * 4.0);
    return mix(uGroutColor, uTileColor, clamp(n * 0.8 + ripple * 0.25, 0.0, 1.0));
  }
  return uTileColor;
}

float H(vec2 uv) { return texture(uHeight, uv).r; }

void main() {
  float aspect = uResolution.x / uResolution.y;
  float c = H(vUv);
  float l = H(vUv - vec2(uSimTexel.x, 0.0));
  float r = H(vUv + vec2(uSimTexel.x, 0.0));
  float d = H(vUv - vec2(0.0, uSimTexel.y));
  float u = H(vUv + vec2(0.0, uSimTexel.y));
  float k = 12.0 * uWaveIntensity;
  vec3 n = normalize(vec3((l - r) * k, (d - u) * k, 1.0));
  float lap = (l + r + u + d - 4.0 * c);

  // Refraction through the surface (top-down view, water IOR 1.333).
  vec3 refr = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / 1.333);
  float depth = mix(0.25, 1.6, uDepth);
  vec2 offset = refr.xy / max(-refr.z, 0.2) * 0.09 * depth * uRefraction;
  offset.x /= aspect;
  vec2 fuv = clamp(vUv + offset, 0.0, 1.0);

  vec3 col;
  float focus = clamp(-lap * 80.0 * uWaveIntensity, -0.6, 2.5);
  if (uUseSource == 1) {
    col = texture(uSource, fuv).rgb;
    col *= 1.0 + focus * 0.25 * uCaustics;
  } else {
    vec3 floorCol = poolFloor(fuv, aspect);
    vec2 cp = fuv * vec2(aspect, 1.0) * 3.2 + n.xy * 0.5;
    float caus = causticPattern(cp, uTime * 0.9);
    float light = 0.78 + uCaustics * (caus * 0.38 + focus * 0.6) * mix(1.0, 0.6, uDepth);
    // Beer-Lambert style absorption: red is absorbed first.
    vec3 absorb = vec3(0.45, 0.12, 0.07) * (1.0 - uClarity) * 3.0 * (0.35 + uDepth);
    vec3 T = exp(-absorb * 2.0);
    col = floorCol * light * T + uWaterColor * (1.0 - T);
    col = mix(col, uWaterColor * col * 1.6, 0.25 * (1.0 - uClarity * 0.5));
    col = mix(col, uDeepColor, (1.0 - uClarity) * 0.35 * uDepth);
    // Pool walls: soft shadow near the screen edges.
    float ed = min(min(vUv.x, 1.0 - vUv.x) * aspect, min(vUv.y, 1.0 - vUv.y));
    col *= mix(1.0 - uEdgeShadow, 1.0, smoothstep(0.0, 0.14, ed));
  }

  // Surface reflection + sun glints.
  vec3 V = vec3(0.0, 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(vec3(0.72, 0.86, 1.0), vec3(0.32, 0.56, 0.92), clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
  col = mix(col, sky, clamp(fres * uReflection * 6.0, 0.0, 0.65));
  vec3 L = normalize(uSunDir);
  vec3 Hh = normalize(L + V);
  float spec = pow(max(dot(n, Hh), 0.0), 350.0) * uSpecular * 2.5;
  col += vec3(1.0, 0.97, 0.9) * spec;
  outColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ video composite
// Two video slots (front/back) for seamless loops & crossfades, each with the
// previous frame for realtime frame blending. Catmull-Rom sampling for upscaling.

export const VIDEO_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFront;
uniform sampler2D uFrontPrev;
uniform sampler2D uBack;
uniform sampler2D uBackPrev;
uniform float uFrontBlend;
uniform float uBackBlend;
uniform float uMix;
uniform vec2 uFrontSize;
uniform vec2 uBackSize;
uniform vec2 uOut;
uniform int uFit;      // 0 cover, 1 contain, 2 stretch
uniform int uBicubic;
uniform float uOpacity;

vec2 fitUv(vec2 uv, vec2 src) {
  if (uFit == 2 || src.x < 1.0) return uv;
  float sa = src.x / src.y, da = uOut.x / uOut.y;
  vec2 s = vec2(1.0);
  if (uFit == 0) { if (sa > da) s.x = da / sa; else s.y = sa / da; }
  else { if (sa > da) s.y = sa / da; else s.x = da / sa; }
  return (uv - 0.5) * s + 0.5;
}

vec4 catmull(sampler2D tex, vec2 uv, vec2 size) {
  vec2 sp = uv * size;
  vec2 t1 = floor(sp - 0.5) + 0.5;
  vec2 f = sp - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (t1 - 1.0) / size;
  vec2 t3 = (t1 + 2.0) / size;
  vec2 t12 = (t1 + w2 / w12) / size;
  vec4 r = vec4(0.0);
  r += texture(tex, vec2(t0.x, t0.y)) * w0.x * w0.y;
  r += texture(tex, vec2(t12.x, t0.y)) * w12.x * w0.y;
  r += texture(tex, vec2(t3.x, t0.y)) * w3.x * w0.y;
  r += texture(tex, vec2(t0.x, t12.y)) * w0.x * w12.y;
  r += texture(tex, vec2(t12.x, t12.y)) * w12.x * w12.y;
  r += texture(tex, vec2(t3.x, t12.y)) * w3.x * w12.y;
  r += texture(tex, vec2(t0.x, t3.y)) * w0.x * w3.y;
  r += texture(tex, vec2(t12.x, t3.y)) * w12.x * w3.y;
  r += texture(tex, vec2(t3.x, t3.y)) * w3.x * w3.y;
  return max(r, 0.0);
}

vec3 samp(sampler2D tex, vec2 uv, vec2 size) {
  if (uBicubic == 1 && size.x > 1.0 && size.y < uOut.y * 0.98) return catmull(tex, uv, size).rgb;
  return texture(tex, uv).rgb;
}

vec3 slot(sampler2D cur, sampler2D prev, float blend, vec2 size) {
  vec2 uv = fitUv(vUv, size);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
  vec3 c = samp(cur, uv, size);
  if (blend < 0.999) c = mix(samp(prev, uv, size), c, blend);
  return c;
}

void main() {
  vec3 col = slot(uFront, uFrontPrev, uFrontBlend, uFrontSize);
  if (uMix > 0.001) col = mix(col, slot(uBack, uBackPrev, uBackBlend, uBackSize), uMix);
  outColor = vec4(col * uOpacity, 1.0);
}`;

// ------------------------------------------------------------------ post processing

export const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uDir; // texel * radius along one axis
void main() {
  vec3 c = texture(uSrc, vUv).rgb * 0.2270270;
  c += texture(uSrc, vUv + uDir * 1.3846154).rgb * 0.3162162;
  c += texture(uSrc, vUv - uDir * 1.3846154).rgb * 0.3162162;
  c += texture(uSrc, vUv + uDir * 3.2307692).rgb * 0.0702703;
  c += texture(uSrc, vUv - uDir * 3.2307692).rgb * 0.0702703;
  outColor = vec4(c, 1.0);
}`;

export const POST_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform sampler2D uBlurTex;
uniform int uHasBlur;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform float uTime;
uniform float uSharpen;
uniform float uBlur;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uVibrance;
uniform float uGamma;
uniform float uTemperature;
uniform float uVignette;
uniform float uVignetteSoft;
uniform float uGrain;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  if (uSharpen > 0.001) {
    // Contrast-adaptive sharpening (CAS-style).
    vec3 a = texture(uSrc, vUv + vec2(0.0, uTexel.y)).rgb;
    vec3 b = texture(uSrc, vUv - vec2(0.0, uTexel.y)).rgb;
    vec3 e = texture(uSrc, vUv + vec2(uTexel.x, 0.0)).rgb;
    vec3 w = texture(uSrc, vUv - vec2(uTexel.x, 0.0)).rgb;
    vec3 mn = min(c, min(min(a, b), min(e, w)));
    vec3 mx = max(c, max(max(a, b), max(e, w)));
    vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
    vec3 wgt = amp * (-1.0 / mix(8.0, 5.0, clamp(uSharpen, 0.0, 1.0)));
    c = clamp(((a + b + e + w) * wgt + c) / (1.0 + 4.0 * wgt), 0.0, 1.0);
  }
  if (uHasBlur == 1) c = mix(c, texture(uBlurTex, vUv).rgb, clamp(uBlur * 1.5, 0.0, 1.0));
  c *= uBrightness;
  c *= vec3(1.0 + uTemperature * 0.12, 1.0, 1.0 - uTemperature * 0.12);
  c = (c - 0.5) * uContrast + 0.5;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(lum), c, uSaturation);
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(lum), c, 1.0 + uVibrance * (1.0 - sat));
  c = pow(max(c, 0.0), vec3(1.0 / max(uGamma, 0.05)));
  if (uVignette > 0.001) {
    vec2 d = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float v = smoothstep(0.35, 0.35 + uVignetteSoft * 0.8, length(d));
    c *= 1.0 - uVignette * v;
  }
  if (uGrain > 0.001) c += (hash(vUv * uResolution + fract(uTime) * 100.0) - 0.5) * uGrain * 0.12;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// ------------------------------------------------------------------ particles / light trails

export const PARTICLE_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;   // pixels, bottom-left origin
layout(location = 1) in float aSize; // pixels
layout(location = 2) in vec4 aColor;
uniform vec2 uResolution;
out vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = vec4(aPos / uResolution * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aSize;
}`;

export const PARTICLE_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = exp(-r * r * 3.5) * (1.0 - smoothstep(0.85, 1.0, r));
  a *= vColor.a;
  outColor = vec4(vColor.rgb * a, a);
}`;

// ------------------------------------------------------------------ shadertoy wrapper

export function wrapShadertoy(code: string): string {
  return `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform sampler2D iChannel0;
out vec4 aqua_FragColor;
${code}
void main() {
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(c, gl_FragCoord.xy);
  aqua_FragColor = vec4(c.rgb, 1.0);
}`;
}

/** Number of lines the wrapper adds before user code (for error line mapping). */
export const SHADERTOY_PREFIX_LINES = 10;
