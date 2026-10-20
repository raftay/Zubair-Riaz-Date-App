import { docTop } from '../engine.js';
import { TAU, clamp, lerp, invlerp, smoothstep, keys, fract, ease, rgba } from '../lib/math.js';
import { Landscape, environment, lightPalm } from '../lib/landscape.js';
import { Palm, buildRoots, drawRoots, drawRootFlow, TRUNK_MAX } from '../lib/palm.js';

const EMITTERS = [-150, -70, 70, 150]; // drip emitters along the line (world x)
const TUBE_Y = -16; // drip line height on its stakes (world units above ground)
const TEAL = [94, 156, 154];

// 05 · Water. Same palm, same world as growth, but up close at its base: a drip
// line feeds the sand, wetting bulbs spread through the soil, water climbs the
// roots and the trunk, and the camera follows it up into the crown.
export function waterScene() {
  const root = document.getElementById('water');
  const canvas = root.querySelector('.water__canvas');
  const blocks = ['.w-head--a', '.w-head--b'].map((sel) => {
    const el = root.querySelector(sel);
    return { el, rule: el.querySelector('.eyebrow__rule'), sqs: [...el.querySelectorAll('[data-sq]')].map((e) => e._sq) };
  });
  const chips = [...root.querySelectorAll('.w-chip')].map((el) => ({ el, sq: el.querySelector('[data-sq]')._sq }));
  const card = root.querySelector('#card-water');
  const cardSqs = [...card.querySelectorAll('[data-sq]')].map((e) => e._sq);
  const spark = card.querySelector('.w-spark');
  const flow = root.querySelector('.w-flow');
  const flowSq = flow.querySelector('[data-sq]')._sq;
  const flowBars = [...flow.querySelectorAll('.w-flow__bars b')];

  // a fortnight of daily litres for the water-log sparkline
  const days = [42, 44, 41, 47, 45, 49, 46, 52, 50, 55, 53, 58, 56, 61];
  const px = (i) => (i / (days.length - 1)) * 200;
  const py = (v) => 58 - ((v - 38) / 26) * 50;
  const line = days.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join('');
  spark.querySelector('.line').setAttribute('d', line);
  spark.querySelector('.area').setAttribute('d', `${line}L200 62L0 62Z`);
  const sparkDot = spark.querySelector('.dot');

  const palm = new Palm(7);
  const roots = buildRoots(5);
  const land = new Landscape();
  const cam = { ox: 0, oy: 0, s: 1 };
  let ctx, W, H, dpr, top = 0, range = 1, cardSize = [0, 0];

  function camera(w) {
    const k = H / 1080;
    cam.s = keys(w, [[0, 4], [0.42, 4], [0.86, 1.95], [1, 1.8]]) * k;
    const hf = keys(w, [[0, -26], [0.42, -26], [0.86, 500], [1, 540]]); // world height held at the anchor
    const ay = keys(w, [[0, 0.6], [0.42, 0.6], [0.86, 0.5], [1, 0.48]]) * H;
    cam.ox = keys(w, [[0, 0.6], [0.42, 0.6], [0.86, 0.56], [1, 0.56]]) * W;
    cam.oy = ay + hf * cam.s;
  }
  const X = (x) => cam.ox + x * cam.s;
  const Y = (y) => cam.oy + y * cam.s;

  // onion-shaped wetted soil under each emitter
  function drawBulbs(w) {
    const d = lerp(8, 150, ease.out(invlerp(0.04, 0.38, w)));
    if (cam.oy > H) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, cam.oy, W, H - cam.oy);
    ctx.clip();
    for (const ex of EMITTERS) {
      const cx = X(ex), cy = Y(d * 0.42);
      const rx = d * 0.5 * cam.s, ry = d * 0.56 * cam.s;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, -rx * 0.2, 0, 0, 0, rx);
      g.addColorStop(0, 'rgba(16,30,34,0.62)');
      g.addColorStop(0.7, 'rgba(22,44,48,0.42)');
      g.addColorStop(1, 'rgba(24,48,52,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, TAU);
      ctx.fill();
      ctx.restore();
      // the wetting front
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, TAU);
      ctx.setLineDash([6 * (W / 1920), 7 * (W / 1920)]);
      ctx.strokeStyle = rgba([120, 200, 196], 0.75);
      ctx.lineWidth = 1.8 * (W / 1920);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawDripLine(w, t) {
    const s = cam.s;
    const ty = Y(TUBE_Y);
    if (ty > H + 40) return;
    const wet = invlerp(0.02, 0.3, w);
    // wet sand where each emitter drips
    for (const ex of EMITTERS) {
      ctx.beginPath();
      ctx.ellipse(X(ex), Y(-4), lerp(5, 36, wet) * s, lerp(1.4, 6, wet) * s, 0, 0, TAU);
      ctx.fillStyle = `rgba(70,48,28,${0.18 + 0.32 * wet})`;
      ctx.fill();
    }
    // stakes
    ctx.strokeStyle = 'rgba(62,44,28,0.95)';
    ctx.lineWidth = Math.max(1, 1.6 * s);
    for (let x = -260; x <= 260; x += 110) {
      ctx.beginPath();
      ctx.moveTo(X(x), ty);
      ctx.lineTo(X(x + 2), Y(-3));
      ctx.stroke();
    }
    // tube: dark polyethylene with a soft highlight
    const r = 3.2 * s;
    const tg = ctx.createLinearGradient(0, ty - r, 0, ty + r);
    tg.addColorStop(0, '#5b5a55');
    tg.addColorStop(0.35, '#2a2926');
    tg.addColorStop(1, '#121110');
    ctx.fillStyle = tg;
    ctx.fillRect(0, ty - r, W, r * 2);
    ctx.fillStyle = 'rgba(255,240,210,0.18)';
    ctx.fillRect(0, ty - r * 0.6, W, Math.max(1, r * 0.25));
    // emitters, drops, splashes (drips run on the clock so the line never stops)
    EMITTERS.forEach((ex, i) => {
      const x = X(ex);
      ctx.fillStyle = '#1b1a18';
      ctx.beginPath();
      ctx.roundRect(x - 4.2 * s, ty - r * 1.15, 8.4 * s, r * 2.5, 2 * s);
      ctx.fill();
      ctx.fillStyle = rgba(TEAL, 0.9);
      ctx.fillRect(x - 4.2 * s, ty - r * 0.15, 8.4 * s, Math.max(1, 0.7 * s));
      const u = fract(t / 1.45 + i * 0.37);
      const nozzle = ty + r * 1.35;
      if (u < 0.62) {
        const rr = 2.3 * Math.pow(u / 0.62, 0.7) * s;
        drop(x, nozzle + rr * 0.9, rr);
      } else if (u < 0.74) {
        const v = (u - 0.62) / 0.12;
        drop(x, lerp(nozzle + 2 * s, Y(-5), v * v), 2.3 * s);
      } else {
        const v = (u - 0.74) / 0.26;
        for (let j = 0; j < 2; j++) {
          const vv = clamp(v * 1.2 - j * 0.25);
          if (vv <= 0 || vv >= 1) continue;
          ctx.beginPath();
          ctx.ellipse(x, Y(-4.5), (4 + 24 * vv) * s, (0.9 + 4.6 * vv) * s, 0, 0, TAU);
          ctx.strokeStyle = `rgba(170,232,226,${0.7 * (1 - vv)})`;
          ctx.lineWidth = Math.max(0.8, 0.7 * s);
          ctx.stroke();
        }
        for (let j = 0; j < 5; j++) {
          const a = -Math.PI / 2 + (j - 2) * 0.5;
          const d = v * 9 * s;
          const sx = x + Math.cos(a) * d * 1.4;
          const sy = Y(-5) + Math.sin(a) * d + v * v * 10 * s;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.6, 0.7 * s * (1 - v)), 0, TAU);
          ctx.fillStyle = `rgba(190,240,236,${0.85 * (1 - v)})`;
          ctx.fill();
        }
      }
    });
    function drop(x, y, rr) {
      if (rr < 0.3) return;
      ctx.beginPath();
      ctx.moveTo(x, y - rr * 1.9);
      ctx.quadraticCurveTo(x + rr * 1.05, y - rr * 0.4, x, y + rr);
      ctx.quadraticCurveTo(x - rr * 1.05, y - rr * 0.4, x, y - rr * 1.9);
      const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr * 1.4);
      g.addColorStop(0, 'rgba(230,255,252,0.95)');
      g.addColorStop(0.5, 'rgba(120,200,196,0.85)');
      g.addColorStop(1, 'rgba(60,128,126,0.9)');
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  // water rising through the trunk
  function drawXylem(w, t) {
    const a = smoothstep(0.34, 0.4, w) * (1 - 0.6 * smoothstep(0.9, 1, w));
    if (a <= 0) return null;
    const k = W / 1920;
    const hp = TRUNK_MAX * ease.inOut(invlerp(0.36, 0.84, w));
    const path = new Path2D();
    path.moveTo(X(palm.trunkX(0, TRUNK_MAX)), Y(0));
    for (let h = 6; h <= hp; h += 6) path.lineTo(X(palm.trunkX(h, TRUNK_MAX)), Y(-h));
    const hx = X(palm.trunkX(hp, TRUNK_MAX)), hy = Y(-hp);
    path.lineTo(hx, hy);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(110,214,206,${0.22 * a})`;
    ctx.lineWidth = 10 * k;
    ctx.stroke(path);
    ctx.strokeStyle = `rgba(196,250,244,${0.9 * a})`;
    ctx.lineWidth = 2.2 * k;
    ctx.stroke(path);
    // bubbles riding up the line
    for (let i = 0; i < 9; i++) {
      const hb = hp * fract(t * 0.18 + i / 9);
      ctx.beginPath();
      ctx.arc(X(palm.trunkX(hb, TRUNK_MAX)), Y(-hb), 2.6 * k, 0, TAU);
      ctx.fillStyle = `rgba(220,255,250,${0.7 * a})`;
      ctx.fill();
    }
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 40 * k);
    g.addColorStop(0, `rgba(210,255,250,${0.9 * a})`);
    g.addColorStop(1, 'rgba(110,214,206,0)');
    ctx.fillStyle = g;
    ctx.fillRect(hx - 40 * k, hy - 40 * k, 80 * k, 80 * k);
    // crown flush as the water arrives
    const crown = smoothstep(0.82, 0.9, w) * (1 - smoothstep(0.93, 1, w));
    if (crown > 0) {
      const cg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 420 * k);
      cg.addColorStop(0, `rgba(150,236,226,${0.28 * crown})`);
      cg.addColorStop(1, 'rgba(150,236,226,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(hx - 420 * k, hy - 420 * k, 840 * k, 840 * k);
    }
    ctx.restore();
    return [hx, hy, hp];
  }

  function leader(x0, y0, x1, y1, a) {
    const k = W / 1920;
    ctx.save();
    ctx.strokeStyle = `rgba(94,156,154,${0.9 * a})`;
    ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x0, y0, 4.5 * k, 0, TAU);
    ctx.fillStyle = `rgba(225,255,250,${a})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x0, y0, 10 * k, 0, TAU);
    ctx.strokeStyle = `rgba(94,156,154,${0.7 * a})`;
    ctx.stroke();
    ctx.restore();
  }

  function block(b, vis) {
    b.el.style.opacity = vis > 0 ? 1 : 0;
    b.rule.style.transform = `scaleX(${ease.out(invlerp(0, 0.4, vis))})`;
    const n = b.sqs.length;
    b.sqs.forEach((q, i) => q.setProgress(invlerp(i / (n + 2), (i + 3) / (n + 2), vis)));
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
      cardSize = [card.offsetWidth, card.offsetHeight];
    },
    locate: (k) => top + (k.w ?? 0) * range,

    update(s) {
      const ly = s.y - top;
      if (ly < -H || ly > range + 2 * H) return;
      const w = clamp(ly / range);
      const t = s.t;
      const rem = W / 120;

      camera(w);
      const hor = cam.oy - 11 * cam.s;
      const env = lightPalm(environment(1, W, H, hor), cam.ox, W);
      env.frondLift = smoothstep(0.82, 0.98, w);
      const view = { ctx, W, H, cam };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      land.sky(view, env, Math.max(hor, H + 2));
      land.sun(view, env, t);
      if (hor < H + 200) {
        land.horizon(view, env, hor);
        land.groundTop(view, env);
        land.soil(view, env, t);
        drawBulbs(w);
        drawRoots(ctx, cam, roots, 1, t);
        drawRootFlow(ctx, cam, roots, smoothstep(0.18, 0.32, w) * (1 - smoothstep(0.55, 0.8, w)), t);
      }
      palm.draw(ctx, cam, 1, t, env);
      drawDripLine(w, t);
      const head = drawXylem(w, t);

      // --- UI ---
      block(blocks[0], Math.min(invlerp(-0.45 * H, 0.02 * range, ly), 1 - invlerp(0.4, 0.48, w)));
      block(blocks[1], invlerp(0.86, 0.95, w));

      chips.forEach((c, i) => {
        const v = ease.out(invlerp(0.06 + i * 0.035, 0.13 + i * 0.035, w)) * (1 - invlerp(0.4, 0.46, w));
        c.el.style.opacity = v;
        c.el.style.transform = `translate(${X(EMITTERS[i]) - c.el.offsetWidth / 2}px, ${Y(TUBE_Y) - 4.3 * rem + (1 - v) * 0.8 * rem}px)`;
        c.sq.setProgress(invlerp(0.3, 1, v));
      });

      const cv = ease.out(invlerp(0.17, 0.27, w)) * (1 - invlerp(0.4, 0.46, w));
      const cx = 9.5 * rem, cy = 0.62 * H;
      card.style.opacity = cv;
      card.style.transform = `translate(${cx}px, ${cy + (1 - cv) * 1.4 * rem}px)`;
      cardSqs.forEach((q) => q.setProgress(invlerp(0.3, 1, cv)));
      const drawn = ease.inOut(invlerp(0.2, 0.34, w));
      spark.style.setProperty('--draw', drawn);
      const last = Math.min(days.length - 1, Math.floor(drawn * (days.length - 1)));
      sparkDot.setAttribute('cx', px(last));
      sparkDot.setAttribute('cy', py(days[last]));
      if (cv > 0) {
        const d = lerp(8, 150, ease.out(invlerp(0.04, 0.38, w)));
        leader(X(EMITTERS[0]), Y(d * 0.42), cx + cardSize[0], cy + cardSize[1] * 0.35, cv);
      }

      const fv = head ? ease.out(invlerp(0.44, 0.5, w)) * (1 - invlerp(0.82, 0.88, w)) : 0;
      flow.style.opacity = fv;
      if (head) {
        const fx = X(palm.trunkX(head[2], TRUNK_MAX) + palm.trunkR(head[2]) + 26);
        const fy = clamp(head[1], 0.18 * H, 0.85 * H) - flow.offsetHeight / 2;
        flow.style.transform = `translate(${fx}px, ${fy}px)`;
        if (fv > 0) leader(head[0] + palm.trunkR(head[2]) * cam.s * 0.2, head[1], fx, fy + flow.offsetHeight / 2, fv);
      }
      flowSq.setProgress(invlerp(0.3, 1, fv));
      flowBars.forEach((b, i) => (b.style.transform = `scaleY(${0.35 + 0.65 * Math.abs(Math.sin(t * 3 + i * 1.3))})`));
      root.dataset.chapter = 4;
    },
  };
}
