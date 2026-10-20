import { docTop } from '../engine.js';
import { TAU, clamp, invlerp, smoothstep, ease, hex, mix, rgba, ramp } from '../lib/math.js';
import { rng } from '../lib/rand.js';
import { Cluster3D } from '../lib/cluster3d.js';
import { drawFrond } from '../lib/palm.js';

// backgrounds warm from morning cream to golden hour across the four stages
const BG = ['#EEE6CC', '#F2DBA4', '#E7B97F', '#C88D55'].map(hex);
// sweetness · moisture · firmness, per stage (drawn as little meters)
const METERS = [
  [0.18, 0.88, 0.95],
  [0.46, 0.72, 0.8],
  [0.74, 0.46, 0.42],
  [0.95, 0.22, 0.26],
];

// stage position (0..3) → ripeness for the shader. Panel 3 lands on the
// half-brown rutab look; tamr (3) is fully dark and wrinkled.
const ripeness = (S) => (S <= 1 ? S : S <= 2 ? 1 + (S - 1) * 0.5 : 1.5 + (S - 2) * 1.5);

// 06 · Ripening. A pinned "horizontal" section: the copy for each stage slides
// sideways while one 3D bunch ripens continuously through Kimri, Khalal, Rutab
// and Tamr.
export function ripenScene() {
  const root = document.getElementById('ripen');
  const bg = root.querySelector('.ripen__bg');
  const gl = root.querySelector('.ripen__gl');
  const panels = [...root.querySelectorAll('.ripen__panel')].map((el) => ({
    el,
    rule: el.querySelector('.eyebrow__rule'),
    sqs: [...el.querySelectorAll('[data-sq]')].map((e) => e._sq),
    bars: [...el.querySelectorAll('.ripen__meter b')],
  }));
  const railFill = root.querySelector('.ripen__rail-line b');
  const nodes = [...root.querySelectorAll('.ripen__node')];
  const nodeSqs = nodes.map((n) => n.querySelector('[data-sq]')._sq);
  const cluster = new Cluster3D(gl);
  const r = rng(808);
  const motes = Array.from({ length: 70 }, () => ({ x: r() * 1.6, y: r(), z: r(), ph: r() * TAU, f: r.range(0.2, 0.6) }));

  let ctx, W, H, dpr, top = 0, range = 1, fronds = null;

  function paintFronds() {
    // out-of-focus fronds on a strip wider than the screen, so they can drift sideways
    fronds = document.createElement('canvas');
    fronds.width = Math.round(W * 1.8 * dpr);
    fronds.height = Math.round(H * dpr);
    const c = fronds.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = W / 1920;
    const base = { leaflets: 50, lm: 0.4, v: 0.5, lw: 1.7, unfurl: 1, age: 0, depth: 1, light: [0, 1, 0], amb: [1, 1, 1] };
    c.filter = `blur(${12 * k}px)`;
    drawFrond(c, { ...base, x: 120 * k, y: -80 * k, s: 2.2 * k, phi: 0.2, elev: 1.95, len: 330, droop: 0.3, flat: 'rgba(70,84,40,0.32)' });
    drawFrond(c, { ...base, x: 1500 * k, y: -120 * k, s: 2.4 * k, phi: Math.PI - 0.3, elev: 2.0, len: 340, droop: 0.32, flat: 'rgba(60,72,36,0.3)' });
    drawFrond(c, { ...base, x: 2700 * k, y: -60 * k, s: 2.1 * k, phi: 0.5, elev: 1.9, len: 320, droop: 0.3, flat: 'rgba(66,78,38,0.32)' });
    c.filter = `blur(${20 * k}px)`;
    drawFrond(c, { ...base, x: 2200 * k, y: 1180 * k, s: 2.6 * k, phi: Math.PI + 0.2, elev: 0.7, len: 360, droop: 0.1, flat: 'rgba(52,62,30,0.35)' });
  }

  return {
    resize(s) {
      W = s.vw;
      H = s.vh;
      dpr = s.dpr;
      bg.width = Math.round(W * dpr);
      bg.height = Math.round(H * dpr);
      ctx = bg.getContext('2d');
      cluster.resize(W, H, dpr);
      top = docTop(root);
      range = root.offsetHeight - 2 * H; // the last viewport is covered by the next sheet
      paintFronds();
    },
    locate: (k) => top + (k.p ?? 0) * range,

    update(s) {
      const ly = s.y - top;
      if (ly < -H || ly > range + 2 * H) return;
      const t = s.t;
      const P = clamp(ly / range);
      // linger on each stage, move briskly between them
      const raw = P * 3;
      const i0 = Math.min(2, Math.floor(raw));
      const S = i0 + ease.inOut(invlerp(0.2, 0.8, raw - i0));
      const k = W / 1920;

      // --- background: warm wash, light behind the bunch, drifting fronds and motes ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = ramp(BG, S / 3);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(mix(c, [255, 250, 236], 0.25)));
      g.addColorStop(1, rgba(mix(c, [60, 30, 12], 0.12)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const cx = 0.66 * W, cy = 0.5 * H;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.62 * H);
      glow.addColorStop(0, rgba([255, 244, 214], 0.75));
      glow.addColorStop(1, rgba([255, 244, 214], 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(fronds, -S * 0.26 * W, 0, W * 1.8, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        const x = ((m.x - S * 0.12 * (0.4 + m.z) + 1.6) % 1.6) * W - 0.3 * W;
        const y = (m.y + Math.sin(t * m.f + m.ph) * 0.02) * H;
        const rr = (1.5 + m.z * 5) * k;
        const a = (0.18 + 0.4 * m.z) * (0.4 + 0.6 * Math.sin(t * (0.6 + m.f) + m.ph) ** 2);
        const mg = ctx.createRadialGradient(x, y, 0, x, y, rr * 3);
        mg.addColorStop(0, `rgba(255,236,190,${a})`);
        mg.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(x - rr * 3, y - rr * 3, rr * 6, rr * 6);
      }
      ctx.globalCompositeOperation = 'source-over';

      // --- the bunch ---
      cluster.render({
        ripe: ripeness(S),
        x: cx - S * 0.012 * W,
        y: 0.53 * H,
        h: 1.1 * H,
        yaw: -0.55 + P * 1.2 + Math.sin(t * 0.35) * 0.05,
        pitch: 0.05,
      });

      // --- copy panels slide sideways ---
      panels.forEach((p, i) => {
        const o = i - S;
        const vis = 1 - smoothstep(0.12, 0.5, Math.abs(o));
        p.el.style.opacity = 1 - smoothstep(0.3, 0.62, Math.abs(o));
        p.el.style.transform = `translateX(${o * 30}rem)`;
        p.rule.style.transform = `scaleX(${ease.out(vis)})`;
        const n = p.sqs.length;
        p.sqs.forEach((q, j) => q.setProgress(invlerp(j / (n + 2), (j + 3) / (n + 2), vis)));
        p.bars.forEach((b, j) => (b.style.transform = `scaleX(${METERS[i][j] * ease.out(invlerp(0.4, 1, vis))})`));
      });

      railFill.style.transform = `scaleX(${S / 3})`;
      nodes.forEach((n, i) => {
        n.classList.toggle('is-on', S >= i - 0.35);
        nodeSqs[i].setProgress(invlerp(i - 0.6, i - 0.1, S));
      });
      root.dataset.chapter = 5;
    },
  };
}
