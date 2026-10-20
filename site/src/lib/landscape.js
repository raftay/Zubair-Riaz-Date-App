// The palm's world, shared by the growth and water scenes: time-lapse sky,
// sun / moon / stars, Mount Uhud and the oasis on the horizon, and the soil
// cross-section. Drawing takes a view { ctx, W, H, cam } where cam maps world
// units (x right, y down, ground at 0) to the screen: X = ox + x·s, Y = oy + y·s.
import { TAU, clamp, lerp, smoothstep, fract, hex, mix, rgba } from './math.js';
import { rng, noise1 } from './rand.js';

const C = hex;
export const SKY = {
  night: [C('#04040A'), C('#0E0D1C'), C('#251E34')],
  dawn: [C('#1C1E3C'), C('#5F4563'), C('#E39A69')],
  dusk: [C('#2A2440'), C('#7A4F5E'), C('#E8925E')],
  day: [C('#8FA6AF'), C('#D6C8AC'), C('#EFD9B0')],
  gold: [C('#BBA68A'), C('#E8C391'), C('#F6D09A')],
};
export const AMB = {
  night: [0.3, 0.32, 0.46],
  dawn: [0.78, 0.66, 0.66],
  dusk: [0.74, 0.6, 0.6],
  day: [1.02, 0.98, 0.93],
  gold: [1.07, 0.95, 0.8],
};
const mixPal = (a, b, t) => a.map((c, i) => mix(c, b[i], t));

const CYCLES = 3.42; // sunrises over the growth time-lapse; ends mid-morning
const G_SUN = 0.1; // first sunrise

// Sky and light as a pure function of growth g (0 = pre-dawn, 1 = golden day).
export function environment(g, W, H, horizon) {
  let sky, amb;
  if (g < G_SUN) {
    const k = smoothstep(0, G_SUN, g);
    sky = mixPal(SKY.night, SKY.dawn, k);
    amb = mix(AMB.night, AMB.dawn, k);
  } else if (g < 0.3) {
    const k = smoothstep(G_SUN, 0.3, g);
    sky = mixPal(SKY.dawn, SKY.day, k);
    amb = mix(AMB.dawn, AMB.day, k);
  } else {
    const k = smoothstep(0.3, 1, g);
    sky = mixPal(SKY.day, SKY.gold, k);
    amb = mix(AMB.day, AMB.gold, k);
  }
  let day = 0, f = 0, elev = 0, sunX = -W, sunY = horizon + H;
  if (g >= G_SUN) {
    f = fract(((g - G_SUN) / (1 - G_SUN)) * CYCLES);
    day = smoothstep(0, 0.09, f) * smoothstep(1, 0.91, f);
    const dip = (1 - day) * 0.85 * smoothstep(G_SUN, 0.2, g);
    sky = mixPal(sky, SKY.dusk, dip);
    amb = mix(amb, AMB.dusk, dip);
    elev = Math.sin(f * Math.PI);
    sunX = lerp(-0.08, 1.08, f) * W;
    sunY = horizon - (elev - 0.07) * (horizon - 0.2 * H);
  }
  return { sky, amb, day, f, elev, sunX, sunY };
}

// Fill in the lighting a palm needs from an environment and the palm's screen x.
export function lightPalm(env, ox, W) {
  env.lightSide = clamp((env.sunX - ox) / (0.35 * W), -1, 1) || -1;
  const v = [env.lightSide * 0.8, 0.3 + env.elev * 0.9, 0.5];
  const l = Math.hypot(...v);
  env.light = v.map((c) => c / l);
  env.contrast = env.day * smoothstep(0.05, 0.4, env.elev);
  return env;
}

// Soil strata (world units below ground).
const SOIL = [C('#B9905F'), C('#6E4C2F'), C('#513722'), C('#3D2919'), C('#2A1C11')];
const DEPTH = [0, 24, 88, 176, 272];
export const soilBoundary = (i, x) =>
  i === 0 ? 0 : DEPTH[i] + 7 * Math.sin(x * 0.011 + i * 2.1) + 3.5 * Math.sin(x * 0.033 + i * 4.7) + 1.6 * Math.sin(x * 0.09 + i);

export function strokeThread(ctx, W, path, alpha, core = [240, 207, 134], glow = [226, 182, 96]) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(glow, 0.22 * alpha);
  ctx.lineWidth = 7 * (W / 1920);
  ctx.stroke(path);
  ctx.strokeStyle = rgba(core, alpha);
  ctx.lineWidth = 1.6 * (W / 1920);
  ctx.stroke(path);
  ctx.restore();
}

export class Landscape {
  constructor() {
    const nz = noise1(21);
    const R = rng(99);
    this.nz = nz;
    // horizon set dressing (normalised x)
    this.mountains = Array.from({ length: 90 }, (_, i) => {
      const x = i / 89;
      const ridge = 0.45 + 0.3 * nz(i * 0.08) + 0.18 * nz(i * 0.27 + 9) + 0.5 * Math.exp(-(((x - 0.22) / 0.09) ** 2));
      return [x, clamp(ridge, 0.12, 1.1)];
    });
    this.grove = Array.from({ length: 46 }, () => ({ x: R(), h: R.range(0.5, 1), lean: R.range(-0.12, 0.12), seed: R() }))
      .filter((p) => Math.abs(p.x - 0.62) > 0.05)
      .sort((a, b) => a.h - b.h);
    this.stars = Array.from({ length: 170 }, () => ({ x: R(), y: R() * 0.75, r: R.range(0.4, 1.4), ph: R() * TAU }));
    // soil texture in world space
    const layerAt = (x, y) => {
      let l = 0;
      for (let i = 1; i < 5; i++) if (y > soilBoundary(i, x)) l = i;
      return l;
    };
    this.specks = Array.from({ length: 3200 }, () => {
      const x = R.range(-1900, 1300);
      const y = R.range(1, 440);
      const l = layerAt(x, y);
      return { x, y, r: R.range(0.5, l === 0 ? 1.3 : 2.1), c: l * 2 + (R() < 0.5 ? 0 : 1) };
    });
    this.speckCols = SOIL.flatMap((c) => [mix(c, C('#000000'), 0.32), mix(c, C('#F2DDB4'), 0.22)]);
    this.minerals = Array.from({ length: 170 }, () => ({ x: R.range(-1900, 1300), y: R.range(30, 430), r: R.range(0.8, 1.8), ph: R() * TAU }));
    this.pebbles = Array.from({ length: 110 }, () => {
      const y = R.range(30, 440);
      return { x: R.range(-1900, 1300), y, rx: R.range(2.5, 9) * (y > 170 ? 1.3 : 0.8), k: R.range(0.55, 0.85), a: R.range(-0.5, 0.5), c: R() };
    });
  }

  sky({ ctx, W }, env, hor) {
    const [top, mid, hz] = env.sky;
    const gr = ctx.createLinearGradient(0, 0, 0, hor);
    gr.addColorStop(0, rgba(top));
    gr.addColorStop(0.55, rgba(mid));
    gr.addColorStop(1, rgba(hz));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, hor + 2);
  }

  starfield({ ctx, W, H }, a, t) {
    if (a <= 0.01) return;
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      const tw = 0.4 + 0.6 * Math.sin(t * 1.7 + s.ph) ** 2;
      ctx.globalAlpha = a * tw;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r * (W / 1920), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  moon({ ctx, W, H }, a) {
    if (a <= 0.01) return;
    const x = 0.8 * W, y = 0.19 * H, r = 0.024 * H;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    halo.addColorStop(0, `rgba(255,236,200,${0.16 * a})`);
    halo.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    ctx.restore();
    // crescent: the lit disc, clipped, minus an offset disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(x - r, y - r, r * 2, r * 2);
    ctx.arc(x + r * 0.45, y - r * 0.18, r * 0.92, 0, TAU);
    ctx.fillStyle = `rgba(255,240,212,${0.92 * a})`;
    ctx.fill('evenodd');
    ctx.restore();
  }

  sun({ ctx, W, H }, env, t) {
    if (env.elev <= 0) return;
    const vis = smoothstep(0.0, 0.18, env.elev);
    const warm = 1 - smoothstep(0.1, 0.7, env.elev);
    const core = mix(C('#FFF4DC'), C('#FFC07A'), warm);
    const R0 = 0.034 * H;
    ctx.globalCompositeOperation = 'lighter';
    const bloom = ctx.createRadialGradient(env.sunX, env.sunY, 0, env.sunX, env.sunY, H * 0.55);
    bloom.addColorStop(0, rgba(mix(C('#FFE2A8'), C('#FF9A50'), warm), 0.42 * vis));
    bloom.addColorStop(0.35, rgba(C('#FFB070'), 0.1 * vis));
    bloom.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(env.sunX - H * 0.55, env.sunY - H * 0.55, H * 1.1, H * 1.1);
    // soft rays
    ctx.save();
    ctx.translate(env.sunX, env.sunY);
    ctx.rotate(t * 0.03);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.rotate(TAU / 14);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 0.9, -W * 0.02 * (1 + (i % 3)));
      ctx.lineTo(W * 0.9, W * 0.02 * (1 + (i % 3)));
      ctx.closePath();
      ctx.fillStyle = `rgba(255,214,150,${0.022 * vis * (0.6 + 0.4 * Math.sin(a * 3 + t * 0.4))})`;
      ctx.fill();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    const disc = ctx.createRadialGradient(env.sunX, env.sunY, 0, env.sunX, env.sunY, R0);
    disc.addColorStop(0, rgba(core, vis));
    disc.addColorStop(0.75, rgba(core, vis));
    disc.addColorStop(1, rgba(core, 0));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(env.sunX, env.sunY, R0, 0, TAU);
    ctx.fill();
  }

  horizon({ ctx, W, H, cam }, env, hor) {
    const hz = env.sky[2];
    const k = H / 1080;
    // distant layers scale far less than the foreground as the camera zooms
    const zoom = Math.min(cam.s / k, 3.6);
    const fls = (0.55 + 0.13 * zoom) * k;
    // Mount Uhud
    ctx.beginPath();
    ctx.moveTo(-10, hor);
    for (const [x, h] of this.mountains) ctx.lineTo(lerp(-0.04, 1.04, x) * W, hor - h * 120 * fls);
    ctx.lineTo(W + 10, hor);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(mix(C('#7A4A3B'), hz, 0.58), C('#000000'), 0.05).map((c, i) => c * lerp(1, env.amb[i], 0.5)));
    ctx.fill();
    // distant oasis palms
    const gls = (0.5 + 0.2 * zoom) * k;
    const gcol = rgba(mix(C('#2C3624'), hz, 0.48).map((c, i) => c * lerp(1, env.amb[i], 0.6)));
    ctx.strokeStyle = gcol;
    ctx.fillStyle = gcol;
    ctx.lineCap = 'round';
    for (const p of this.grove) {
      const bx = p.x * W;
      const h = (34 + 52 * p.h) * gls;
      const tx = bx + p.lean * h;
      const ty = hor - h;
      ctx.lineWidth = Math.max(1, 2.4 * gls);
      ctx.beginPath();
      ctx.moveTo(bx, hor);
      ctx.quadraticCurveTo(bx + p.lean * h * 0.3, hor - h * 0.5, tx, ty);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.8, 1.8 * gls);
      for (let j = 0; j < 9; j++) {
        const a = -Math.PI / 2 + (j - 4) * 0.38 + p.seed * 0.2;
        const len = (16 + 6 * Math.cos(j)) * gls;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.7, ty + Math.sin(a) * len * 0.7 - 3 * gls, tx + Math.cos(a) * len, ty + Math.sin(a) * len + len * 0.45);
        ctx.stroke();
      }
    }
    // dunes
    const dls = (0.6 + 0.25 * zoom) * k;
    for (let L = 0; L < 2; L++) {
      ctx.beginPath();
      ctx.moveTo(-10, hor + 2);
      for (let x = 0; x <= W + 20; x += 20) {
        const u = x / W;
        const h = (14 + 16 * (0.5 + 0.5 * Math.sin(u * (5 + L * 3) + L * 2)) + 8 * this.nz(u * 9 + L * 5)) * dls * (1 - L * 0.35);
        ctx.lineTo(x, hor - h);
      }
      ctx.lineTo(W + 20, hor + 2);
      ctx.closePath();
      ctx.fillStyle = rgba(mix(mix(C('#C79A63'), hz, 0.42 - L * 0.12), C('#000000'), 0.04).map((c, i) => c * env.amb[i]));
      ctx.fill();
    }
    // haze
    const haze = ctx.createLinearGradient(0, hor - 0.2 * H, 0, hor);
    haze.addColorStop(0, rgba(hz, 0));
    haze.addColorStop(1, rgba(hz, 0.5));
    ctx.fillStyle = haze;
    ctx.fillRect(0, hor - 0.2 * H, W, 0.2 * H);
  }

  // the visible top surface of the desert floor (seen slightly from above)
  groundTop({ ctx, W, cam }, env) {
    const s = cam.s;
    const h = 11 * s;
    const gr = ctx.createLinearGradient(0, cam.oy - h, 0, cam.oy);
    const lit = mix(C('#DDB781'), env.sky[2], 0.25).map((c, i) => c * env.amb[i]);
    gr.addColorStop(0, rgba(mix(lit, env.sky[2], 0.35)));
    gr.addColorStop(1, rgba(mix(lit, C('#8E6A44'), 0.25)));
    ctx.fillStyle = gr;
    ctx.fillRect(0, cam.oy - h, W, h + 1);
    ctx.fillStyle = 'rgba(40,24,12,0.35)';
    ctx.fillRect(0, cam.oy - 0.5, W, Math.max(1, 1.2 * s));
  }

  soil({ ctx, W, H, cam }, env, t) {
    if (cam.oy > H) return;
    const s = cam.s;
    const X = (x) => cam.ox + x * s;
    const Y = (y) => cam.oy + y * s;
    const x0 = (0 - cam.ox) / s - 20;
    const x1 = (W - cam.ox) / s + 20;
    const step = 18 / s;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(X(x0), H + 2);
      for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(X(x), Y(soilBoundary(i, x)));
      ctx.lineTo(X(x1 + step), H + 2);
      ctx.closePath();
      const top = Y(DEPTH[i]);
      const gr = ctx.createLinearGradient(0, top, 0, top + (DEPTH[i + 1] ? DEPTH[i + 1] - DEPTH[i] : 160) * s);
      const c = SOIL[i].map((v, j) => v * lerp(1, env.amb[j], i === 0 ? 0.55 : 0.18));
      gr.addColorStop(0, rgba(i === 0 ? mix(c, C('#E7C796'), 0.18) : c));
      gr.addColorStop(1, rgba(mix(c, C('#000000'), 0.18)));
      ctx.fillStyle = gr;
      ctx.fill();
    }
    // grains
    const buckets = this.speckCols.map(() => new Path2D());
    const yMax = (H - cam.oy) / s + 5;
    for (const p of this.specks) {
      if (p.x < x0 || p.x > x1 || p.y > yMax) continue;
      const r = Math.max(0.45, p.r * s * 0.8);
      const px = X(p.x), py = Y(p.y);
      buckets[p.c].moveTo(px + r, py);
      buckets[p.c].arc(px, py, r, 0, TAU);
    }
    buckets.forEach((b, i) => {
      ctx.fillStyle = rgba(this.speckCols[i], 0.75);
      ctx.fill(b);
    });
    // pebbles
    for (const p of this.pebbles) {
      if (p.x < x0 || p.x > x1 || p.y > yMax) continue;
      const px = X(p.x), py = Y(p.y);
      const rx = p.rx * s, ry = rx * p.k;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, p.a, 0, TAU);
      ctx.fillStyle = rgba(mix(C('#4A3A2E'), C('#7D6A58'), p.c));
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px - rx * 0.25, py - ry * 0.3, rx * 0.5, ry * 0.35, p.a, 0, TAU);
      ctx.fillStyle = 'rgba(230,210,180,0.16)';
      ctx.fill();
    }
    // tracked minerals glint
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.minerals) {
      if (m.x < x0 || m.x > x1 || m.y > yMax) continue;
      const a = 0.25 + 0.75 * Math.sin(t * 1.4 + m.ph) ** 4;
      const px = X(m.x), py = Y(m.y);
      const r = Math.max(1, m.r * Math.sqrt(s) * 1.1);
      const gr = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
      gr.addColorStop(0, `rgba(255,226,150,${0.8 * a})`);
      gr.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(px - r * 3, py - r * 3, r * 6, r * 6);
    }
    ctx.globalCompositeOperation = 'source-over';
    // depth falloff + cut-face shadow
    const d = ctx.createLinearGradient(0, cam.oy, 0, H);
    d.addColorStop(0, 'rgba(12,7,4,0)');
    d.addColorStop(1, 'rgba(12,7,4,0.36)');
    ctx.fillStyle = d;
    ctx.fillRect(0, cam.oy, W, H - cam.oy);
    const lip = ctx.createLinearGradient(0, cam.oy, 0, cam.oy + 16 * s);
    lip.addColorStop(0, 'rgba(20,12,6,0.4)');
    lip.addColorStop(1, 'rgba(20,12,6,0)');
    ctx.fillStyle = lip;
    ctx.fillRect(0, cam.oy, W, 16 * s);
  }
}
