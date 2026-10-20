import { docTop } from '../engine.js';
import { TAU, clamp, lerp, invlerp, smoothstep, keys, fract, hex, mix, rgba, ramp, luma, ease } from '../lib/math.js';
import { rng, noise1 } from '../lib/rand.js';
import { Palm, buildRoots, drawRoots, TRUNK_MAX } from '../lib/palm.js';

const C = hex;
const SKY = {
  night: [C('#04040A'), C('#0E0D1C'), C('#251E34')],
  dawn: [C('#1C1E3C'), C('#5F4563'), C('#E39A69')],
  dusk: [C('#2A2440'), C('#7A4F5E'), C('#E8925E')],
  day: [C('#8FA6AF'), C('#D6C8AC'), C('#EFD9B0')],
  gold: [C('#BBA68A'), C('#E8C391'), C('#F6D09A')],
};
const AMB = {
  night: [0.3, 0.32, 0.46],
  dawn: [0.78, 0.66, 0.66],
  dusk: [0.74, 0.6, 0.6],
  day: [1.02, 0.98, 0.93],
  gold: [1.07, 0.95, 0.8],
};
const mixPal = (a, b, t) => a.map((c, i) => mix(c, b[i], t));
const INK_LIGHT = C('#F7F0E3');
const INK_DARK = C('#23160D');

const CYCLES = 3.42; // ends mid-morning, sun upper-left of the palm
const G_SUN = 0.1; // first sunrise

// Environment (sky, light) as a pure function of growth g.
function environment(g, W, H, horizon) {
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

export function growthScene() {
  const root = document.getElementById('growth');
  const stage = root.querySelector('.growth__stage');
  const canvas = root.querySelector('.growth__canvas');
  const head = root.querySelector('.g-head');
  const headRule = head.querySelector('.eyebrow__rule');
  const [hEyebrow, hTitle, hBody] = [...head.querySelectorAll('[data-sq]')].map((e) => e._sq);
  const ring = root.querySelector('.g-ring');
  const ringSq = ring.querySelector('[data-sq]')._sq;
  const segG = ring.querySelector('.g-ring__segs');
  const rail = root.querySelector('.g-rail');
  const railFill = rail.querySelector('.g-rail__line b');
  const nodes = [...rail.querySelectorAll('.g-rail__node')];
  const nodeSqs = nodes.map((n) => n.querySelector('[data-sq]')._sq);
  const NODE_AT = [0, 0.18, 0.42, 0.84];
  const cards = [
    { el: root.querySelector('#card-height'), h: 0.4 * TRUNK_MAX, side: -1 },
    { el: root.querySelector('#card-sun'), h: 0.84 * TRUNK_MAX, side: 1 },
  ];
  cards.forEach((c) => (c.sqs = [...c.el.querySelectorAll('[data-sq]')].map((e) => e._sq)));

  // years ring: 7 arc segments
  const NS = 'http://www.w3.org/2000/svg';
  const SEG = 7;
  const segs = [];
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * TAU - Math.PI / 2 + 0.06;
    const a1 = ((i + 1) / SEG) * TAU - Math.PI / 2 - 0.06;
    const d = `M${60 + 52 * Math.cos(a0)} ${60 + 52 * Math.sin(a0)} A52 52 0 0 1 ${60 + 52 * Math.cos(a1)} ${60 + 52 * Math.sin(a1)}`;
    const track = document.createElementNS(NS, 'path');
    track.setAttribute('d', d);
    track.setAttribute('stroke', 'currentColor');
    track.setAttribute('opacity', '0.22');
    const fill = document.createElementNS(NS, 'path');
    fill.setAttribute('d', d);
    fill.setAttribute('pathLength', '1');
    fill.setAttribute('stroke', '#E9C77E');
    fill.style.strokeDasharray = '1 2';
    segG.append(track, fill);
    segs.push(fill);
  }

  // sunlight-card gauge + height-card bars
  const gaugeFill = root.querySelector('.g-card__gauge .fill');
  const gaugeDot = root.querySelector('.g-card__gauge .dot');
  const barsSvg = root.querySelector('.g-card__bars');
  const bars = [];
  for (let i = 0; i < 16; i++) {
    const h = 10 + 50 * Math.pow((i + 1) / 16, 1.4);
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', i * 12.5);
    rect.setAttribute('y', 64 - h);
    rect.setAttribute('width', 8);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', 2);
    barsSvg.appendChild(rect);
    bars.push(rect);
  }

  const palm = new Palm(7);
  const roots = buildRoots(5);
  const nz = noise1(21);
  const R = rng(99);

  // horizon set dressing (normalised x)
  const mountains = Array.from({ length: 90 }, (_, i) => {
    const x = i / 89;
    const ridge = 0.45 + 0.3 * nz(i * 0.08) + 0.18 * nz(i * 0.27 + 9) + 0.5 * Math.exp(-(((x - 0.22) / 0.09) ** 2));
    return [x, clamp(ridge, 0.12, 1.1)];
  });
  const grove = Array.from({ length: 46 }, () => ({ x: R(), h: R.range(0.5, 1), lean: R.range(-0.12, 0.12), seed: R() }))
    .filter((p) => Math.abs(p.x - 0.62) > 0.05)
    .sort((a, b) => a.h - b.h);
  const stars = Array.from({ length: 170 }, () => ({ x: R(), y: R() * 0.75, r: R.range(0.4, 1.4), ph: R() * TAU }));

  // soil texture in world space
  const SOIL = [C('#B9905F'), C('#6E4C2F'), C('#513722'), C('#3D2919'), C('#2A1C11')];
  const DEPTH = [0, 24, 88, 176, 272];
  const boundary = (i, x) =>
    i === 0 ? 0 : DEPTH[i] + 7 * Math.sin(x * 0.011 + i * 2.1) + 3.5 * Math.sin(x * 0.033 + i * 4.7) + 1.6 * Math.sin(x * 0.09 + i);
  const layerAt = (x, y) => {
    let l = 0;
    for (let i = 1; i < 5; i++) if (y > boundary(i, x)) l = i;
    return l;
  };
  const specks = Array.from({ length: 3200 }, () => {
    const x = R.range(-1900, 1300);
    const y = R.range(1, 440);
    const l = layerAt(x, y);
    return { x, y, r: R.range(0.5, l === 0 ? 1.3 : 2.1), c: l * 2 + (R() < 0.5 ? 0 : 1) };
  });
  const speckCols = SOIL.flatMap((c) => [mix(c, C('#000000'), 0.32), mix(c, C('#F2DDB4'), 0.22)]);
  const minerals = Array.from({ length: 170 }, () => ({ x: R.range(-1900, 1300), y: R.range(30, 430), r: R.range(0.8, 1.8), ph: R() * TAU }));
  const pebbles = Array.from({ length: 110 }, () => {
    const y = R.range(30, 440);
    return { x: R.range(-1900, 1300), y, rx: R.range(2.5, 9) * (y > 170 ? 1.3 : 0.8), k: R.range(0.55, 0.85), a: R.range(-0.5, 0.5), c: R() };
  });

  let ctx, W, H, dpr, top = 0, range = 1;
  let cardSize = [];

  const cam = { ox: 0, oy: 0, s: 1 };
  function camera(g) {
    const k = H / 1080;
    cam.s = keys(g, [[0, 3.4], [0.14, 2.7], [0.34, 1.62], [0.6, 1.1], [1, 0.9]]) * k;
    cam.oy = keys(g, [[0, 0.56], [0.14, 0.6], [0.34, 0.65], [0.6, 0.8], [1, 0.87]]) * H;
    cam.ox = 0.62 * W;
  }

  function drawSky(env, hor) {
    const [top_, mid, hz] = env.sky;
    const gr = ctx.createLinearGradient(0, 0, 0, hor);
    gr.addColorStop(0, rgba(top_));
    gr.addColorStop(0.55, rgba(mid));
    gr.addColorStop(1, rgba(hz));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, hor + 2);
  }

  function drawStars(a, t) {
    if (a <= 0.01) return;
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      const tw = 0.4 + 0.6 * Math.sin(t * 1.7 + s.ph) ** 2;
      ctx.globalAlpha = a * tw;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r * (W / 1920), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(env, t) {
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

  function drawHorizon(env, hor) {
    const hz = env.sky[2];
    const k = H / 1080;
    const fls = (0.55 + 0.13 * (cam.s / k)) * k;
    // Mount Uhud
    ctx.beginPath();
    ctx.moveTo(-10, hor);
    for (const [x, h] of mountains) ctx.lineTo(lerp(-0.04, 1.04, x) * W, hor - h * 120 * fls);
    ctx.lineTo(W + 10, hor);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(mix(C('#7A4A3B'), hz, 0.58), C('#000000'), 0.05).map((c, i) => c * lerp(1, env.amb[i], 0.5)));
    ctx.fill();
    // distant oasis palms
    const gls = (0.5 + 0.2 * (cam.s / k)) * k;
    const gcol = rgba(mix(C('#2C3624'), hz, 0.48).map((c, i) => c * lerp(1, env.amb[i], 0.6)));
    ctx.strokeStyle = gcol;
    ctx.fillStyle = gcol;
    ctx.lineCap = 'round';
    for (const p of grove) {
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
    const dls = (0.6 + 0.25 * (cam.s / k)) * k;
    for (let L = 0; L < 2; L++) {
      ctx.beginPath();
      ctx.moveTo(-10, hor + 2);
      for (let x = 0; x <= W + 20; x += 20) {
        const u = x / W;
        const h = (14 + 16 * (0.5 + 0.5 * Math.sin(u * (5 + L * 3) + L * 2)) + 8 * nz(u * 9 + L * 5)) * dls * (1 - L * 0.35);
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

  function drawSoil(env, t) {
    const s = cam.s;
    const X = (x) => cam.ox + x * s;
    const Y = (y) => cam.oy + y * s;
    const x0 = (0 - cam.ox) / s - 20;
    const x1 = (W - cam.ox) / s + 20;
    const step = 18 / s;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(X(x0), H + 2);
      for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(X(x), Y(boundary(i, x)));
      ctx.lineTo(X(x1 + step), H + 2);
      ctx.closePath();
      const top_ = Y(DEPTH[i]);
      const gr = ctx.createLinearGradient(0, top_, 0, top_ + (DEPTH[i + 1] ? DEPTH[i + 1] - DEPTH[i] : 160) * s);
      const c = SOIL[i].map((v, j) => v * lerp(1, env.amb[j], i === 0 ? 0.8 : 0.35));
      gr.addColorStop(0, rgba(i === 0 ? mix(c, C('#E7C796'), 0.18) : c));
      gr.addColorStop(1, rgba(mix(c, C('#000000'), 0.18)));
      ctx.fillStyle = gr;
      ctx.fill();
    }
    // grains
    const buckets = speckCols.map(() => new Path2D());
    const yMax = (H - cam.oy) / s + 5;
    for (const p of specks) {
      if (p.x < x0 || p.x > x1 || p.y > yMax) continue;
      const r = Math.max(0.45, p.r * s * 0.8);
      const px = X(p.x), py = Y(p.y);
      buckets[p.c].moveTo(px + r, py);
      buckets[p.c].arc(px, py, r, 0, TAU);
    }
    buckets.forEach((b, i) => {
      ctx.fillStyle = rgba(speckCols[i], 0.75);
      ctx.fill(b);
    });
    // pebbles
    for (const p of pebbles) {
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
    for (const m of minerals) {
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
    d.addColorStop(1, 'rgba(12,7,4,0.5)');
    ctx.fillStyle = d;
    ctx.fillRect(0, cam.oy, W, H - cam.oy);
    const lip = ctx.createLinearGradient(0, cam.oy, 0, cam.oy + 16 * s);
    lip.addColorStop(0, 'rgba(20,12,6,0.4)');
    lip.addColorStop(1, 'rgba(20,12,6,0)');
    ctx.fillStyle = lip;
    ctx.fillRect(0, cam.oy, W, 16 * s);
  }

  function drawGroundTop(env) {
    // the visible top surface of the desert floor (seen slightly from above)
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

  function drawSeed(g) {
    const s = cam.s;
    const x = cam.ox, y = cam.oy + 34 * s;
    const open = smoothstep(0.01, 0.06, g);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x + side * open * 1.6 * s, y);
      ctx.rotate(0.28 + side * open * 0.12);
      ctx.beginPath();
      ctx.ellipse(0, 0, 6.2 * s, 12.5 * s, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 ? Math.PI * 1.5 : Math.PI / 2);
      ctx.closePath();
      const gr = ctx.createLinearGradient(-6 * s, -10 * s, 6 * s, 10 * s);
      gr.addColorStop(0, '#9B7650');
      gr.addColorStop(1, '#4F3520');
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.28);
    ctx.beginPath();
    ctx.moveTo(0, -10 * s);
    ctx.quadraticCurveTo(1.2 * s, 0, 0, 10 * s);
    ctx.strokeStyle = 'rgba(40,24,12,0.7)';
    ctx.lineWidth = Math.max(0.6, 0.9 * s);
    ctx.stroke();
    ctx.restore();
  }

  function strokeThread(path, alpha) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(226,182,96,${0.22 * alpha})`;
    ctx.lineWidth = 7 * (W / 1920);
    ctx.stroke(path);
    ctx.strokeStyle = `rgba(240,207,134,${alpha})`;
    ctx.lineWidth = 1.6 * (W / 1920);
    ctx.stroke(path);
    ctx.restore();
  }

  // returns the screen-space node positions for the data cards
  function drawThread(g, Ht, ly) {
    const s = cam.s;
    const k = W / 1920;
    const seedY = cam.oy + 34 * s;
    // continuation of the page-level thread coming down from the hero
    // (drawn in step with the page thread, whose tip leads at 80% of the viewport)
    const a0 = 1 - smoothstep(0, 0.06, g);
    const tipY = Math.min(seedY, 0.8 * H + ly);
    if (a0 > 0 && tipY > 0) {
      const p = new Path2D();
      p.moveTo(cam.ox, 0);
      p.lineTo(cam.ox, tipY);
      strokeThread(p, a0);
      if (tipY < seedY - 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(cam.ox, tipY, 0, cam.ox, tipY, 14 * k);
        gr.addColorStop(0, 'rgba(255,243,207,1)');
        gr.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(cam.ox - 14 * k, tipY - 14 * k, 28 * k, 28 * k);
        ctx.restore();
      }
    }
    // seed up to the surface
    const a1 = smoothstep(0.015, 0.07, g) * (tipY >= seedY - 1 ? 1 : 0);
    if (a1 > 0) {
      const p = new Path2D();
      p.moveTo(cam.ox, seedY);
      p.lineTo(cam.ox, cam.oy);
      strokeThread(p, a1);
    }
    // measuring rule up the trunk
    const a2 = smoothstep(70, 140, Ht);
    const out = [];
    if (a2 > 0 && Ht > 2) {
      const off = (h) => palm.trunkX(h, Ht) + palm.trunkR(h, Ht) + 14;
      const p = new Path2D();
      p.moveTo(cam.ox, cam.oy);
      p.lineTo(cam.ox + off(0) * s, cam.oy);
      const top_ = Ht * 0.985;
      for (let h = 0; h <= top_; h += 6) p.lineTo(cam.ox + off(h) * s, cam.oy - h * s);
      p.lineTo(cam.ox + off(top_) * s, cam.oy - top_ * s);
      strokeThread(p, a2);
      // ticks
      ctx.strokeStyle = `rgba(240,207,134,${0.7 * a2})`;
      ctx.lineWidth = 1.2 * k;
      for (let h = 40; h < top_; h += 40) {
        const x = cam.ox + off(h) * s;
        const y = cam.oy - h * s;
        const len = (h % 160 === 0 ? 11 : 6) * k;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y);
        ctx.stroke();
      }
      for (const c of cards) {
        const vis = smoothstep(c.h, c.h + 30, Ht) * a2;
        const x = cam.ox + off(c.h) * s;
        const y = cam.oy - c.h * s;
        out.push({ x, y, vis });
        if (vis <= 0) continue;
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 18 * k);
        gr.addColorStop(0, `rgba(255,226,150,${0.8 * vis})`);
        gr.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x - 18 * k, y - 18 * k, 36 * k, 36 * k);
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(x, y, 4 * k, 0, TAU);
        ctx.fillStyle = `rgba(255,243,207,${vis})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 9 * k, 0, TAU);
        ctx.strokeStyle = `rgba(240,207,134,${0.7 * vis})`;
        ctx.lineWidth = 1.2 * k;
        ctx.stroke();
      }
    } else {
      cards.forEach(() => out.push({ x: 0, y: 0, vis: 0 }));
    }
    return out;
  }

  return {
    resize(s) {
      W = s.vw;
      H = s.vh;
      dpr = s.dpr;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx = canvas.getContext('2d');
      top = docTop(root);
      range = root.offsetHeight - H;
      cardSize = cards.map((c) => [c.el.offsetWidth, c.el.offsetHeight]);
    },

    update(s) {
      const ly = s.y - top;
      if (ly < -H || ly > range + H) return;
      const p = clamp(ly / range);
      const g = invlerp(0.02, 0.97, p);
      const t = s.t;

      camera(g);
      const hor = cam.oy - 11 * cam.s;
      const env = environment(g, W, H, hor);
      env.lightSide = clamp((env.sunX - cam.ox) / (0.35 * W), -1, 1) || -1;
      env.light = (() => {
        const v = [env.lightSide * 0.8, 0.3 + env.elev * 0.9, 0.5];
        const l = Math.hypot(...v);
        return v.map((c) => c / l);
      })();
      env.contrast = env.day * smoothstep(0.05, 0.4, env.elev);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(env, hor);
      drawStars((1 - smoothstep(0.03, 0.13, g)) * 0.9, t);
      drawSun(env, t);
      drawHorizon(env, hor);
      drawGroundTop(env);
      drawSoil(env, t);
      drawRoots(ctx, cam, roots, g, t);
      drawSeed(g);
      const Ht = palm.trunkHeight(g);
      palm.draw(ctx, cam, g, t, env);
      const nodesAt = drawThread(g, Ht, ly);

      // --- UI layer ---
      const skyInk = mix(INK_LIGHT, INK_DARK, smoothstep(0.42, 0.62, luma(mix(env.sky[0], env.sky[1], 0.55))));
      root.style.setProperty('--sky-ink', rgba(skyInk));
      root.dataset.ink = rgba(skyInk);

      const rv = invlerp(-0.5 * H, 0.03 * range, ly);
      headRule.style.transform = `scaleX(${ease.out(invlerp(0, 0.4, rv))})`;
      hEyebrow.setProgress(invlerp(0.05, 0.45, rv));
      hTitle.setProgress(ease.inOutSine(invlerp(0.15, 0.85, rv)));
      hBody.setProgress(invlerp(0.4, 1, rv));
      head.style.transform = `translateY(${(1 - ease.out(rv)) * 3}rem)`;

      ring.style.opacity = ease.out(invlerp(0.3, 1, rv));
      ringSq.setProgress(invlerp(0.5, 1, rv));
      const yrs = g * SEG;
      segs.forEach((seg, i) => (seg.style.strokeDashoffset = 1 - clamp(yrs - i)));

      rail.style.opacity = ease.out(invlerp(0.4, 1, rv));
      railFill.style.width = `${g * 100}%`;
      nodes.forEach((n, i) => {
        n.classList.toggle('is-on', g >= NODE_AT[i] && rv > 0.6);
        nodeSqs[i].setProgress(i === 0 ? invlerp(0.6, 1, rv) : invlerp(NODE_AT[i], NODE_AT[i] + 0.05, g));
      });

      const rem = W / 120;
      cards.forEach((c, i) => {
        const n = nodesAt[i];
        const [cw, ch] = cardSize[i];
        const lead = 4.5 * rem;
        const x = c.side < 0 ? n.x - lead - cw : n.x + lead;
        const y = n.y - ch / 2;
        c.el.style.setProperty('--lead', lead + 'px');
        c.el.style.opacity = ease.out(n.vis);
        c.el.style.transform = `translate(${x + (1 - n.vis) * c.side * 1.5 * rem}px, ${y}px)`;
        c.sqs.forEach((q) => q.setProgress(invlerp(0.3, 1, n.vis)));
      });
      const barsOn = Math.round(invlerp(0.3, 1, g) * bars.length);
      bars.forEach((b, i) => b.classList.toggle('on', i < barsOn));
      gaugeFill.style.strokeDashoffset = 1 - env.f;
      const ga = Math.PI * (1 - env.f);
      gaugeDot.setAttribute('cx', 100 + 82 * Math.cos(ga));
      gaugeDot.setAttribute('cy', 76 - 82 * Math.sin(ga));
    },

    // which ink the fixed nav should use while this stage sits under it
    navInk(s) {
      const ly = s.y - top;
      return ly > -0.04 * H && ly < range + 0.02 * H ? root.dataset.ink : null;
    },
  };
}
