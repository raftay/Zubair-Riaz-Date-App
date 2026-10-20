// Procedural date palm (Phoenix dactylifera), drawn on a 2D canvas.
// World units: x right, y DOWN (ground at y = 0, the crown at negative y).
// Fronds are modelled in 3D (x right, y up, z toward viewer) and projected
// orthographically so leaflets foreshorten naturally as the crown turns.
import { TAU, clamp, lerp, smoothstep, invlerp, mix, rgba, hex, ramp, ease } from './math.js';
import { rng, noise1 } from './rand.js';

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const UP = [0, 1, 0];
const GRAV = [0, -1, 0];

const LEAF = [hex('#1F2A1A'), hex('#3E5130'), hex('#6F8048'), hex('#B4B47A')];
const LEAF_OLD = [hex('#2A2A18'), hex('#575634'), hex('#8C874E'), hex('#C2B57C')];
const RACHIS = hex('#A39258');

const tint = (c, amb) => [c[0] * amb[0], c[1] * amb[1], c[2] * amb[2]];

/**
 * One pinnate frond.
 * f = { x, y, s, phi, elev, len, droop, unfurl, leaflets, lm, v, lw, age,
 *       light:[3], amb:[3], depth, flat?: 'css colour', alpha? }
 */
export function drawFrond(ctx, f) {
  const se = Math.sin(f.elev);
  const D0 = [se * Math.cos(f.phi), Math.cos(f.elev), se * Math.sin(f.phi)];
  const A = [Math.cos(f.phi), 0, Math.sin(f.phi)];
  const L = f.len;
  const s = f.s;
  const P = (q) => add(mul(D0, q * L), GRAV, q * q * f.droop * L);
  const X = (p) => f.x + p[0] * s;
  const Y = (p) => f.y - p[1] * s;

  // leaflets, batched into bands for shading
  const bands = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const n = f.leaflets;
  const vv = f.v;
  for (let i = 0; i < n; i++) {
    const q = 0.08 + 0.92 * ((i + 0.5) / n);
    const p = P(q);
    const T = norm(add(D0, GRAV, 2 * q * f.droop));
    let S = add(cross(T, UP), cross(T, A), 0.35);
    S = norm(S);
    let N = norm(cross(S, T));
    if (N[1] < 0) N = mul(N, -1);
    const spine = q < 0.2;
    const shape = spine ? 0.16 : q < 0.42 ? lerp(0.45, 1, smoothstep(0.2, 0.42, q)) : lerp(1, 0.26, (q - 0.42) / 0.58);
    const ll = f.lm * L * shape;
    const band = q < 0.4 ? 0 : q < 0.7 ? 1 : 2;
    for (let k = -1; k <= 1; k += 2) {
      let d = norm(add(add(mul(S, k * Math.cos(vv)), N, Math.sin(vv)), T, spine ? 0.25 : 0.62));
      if (f.unfurl < 1) d = norm(add(mul(T, 1 - f.unfurl), d, Math.max(0.05, f.unfurl)));
      const tip = add(add(p, d, ll), GRAV, ll * 0.22 * q);
      const ax = X(p), ay = Y(p);
      const bx = X(tip), by = Y(tip);
      const dx = bx - ax, dy = by - ay;
      const dl = Math.hypot(dx, dy) || 1;
      const w = Math.max(0.32, f.lw * s * (spine ? 0.45 : 1));
      const nx = (-dy / dl) * w, ny = (dx / dl) * w;
      const path = bands[band * 2 + (k > 0 ? 1 : 0)];
      path.moveTo(ax + nx, ay + ny);
      path.quadraticCurveTo(ax + dx * 0.55 + nx * 0.7, ay + dy * 0.55 + ny * 0.7, bx, by);
      path.quadraticCurveTo(ax + dx * 0.55 - nx * 0.7, ay + dy * 0.55 - ny * 0.7, ax - nx, ay - ny);
      path.closePath();
    }
  }

  ctx.globalAlpha = f.alpha ?? 1;
  // rachis
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  for (let i = 1; i <= 16; i++) {
    const p = P(i / 16);
    ctx.lineTo(X(p), Y(p));
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.6, 2.4 * s * (f.lw / 1.6));
  ctx.strokeStyle = f.flat || rgba(tint(RACHIS, f.amb ?? [1, 1, 1]));
  ctx.stroke();

  if (f.flat) {
    ctx.fillStyle = f.flat;
    for (const b of bands) ctx.fill(b);
  } else {
    const pal = f.age > 0 ? LEAF.map((c, i) => mix(c, LEAF_OLD[i], clamp(f.age))) : LEAF;
    const midT = norm(add(D0, GRAV, f.droop));
    let S = norm(add(cross(midT, UP), cross(midT, A), 0.35));
    let N = norm(cross(S, midT));
    if (N[1] < 0) N = mul(N, -1);
    for (let b = 0; b < 3; b++) {
      for (let k = 0; k < 2; k++) {
        const sideN = norm(add(N, S, (k ? 1 : -1) * 0.55));
        const lit = clamp(0.5 + 0.5 * dot(sideN, f.light));
        const shade = clamp((0.18 + 0.82 * lit) * (0.8 + b * 0.12) * f.depth);
        ctx.fillStyle = rgba(tint(ramp(pal, shade), f.amb));
        ctx.fill(bands[b * 2 + k]);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */

const N_FRONDS = 30;
export const TRUNK_MAX = 560;

export class Palm {
  constructor(seed = 7) {
    const r = rng(seed);
    this.fronds = Array.from({ length: N_FRONDS }, (_, i) => ({
      phi: i * 2.39996 + r.range(-0.18, 0.18),
      birth: lerp(0.06, 0.95, Math.pow(i / N_FRONDS, 1.1)),
      lenK: r.range(0.86, 1.1),
      droopK: r.range(0.8, 1.2),
      phase: r() * TAU,
    }));
    this.bunches = Array.from({ length: 6 }, (_, i) => ({
      phi: i * 1.05 + r.range(-0.2, 0.2) + 0.4,
      len: r.range(80, 110),
      strands: Array.from({ length: 18 }, () => ({
        dx: r.range(-20, 20),
        len: r.range(36, 60),
        dates: Math.round(r.range(5, 8)),
        k: r.range(-0.4, 0.4),
      })),
    }));
    this.noise = noise1(seed + 3);
    this.seedlings = [
      { b: 0.03, side: -1, lean: 0.25 },
      { b: 0.065, side: 1, lean: 0.4 },
      { b: 0.1, side: -1, lean: 0.55 },
    ];
  }

  trunkHeight(g) {
    return TRUNK_MAX * ease.inOut(invlerp(0.34, 0.97, g));
  }

  // centreline x offset and radius at height h (world units)
  trunkX(h, H) {
    const u = H > 0 ? h / TRUNK_MAX : 0;
    return 26 * u * u;
  }
  trunkR(h, H = TRUNK_MAX) {
    // young palms have a slender base that thickens as the trunk lengthens
    return (lerp(30, 23, h / TRUNK_MAX) + 13 * Math.exp(-h / 20)) * lerp(0.5, 1, smoothstep(30, 220, H));
  }

  // Screen position of the crown (where fronds attach).
  crown(cam, g) {
    const H = this.trunkHeight(g);
    return { x: cam.ox + this.trunkX(H, H) * cam.s, y: cam.oy - (H + 4) * cam.s, H };
  }

  draw(ctx, cam, g, t, env) {
    const H = this.trunkHeight(g);
    const c = this.crown(cam, g);
    const born = this.fronds.filter((f) => f.birth < g);
    const oldest = born.length ? g - born[0].birth : 0;
    const tall = smoothstep(0, 220, H);
    const eMax = lerp(1.2, 1.4, smoothstep(0.14, 0.4, g)) + 0.62 * tall;
    const droopK = lerp(0.35, 1, tall);
    const Lg = lerp(46, 360, smoothstep(0.06, 0.85, g));
    const leaflets = Math.round(lerp(9, 46, smoothstep(0.08, 0.7, g)));
    const fronds = born.map((f) => {
      const age = g - f.birth;
      const rel = Math.pow(age / (oldest + 0.04), 0.85);
      const sway = Math.sin(t * 0.9 + f.phase) * 0.025 + Math.sin(t * 2.3 + f.phase * 2) * 0.008;
      const elev = lerp(0.1, eMax, rel) + sway;
      const z = Math.sin(elev) * Math.sin(f.phi);
      return {
        x: c.x + Math.cos(f.phi) * 5 * cam.s,
        y: c.y,
        s: cam.s,
        phi: f.phi,
        elev,
        len: Lg * f.lenK * smoothstep(0, 0.1, age),
        droop: lerp(0.04, 0.34, rel) * f.droopK * droopK,
        unfurl: smoothstep(0.004, 0.06, age),
        leaflets,
        lm: 0.33,
        v: 0.5,
        lw: 1.2,
        age: smoothstep(0.55, 0.95, rel) * 0.8,
        light: env.light,
        amb: env.amb,
        depth: lerp(0.62, 1.08, (z + 1) / 2),
        z,
      };
    });
    fronds.sort((a, b) => a.z - b.z);
    const back = fronds.filter((f) => f.z < 0);
    const front = fronds.filter((f) => f.z >= 0);

    this.drawSeedlings(ctx, cam, g, t, env);
    for (const f of back) drawFrond(ctx, f);
    if (H > 1) this.drawTrunk(ctx, cam, H, env);
    this.drawBoots(ctx, c, cam, g, env);
    this.drawFruit(ctx, c, cam, g, t, env);
    for (const f of front) drawFrond(ctx, f);
  }

  drawSeedlings(ctx, cam, g, t, env) {
    const fade = 1 - smoothstep(0.17, 0.26, g);
    if (fade <= 0) return;
    for (const l of this.seedlings) {
      const k = smoothstep(l.b, l.b + 0.07, g);
      if (k <= 0) continue;
      const len = 78 * k;
      const sway = Math.sin(t * 1.3 + l.b * 40) * 2.5;
      const bx = cam.ox, by = cam.oy;
      const tipx = bx + (l.side * len * l.lean + sway) * cam.s;
      const tipy = by - len * cam.s;
      const cx = bx + l.side * len * 0.05 * cam.s;
      const cy = by - len * 0.65 * cam.s;
      const w = 4.2 * cam.s;
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.moveTo(bx - w, by);
      ctx.quadraticCurveTo(cx - w, cy, tipx, tipy);
      ctx.quadraticCurveTo(cx + w, cy, bx + w, by);
      ctx.closePath();
      const gr = ctx.createLinearGradient(bx, by, tipx, tipy);
      gr.addColorStop(0, rgba(tint(hex('#4E6B34'), env.amb)));
      gr.addColorStop(1, rgba(tint(hex('#9DB46A'), env.amb)));
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.strokeStyle = rgba(tint(hex('#C9D79A'), env.amb), 0.5);
      ctx.lineWidth = Math.max(0.5, 0.6 * cam.s);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(cx, cy, tipx, tipy);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawTrunk(ctx, cam, H, env) {
    const s = cam.s;
    const steps = Math.max(8, Math.round(H / 8));
    const left = [], right = [];
    for (let i = 0; i <= steps; i++) {
      const h = (i / steps) * H;
      const cx = this.trunkX(h, H);
      const r = this.trunkR(h, H);
      // protruding leaf-base "boots" make the silhouette rough
      const bump = 2.4 * Math.abs(Math.sin((h / 15) * Math.PI));
      left.push([cam.ox + (cx - r - bump) * s, cam.oy - h * s]);
      right.push([cam.ox + (cx + r + bump * 0.8) * s, cam.oy - h * s]);
    }
    const path = new Path2D();
    path.moveTo(left[0][0], left[0][1]);
    for (const p of left) path.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) path.lineTo(right[i][0], right[i][1]);
    path.closePath();

    const midX = cam.ox + this.trunkX(H / 2, H) * s;
    const r0 = this.trunkR(H / 2, H) * s;
    const side = env.lightSide; // -1 light from left, +1 from right
    const gr = ctx.createLinearGradient(midX + r0 * side, 0, midX - r0 * side, 0);
    const k = env.contrast;
    gr.addColorStop(0, rgba(tint(mix(hex('#8C6C49'), hex('#D4B183'), k), env.amb)));
    gr.addColorStop(0.3, rgba(tint(mix(hex('#78593B'), hex('#A88458'), k), env.amb)));
    gr.addColorStop(0.7, rgba(tint(hex('#5E4329'), env.amb)));
    gr.addColorStop(1, rgba(tint(mix(hex('#4A3421'), hex('#352416'), k), env.amb)));
    ctx.fillStyle = gr;
    ctx.fill(path);

    // overlapping leaf-base "boots": rows of U-shaped scales wrapped on a cylinder
    ctx.save();
    ctx.clip(path);
    const COLS = 8;
    const ROW = 13;
    const dark = rgba(tint(hex('#20150C'), env.amb), 0.62);
    const lite = rgba(tint(hex('#E2C597'), env.amb), 0.18 + 0.3 * k);
    ctx.lineCap = 'round';
    for (let j = 0, h = 6; h < H - 4; j++, h += ROW) {
      const cx = cam.ox + this.trunkX(h, H) * s;
      const r = this.trunkR(h, H);
      const y = cam.oy - h * s;
      for (let c = 0; c < COLS; c++) {
        const th = ((c + (j % 2) * 0.5) / COLS) * TAU + 0.2;
        const cs = Math.cos(th);
        if (cs < 0.12) continue;
        const xc = cx + r * Math.sin(th) * s;
        const hw = r * (Math.PI / COLS) * cs * 1.02 * s;
        const d = ROW * 0.95 * s;
        const u = new Path2D();
        u.moveTo(xc - hw, y - d * 0.15);
        u.quadraticCurveTo(xc - hw * 0.55, y + d * 0.95, xc, y + d * 0.95);
        u.quadraticCurveTo(xc + hw * 0.55, y + d * 0.95, xc + hw, y - d * 0.15);
        ctx.lineWidth = Math.max(0.6, 1.7 * s);
        ctx.strokeStyle = dark;
        ctx.globalAlpha = (0.35 + 0.65 * cs) * smoothstep(20, 120, H);
        ctx.stroke(u);
        // lit lip just inside the scale on the sunny side
        if (Math.sin(th) * side > -0.2) {
          ctx.save();
          ctx.translate(0, -1.6 * s);
          ctx.lineWidth = Math.max(0.5, 1.1 * s);
          ctx.strokeStyle = lite;
          ctx.stroke(u);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
    // ambient occlusion under the crown
    const aoH = Math.min(70, H * 0.45);
    const ao = ctx.createLinearGradient(0, cam.oy - H * s, 0, cam.oy - (H - aoH) * s);
    ao.addColorStop(0, 'rgba(10,6,3,0.7)');
    ao.addColorStop(1, 'rgba(10,6,3,0)');
    ctx.fillStyle = ao;
    ctx.fillRect(cam.ox - 80 * s, cam.oy - H * s, 220 * s, aoH * s);
    ctx.restore();
  }

  drawBoots(ctx, c, cam, g, env) {
    const k = smoothstep(0.2, 0.4, g);
    if (k <= 0) return;
    const s = cam.s;
    const r = rng(11);
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + r.range(-1.25, 1.25);
      const len = r.range(16, 30) * k;
      const w = r.range(5, 9);
      const bx = c.x + r.range(-8, 8) * s;
      const by = c.y + r.range(0, 22) * s;
      const tx = bx + Math.cos(a) * len * s;
      const ty = by + Math.sin(a) * len * s * 0.6 + len * 0.4 * s;
      ctx.beginPath();
      ctx.moveTo(bx - w * s * 0.5, by);
      ctx.lineTo(tx, ty);
      ctx.lineTo(bx + w * s * 0.5, by);
      ctx.closePath();
      ctx.fillStyle = rgba(tint(mix(hex('#3B2A1A'), hex('#7A5B3A'), r()), env.amb));
      ctx.fill();
    }
  }

  drawFruit(ctx, c, cam, g, t, env) {
    const k = smoothstep(0.82, 0.94, g);
    if (k <= 0) return;
    const s = cam.s;
    ctx.globalAlpha = k;
    for (const b of this.bunches) {
      const dir = Math.cos(b.phi);
      const ex = c.x + dir * b.len * 0.55 * s;
      const ey = c.y + b.len * 0.5 * s;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + 6 * s);
      ctx.quadraticCurveTo(c.x + dir * b.len * 0.5 * s, c.y - 6 * s, ex, ey);
      ctx.strokeStyle = rgba(tint(hex('#C79A3E'), env.amb));
      ctx.lineWidth = Math.max(0.8, 2.6 * s);
      ctx.stroke();
      for (const st of b.strands) {
        const sw = Math.sin(t * 1.1 + st.k * 9) * 1.2;
        const sx = ex + st.dx * s;
        const sy = ey + Math.abs(st.dx) * 0.3 * s;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(sx + sw * s, sy + st.len * s);
        ctx.strokeStyle = rgba(tint(hex('#B78F3C'), env.amb), 0.9);
        ctx.lineWidth = Math.max(0.4, 0.8 * s);
        ctx.stroke();
        for (let d = 0; d < st.dates; d++) {
          const u = (d + 1) / (st.dates + 0.5);
          const dx = lerp(ex, sx + sw * s, u) + (d % 2 ? 2.6 : -2.6) * s;
          const dy = lerp(ey, sy + st.len * s, u);
          ctx.beginPath();
          ctx.ellipse(dx, dy, 3.3 * s, 4.9 * s, st.k * 0.4, 0, TAU);
          ctx.fillStyle = rgba(tint(mix(hex('#E0A93A'), hex('#B4502A'), clamp((d / st.dates) * 0.5 + st.k * 0.6 + 0.25)), env.amb));
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
// Root system: fibrous date-palm roots fanning out under the seed.

export function buildRoots(seed = 5) {
  const r = rng(seed);
  const n = noise1(seed);
  const roots = [];
  const grow = (x, y, ang, len, birth, dur, w, depth, main) => {
    const pts = [[x, y]];
    const step = 5;
    let a = ang;
    const steps = Math.round(len / step);
    for (let i = 0; i < steps; i++) {
      a += n(roots.length * 13.7 + i * 0.18) * 0.16;
      a += (Math.PI / 2 - a) * 0.012; // gravitropism: bend toward straight down
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push([x, y]);
    }
    const root = { pts, birth, dur, w, main };
    roots.push(root);
    if (depth < 2) {
      const kids = depth === 0 ? Math.round(r.range(2, 4)) : Math.round(r.range(0, 2));
      for (let k = 0; k < kids; k++) {
        const at = r.range(0.25, 0.85);
        const idx = Math.floor(at * (pts.length - 1));
        const [kx, ky] = pts[idx];
        grow(kx, ky, ang + r.sign() * r.range(0.5, 1.0), len * r.range(0.25, 0.45), birth + dur * at, dur * 0.7, w * 0.55, depth + 1, false);
      }
    }
  };
  // tap root continues the golden thread straight down from the seed
  grow(0, 34, Math.PI / 2, 300, 0, 0.4, 2.2, 1, true);
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    const spread = r.range(0.12, 1.15);
    const ang = Math.PI / 2 + side * spread;
    grow(r.range(-10, 10), r.range(14, 36), ang, r.range(110, 300), lerp(0.05, 0.55, i / 22) + r.range(0, 0.04), r.range(0.2, 0.3), r.range(1.2, 1.7), 0, false);
  }
  return roots;
}

export function drawRoots(ctx, cam, roots, g, t, alpha = 1) {
  const s = cam.s;
  const ws = Math.sqrt(s);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const tips = [];
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalCompositeOperation = pass === 0 ? 'lighter' : 'source-over';
    for (const rt of roots) {
      const f = clamp((g - rt.birth) / rt.dur);
      if (f <= 0) continue;
      const m = f * (rt.pts.length - 1);
      const end = Math.floor(m);
      ctx.beginPath();
      ctx.moveTo(cam.ox + rt.pts[0][0] * s, cam.oy + rt.pts[0][1] * s);
      for (let i = 1; i <= end; i++) ctx.lineTo(cam.ox + rt.pts[i][0] * s, cam.oy + rt.pts[i][1] * s);
      let tx = rt.pts[end][0], ty = rt.pts[end][1];
      if (end < rt.pts.length - 1) {
        const u = m - end;
        tx = lerp(tx, rt.pts[end + 1][0], u);
        ty = lerp(ty, rt.pts[end + 1][1], u);
        ctx.lineTo(cam.ox + tx * s, cam.oy + ty * s);
      }
      if (pass === 0) {
        ctx.strokeStyle = `rgba(214,170,80,${0.13 * alpha})`;
        ctx.lineWidth = rt.w * 5 * ws;
      } else {
        ctx.strokeStyle = rt.main ? `rgba(247,220,140,${0.95 * alpha})` : `rgba(214,172,88,${(rt.w > 1 ? 0.8 : 0.55) * alpha})`;
        ctx.lineWidth = Math.max(0.5, rt.w * 0.85 * ws);
        if (f < 1 && rt.w > 1.1) tips.push([cam.ox + tx * s, cam.oy + ty * s, rt.w]);
      }
      ctx.stroke();
    }
  }
  // glowing growth tips
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, w] of tips) {
    const r = (1.6 + w) * ws;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    gr.addColorStop(0, `rgba(255,236,170,${0.7 * alpha})`);
    gr.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  }
  ctx.restore();
}
