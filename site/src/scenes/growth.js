import { docTop } from '../engine.js';
import { TAU, clamp, lerp, invlerp, smoothstep, keys, hex, mix, rgba, luma, ease } from '../lib/math.js';
import { rng } from '../lib/rand.js';
import { Landscape, environment, lightPalm, strokeThread } from '../lib/landscape.js';
import { Palm, buildRoots, drawRoots, TRUNK_MAX } from '../lib/palm.js';
import { LEAD } from './thread.js';

const C = hex;
const INK_LIGHT = C('#F7F0E3');
const INK_DARK = C('#23160D');

// The pinned range is split: planting (scene 03) first, then growth (scene 04).
const P1 = 0.325;
const G0 = P1 + 0.01; // brief hold between the two
const G1 = 0.975;
const PROBE_DEPTH = [6, 16, 26]; // soil probes above each card (world units)

export function growthScene() {
  const root = document.getElementById('growth');
  const canvas = root.querySelector('.growth__canvas');
  const head = root.querySelector('.g-head');
  const headRule = head.querySelector('.eyebrow__rule');
  const [hEyebrow, hTitle, hBody] = [...head.querySelectorAll('[data-sq]')].map((e) => e._sq);
  const rail = root.querySelector('.g-rail');
  const railFill = rail.querySelector('.g-rail__line b');
  const nodes = [...rail.querySelectorAll('.g-rail__node')];
  const nodeSqs = nodes.map((n) => n.querySelector('[data-sq]')._sq);
  const NODE_AT = [0, 0.18, 0.42, 0.84];
  // one data card, pinned to the measuring rule; it lands as the palm reaches maturity
  const cards = [{ el: root.querySelector('#card-height'), h: 0.4 * TRUNK_MAX, side: -1 }];
  cards.forEach((c) => (c.sqs = [...c.el.querySelectorAll('[data-sq]')].map((e) => e._sq)));

  // height-card bars
  const NS = 'http://www.w3.org/2000/svg';
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
  const land = new Landscape();
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
      strokeThread(ctx, W, p, a0);
    }
    // seed up to the surface
    const a1 = smoothstep(0.015, 0.07, g);
    if (a1 > 0) {
      const p = new Path2D();
      p.moveTo(cam.ox, seedY);
      p.lineTo(cam.ox, cam.oy);
      strokeThread(ctx, W, p, a1);
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
      strokeThread(ctx, W, p, a2);
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
        const vis = smoothstep(c.h, c.h + 30, Ht) * smoothstep(0.8, 0.9, g) * a2;
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
      range = root.offsetHeight - 2 * H; // the last viewport is covered by the next sheet
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
      const env = lightPalm(environment(g, W, H, hor), cam.ox, W);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const view = { ctx, W, H, cam };
      land.sky(view, env, hor);
      land.starfield(view, (1 - smoothstep(0.03, 0.13, g)) * 0.9, t);
      land.moon(view, 1 - smoothstep(0.02, 0.1, g));
      land.sun(view, env, t);
      land.horizon(view, env, hor);
      land.groundTop(view, env);
      land.soil(view, env, t);
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
      root.dataset.chapter = planting ? 2 : 3;

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
      const barsOn = Math.round(invlerp(0.2, 1, nodesAt[0].vis) * bars.length);
      bars.forEach((b, i) => b.classList.toggle('on', i < barsOn));
    },
  };
}
