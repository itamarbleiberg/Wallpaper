// CPU-side behaviour for the koi pond: fish wander, avoid walls and each
// other, and dart away from the cursor; lily pads drift, collide and get
// pushed around by the cursor. Positions are in "aspect space" (x: 0..aspect,
// y: 0..1) and exported as UV for the water shader.

interface Fish { x: number; y: number; a: number; v: number; size: number; wander: number; turn: number; scare: number }
interface Pad { x: number; y: number; vx: number; vy: number; r: number; rot: number; spin: number }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class PondLife {
  private fish: Fish[] = [];
  private pads: Pad[] = [];
  readonly fishData = new Float32Array(32);
  readonly padData = new Float32Array(48);
  fishCount = 0;
  padCount = 0;
  private aspect = 16 / 9;

  configure(fish: number, pads: number, aspect: number) {
    this.aspect = aspect;
    fish = Math.max(0, Math.min(8, Math.round(fish)));
    pads = Math.max(0, Math.min(12, Math.round(pads)));
    while (this.fish.length < fish) {
      this.fish.push({
        x: rnd(0.2, aspect - 0.2), y: rnd(0.2, 0.8), a: rnd(0, Math.PI * 2), v: rnd(0.05, 0.08),
        size: rnd(0.065, 0.095), wander: rnd(0, 100), turn: 0, scare: 0,
      });
    }
    this.fish.length = fish;
    while (this.pads.length < pads) {
      const r = rnd(0.045, 0.085);
      this.pads.push({ x: rnd(r, aspect - r), y: rnd(r, 1 - r), vx: rnd(-0.004, 0.004), vy: rnd(-0.004, 0.004), r, rot: rnd(0, Math.PI * 2), spin: rnd(-0.03, 0.03) });
    }
    this.pads.length = pads;
    this.fishCount = fish;
    this.padCount = pads;
  }

  /** Scare fish near (u,v) (uv, y up) - e.g. after a click splash. */
  startle(u: number, v: number, power = 1) {
    const px = u * this.aspect;
    for (const f of this.fish) {
      const d = Math.hypot(f.x - px, f.y - v);
      if (d < 0.45) f.scare = Math.max(f.scare, power * (1 - d / 0.45));
    }
  }

  update(dt: number, speed: number, pu: number, pv: number, pvx: number, pvy: number, pointerActive: boolean) {
    const A = this.aspect;
    const px = pu * A, py = pv;
    const t = performance.now() / 1000;
    for (const f of this.fish) {
      // wander
      f.turn += (Math.sin(t * 0.7 + f.wander) * 0.8 + Math.sin(t * 0.23 + f.wander * 3.1) * 0.6 - f.turn) * dt * 0.8;
      let steer = f.turn * 0.9;
      const hx = Math.cos(f.a), hy = Math.sin(f.a);
      // walls: steer toward center when close to an edge
      const m = 0.16;
      const wall = Math.max(0, m - f.x) + Math.max(0, f.x - (A - m)) + Math.max(0, m - f.y) + Math.max(0, f.y - (1 - m));
      if (wall > 0) {
        const cx = A / 2 - f.x, cy = 0.5 - f.y;
        const cross = hx * cy - hy * cx;
        steer += Math.sign(cross) * (2 + wall * 30);
      }
      // separation
      for (const o of this.fish) {
        if (o === f) continue;
        const dx = f.x - o.x, dy = f.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 0.12) steer += Math.sign(hx * dy - hy * dx) * (0.12 - d) * 12;
      }
      // flee the cursor
      if (pointerActive) {
        const dx = f.x - px, dy = f.y - py;
        const d = Math.hypot(dx, dy);
        const moving = Math.hypot(pvx * A, pvy);
        if (d < 0.22) {
          f.scare = Math.max(f.scare, (1 - d / 0.22) * Math.min(1, 0.4 + moving * 0.6));
          const away = Math.atan2(dy, dx);
          let diff = away - f.a;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          steer += diff * 6 * f.scare;
        }
      }
      f.scare = Math.max(0, f.scare - dt * 0.6);
      f.a += steer * dt;
      const v = f.v * speed * (1 + f.scare * 3.5);
      f.x += Math.cos(f.a) * v * dt;
      f.y += Math.sin(f.a) * v * dt;
      f.x = Math.min(A - 0.02, Math.max(0.02, f.x));
      f.y = Math.min(0.98, Math.max(0.02, f.y));
    }
    for (const p of this.pads) {
      if (pointerActive) {
        const dx = p.x - px, dy = p.y - py;
        const d = Math.hypot(dx, dy);
        const reach = p.r + 0.06;
        if (d < reach) {
          const k = (1 - d / reach) * 0.6;
          p.vx += (dx / (d || 1)) * k * dt + pvx * A * k * dt * 0.6;
          p.vy += (dy / (d || 1)) * k * dt + pvy * k * dt * 0.6;
        }
      }
      for (const o of this.pads) {
        if (o === p) continue;
        const dx = p.x - o.x, dy = p.y - o.y;
        const d = Math.hypot(dx, dy);
        const min = p.r + o.r;
        if (d > 0 && d < min) {
          const push = (min - d) * 0.5;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        }
      }
      p.vx += Math.sin(t * 0.1 + p.r * 100) * 0.0004 * dt;
      p.vy += Math.cos(t * 0.13 + p.r * 70) * 0.0004 * dt;
      const drag = Math.exp(-dt * 0.8);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += (p.spin + (p.vx - p.vy) * 2) * dt;
      if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx); }
      if (p.x > A - p.r) { p.x = A - p.r; p.vx = -Math.abs(p.vx); }
      if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); }
      if (p.y > 1 - p.r) { p.y = 1 - p.r; p.vy = -Math.abs(p.vy); }
    }
    this.fish.forEach((f, i) => {
      this.fishData.set([f.x / A, f.y, f.a, f.size], i * 4);
    });
    this.pads.forEach((p, i) => {
      this.padData.set([p.x / A, p.y, p.r, p.rot], i * 4);
    });
  }
}
