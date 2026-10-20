import { docTop } from '../engine.js';
import { TAU, clamp, lerp, invlerp, smoothstep, keys, fract, hex, mix, rgba, luma, ease } from '../lib/math.js';
import { rng, noise1 } from '../lib/rand.js';
import { Palm, buildRoots, drawRoots, TRUNK_MAX } from '../lib/palm.js';
import { LEAD } from './thread.js';

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
// The pinned range is split: planting (scene 03) first, then growth (scene 04).
const P1 = 0.325;
const G0 = P1 + 0.01; // brief hold between the two
const G1 = 0.975;
const PROBE_DEPTH = [6, 16, 26]; // soil probes above each card (world units)
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

  // planting (03) UI
  const sHead = root.querySelector('.s-head');
  const sRule = sHead.querySelector('.eyebrow__rule');
  const sHeadSqs = [...sHead.querySelectorAll('[data-sq]')].map((e) => e._sq);
  const sCards = ['#card-moist', '#card-ph', '#card-min'].map((id) => {
    const el = root.querySelector(id);
    return { el, sqs: [...el.querySelectorAll('[data-sq]')].map((e) => e._sq), node: [0, 0] };
  });
  const meter = root.querySelector('.s-card__meter');
  const cells = [];
  for (let i = 0; i < 12; i++) {
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', i * 16.8);
    rect.setAttribute('y', 2);
    rect.setAttribute('width', 12.5);
    rect.setAttribute('height', 22);
    rect.setAttribute('rx', 3);
    meter.appendChild(rect);
    cells.push(rect);
  }
  const phArc = root.querySelector('.s-card__gauge .arc');
  const phNeedle = root.querySelector('.s-card__gauge .needle');
  const donutG = root.querySelector('.s-card__donut .donut');
  const donut = [0.34, 0.27, 0.22, 0.17].map((share, i, all) => {
    const a0 = all.slice(0, i).reduce((x, y) => x + y, 0);
    const p0 = a0 * TAU - Math.PI / 2 + 0.05, p1 = (a0 + share) * TAU - Math.PI / 2 - 0.05;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${50 + 36 * Math.cos(p0)} ${50 + 36 * Math.sin(p0)} A36 36 0 ${share > 0.5 ? 1 : 0} 1 ${50 + 36 * Math.cos(p1)} ${50 + 36 * Math.sin(p1)}`);
    path.setAttribute('pathLength', '1');
    path.setAttribute('stroke', ['#e3b44e', '#b97a3c', '#8fa66a', '#d9cbb0'][i]);
    path.style.strokeDasharray = '1 2';
    donutG.appendChild(path);
    return path;
  });
  // loose soil that tumbles into the hole above the buried seed
  const G = rng(77);
  const grains = Array.from({ length: 46 }, () => {
    const side = G.sign();
    return {
      sx: side * G.range(6, 34), sy: G.range(-3, 0),
      ex: side * G.range(0, 9), ey: G.range(2, 30),
      ts: G.range(0.4, 0.55), r: G.range(1.1, 2.4),
      c: C(G.pick(['#9c7a52', '#87653f', '#715332', '#a8875e'])),
    };
  });

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
  // 03: tracks the falling seed from the night sky down to the soil, then
  // zooms into the cross-section; ends exactly where camera(g = 0) begins.
  function plantCamera(q) {
    const k = H / 1080;
    cam.s = keys(q, [[0, 1.15], [0.3, 1.5], [0.68, 3.4]]) * k;
    cam.oy = keys(q, [[0, 1.42], [0.3, 0.74], [0.68, 0.56]]) * H;
    cam.ox = 0.62 * W;
  }
  // the falling seed's world position (y down) and tilt during planting
  function seedPose(q, ly) {
    const k = H / 1080;
    const u = invlerp(0, 0.3, q);
    const landY = 0.74 * H - 12.5 * 1.5 * k;
    if (q < 0.3) {
      const sy = ly < 0 ? LEAD * H + ly : lerp(LEAD * H, landY, ease.inOut(u));
      return { y: (sy - cam.oy) / cam.s, rot: 0.5 * Math.sin(u * Math.PI * 3) * (1 - u), sy };
    }
    const b = invlerp(0.3, 0.36, q);
    const dig = ease.inOut(invlerp(0.36, 0.5, q));
    const y = q < 0.36 ? -12.5 - 4 * Math.sin(Math.PI * b) : lerp(-12.5, 34, dig);
    return { y, rot: 0.28 * dig, sy: cam.oy + y * cam.s };
  }
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

  function drawMoon(a) {
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
      const c = SOIL[i].map((v, j) => v * lerp(1, env.amb[j], i === 0 ? 0.55 : 0.18));
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
    d.addColorStop(1, 'rgba(12,7,4,0.36)');
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

  function drawSeed(g, wy = 34, rot = 0.28) {
    const s = cam.s;
    const x = cam.ox, y = cam.oy + wy * s;
    const open = smoothstep(0.01, 0.06, g);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x + side * open * 1.6 * s, y);
      ctx.rotate(rot + side * open * 0.12);
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
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -10 * s);
    ctx.quadraticCurveTo(1.2 * s, 0, 0, 10 * s);
    ctx.strokeStyle = 'rgba(40,24,12,0.7)';
    ctx.lineWidth = Math.max(0.6, 0.9 * s);
    ctx.stroke();
    ctx.restore();
  }

  function drawBurrow(q, seedWy, amb) {
    const s = cam.s;
    const a = smoothstep(0.36, 0.4, q) * (1 - smoothstep(0.52, 0.62, q));
    if (a > 0) {
      const bottom = Math.max(0, seedWy - 10);
      ctx.beginPath();
      ctx.moveTo(cam.ox - 15 * s, cam.oy);
      ctx.quadraticCurveTo(cam.ox - 9 * s, cam.oy + bottom * 0.4 * s, cam.ox - 6 * s, cam.oy + bottom * s);
      ctx.lineTo(cam.ox + 6 * s, cam.oy + bottom * s);
      ctx.quadraticCurveTo(cam.ox + 9 * s, cam.oy + bottom * 0.4 * s, cam.ox + 15 * s, cam.oy);
      ctx.closePath();
      ctx.fillStyle = `rgba(34,20,10,${0.7 * a})`;
      ctx.fill();
    }
    const ga = smoothstep(0.37, 0.41, q) * (1 - smoothstep(0.58, 0.64, q));
    if (ga <= 0) return;
    for (const gr of grains) {
      const u = clamp((q - gr.ts) / 0.04);
      const x = lerp(gr.sx, gr.ex, u);
      const y = lerp(gr.sy, gr.ey, u * u);
      ctx.beginPath();
      ctx.arc(cam.ox + x * s, cam.oy + y * s, gr.r * s * 0.6, 0, TAU);
      ctx.fillStyle = rgba(gr.c.map((v, j) => v * lerp(1, amb[j], 0.5)));
      ctx.globalAlpha = ga;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPulse(q, x, y) {
    const k = W / 1920;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const v = invlerp(0.54 + i * 0.05, 0.74 + i * 0.05, q);
      if (v <= 0 || v >= 1) continue;
      ctx.beginPath();
      ctx.arc(x, y, (20 + ease.out(v) * 300) * k, 0, TAU);
      ctx.strokeStyle = `rgba(240,200,120,${0.55 * (1 - v)})`;
      ctx.lineWidth = 1.6 * k;
      ctx.stroke();
    }
    const gl = smoothstep(0.5, 0.56, q) * (1 - smoothstep(0.6, 0.8, q));
    if (gl > 0) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 70 * k);
      g.addColorStop(0, `rgba(255,214,140,${0.45 * gl})`);
      g.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 70 * k, y - 70 * k, 140 * k, 140 * k);
    }
    ctx.restore();
  }

  // glowing sample points in the soil, one under each data card
  function drawProbes(vis, t) {
    const k = W / 1920;
    sCards.forEach((c, i) => {
      const v = vis[i];
      if (v <= 0) return;
      const [x, y] = c.node;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, 22 * k);
      g.addColorStop(0, `rgba(255,226,150,${0.75 * v})`);
      g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 22 * k, y - 22 * k, 44 * k, 44 * k);
      const ping = (t * 0.6 + i * 0.33) % 1;
      ctx.beginPath();
      ctx.arc(x, y, (8 + ping * 26) * k, 0, TAU);
      ctx.strokeStyle = `rgba(240,207,134,${0.6 * v * (1 - ping)})`;
      ctx.lineWidth = 1.2 * k;
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y, 4 * k, 0, TAU);
      ctx.fillStyle = `rgba(255,243,207,${v})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 9 * k, 0, TAU);
      ctx.strokeStyle = `rgba(240,207,134,${0.75 * v})`;
      ctx.lineWidth = 1.2 * k;
      ctx.stroke();
    });
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
  function drawThread(g, Ht, seedY) {
    const s = cam.s;
    const k = W / 1920;
    // continuation of the page-level thread, ending at the seed it carried down
    const a0 = 1 - smoothstep(0, 0.06, g);
    if (a0 > 0 && seedY > 0) {
      const p = new Path2D();
      p.moveTo(cam.ox, 0);
      p.lineTo(cam.ox, seedY);
      strokeThread(p, a0);
    }
    // seed up to the surface
    const a1 = smoothstep(0.015, 0.07, g);
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
      // soil cards sit in a row; each probe hangs above its card, at a fixed depth
      const rem = W / 120;
      const sF = 3.4 * (H / 1080);
      sCards.forEach((c, i) => {
        c.size = [c.el.offsetWidth, c.el.offsetHeight];
        c.left = 9.5 * rem + i * (c.size[0] + 1.6 * rem);
        c.top = 0.7 * H;
        c.world = [(c.left + c.size[0] / 2 - 0.62 * W) / sF, PROBE_DEPTH[i]];
      });
    },

    // choreography positions: { q } planting 0..1, { g } growth 0..1
    locate(k) {
      if (k.q !== undefined) return top + k.q * P1 * range;
      if (k.g !== undefined) return top + (G0 + k.g * (G1 - G0)) * range;
      return top + (k.offset ?? 0) * H;
    },
    chapter(s) {
      return (s.y - top) / range < G0 ? 2 : 3;
    },

    update(s) {
      const ly = s.y - top;
      if (ly < -H || ly > range + H) return;
      const p = clamp(ly / range);
      const planting = p < G0;
      const q = invlerp(0, P1, p);
      const g = invlerp(G0, G1, p);
      const L = planting ? q - 1 : g; // one clock across both scenes: -1..0 planting, 0..1 growth
      const t = s.t;

      if (planting) plantCamera(q);
      else camera(g);
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
      drawMoon(1 - smoothstep(0.02, 0.1, g));
      drawSun(env, t);
      drawHorizon(env, hor);
      drawGroundTop(env);
      drawSoil(env, t);
      // roots: the taproot starts in the last moments of planting
      drawRoots(ctx, cam, roots, planting ? -0.1 + 0.1 * invlerp(-0.2, 0, L) : g, t);
      const pose = planting ? seedPose(q, ly) : { y: 34, rot: 0.28, sy: cam.oy + 34 * cam.s };
      if (planting) drawBurrow(q, pose.y, env.amb);
      if (pose.sy > -20) drawSeed(planting ? 0 : g, pose.y, pose.rot);
      if (planting) drawPulse(q, cam.ox, pose.sy);
      const Ht = palm.trunkHeight(g);
      if (!planting) palm.draw(ctx, cam, g, t, env);
      const nodesAt = drawThread(g, Ht, pose.sy);
      const cardVis = sCards.map((c, i) => ease.out(invlerp(0.66 + i * 0.05, 0.78 + i * 0.05, q)) * (1 - smoothstep(0, 0.045, Math.max(0, L))));
      sCards.forEach((c) => (c.node = [cam.ox + c.world[0] * cam.s, cam.oy + c.world[1] * cam.s]));
      drawProbes(cardVis, t);

      // --- UI layer ---
      const skyInk = mix(INK_LIGHT, INK_DARK, smoothstep(0.42, 0.62, luma(mix(env.sky[0], env.sky[1], 0.55))));
      root.style.setProperty('--sky-ink', rgba(skyInk));
      root.dataset.ink = rgba(skyInk);

      // 03 header + soil cards
      const sv = Math.min(invlerp(-0.78, -0.6, L), 1 - invlerp(0, 0.035, L));
      sHead.style.opacity = sv > 0 ? 1 : 0;
      sRule.style.transform = `scaleX(${ease.out(invlerp(0, 0.4, sv))})`;
      sHeadSqs.forEach((sq, i) => sq.setProgress(invlerp(i * 0.25, 0.5 + i * 0.25, sv)));
      sCards.forEach((c, i) => {
        const v = cardVis[i];
        const leadPx = c.top - c.node[1];
        c.el.style.opacity = v;
        c.el.style.setProperty('--lead', `${Math.max(0, leadPx)}px`);
        c.el.style.transform = `translate(${c.left}px, ${c.top + (1 - v) * 1.5 * (W / 120)}px)`;
        c.el.querySelector('.s-card__lead').style.transform = `scaleY(${ease.out(invlerp(0.2, 0.8, v))})`;
        c.sqs.forEach((sq) => sq.setProgress(invlerp(0.3, 1, v)));
      });
      const lit = Math.round(invlerp(0.2, 1, cardVis[0]) * 8);
      cells.forEach((cell, i) => cell.classList.toggle('on', i < lit));
      phArc.style.strokeDashoffset = 1 - ease.out(invlerp(0.1, 0.7, cardVis[1]));
      phNeedle.style.transform = `rotate(${lerp(-78, 14, ease.out(invlerp(0.3, 1, cardVis[1])))}deg)`;
      donut.forEach((d, i) => (d.style.strokeDashoffset = 1 - ease.out(invlerp(0.2 + i * 0.12, 0.6 + i * 0.12, cardVis[2]))));

      // 04 growth UI takes over as the sprout breaks the surface
      const rv = invlerp(0.02, 0.1, L);
      head.style.opacity = rv > 0 ? 1 : 0;
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
