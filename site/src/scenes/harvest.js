import { docTop } from '../engine.js';
import { TAU, clamp, invlerp, smoothstep, ease } from '../lib/math.js';
import { rng } from '../lib/rand.js';
import { Studio3D } from '../lib/studio3d.js';

// 07 · Harvest + 08 · Packaging: one pinned studio shot (see studio3d.js).
// The bunch is cut and caught, one perfect date is inspected and chosen, then
// it's boxed, ribboned, sealed and tagged.
export function harvestScene() {
  const root = document.getElementById('harvest');
  const bg = root.querySelector('.harvest__bg');
  const gl = root.querySelector('.harvest__gl');
  const lead = root.querySelector('.h-lead');
  const leadDot = root.querySelector('.h-lead-dot');
  const flash = root.querySelector('.h-flash');
  const block = (sel) => {
    const el = root.querySelector(sel);
    return { el, rule: el.querySelector('.eyebrow__rule'), sqs: [...el.querySelectorAll('[data-sq]')].map((e) => e._sq) };
  };
  const headA = block('.h-head--a');
  const headB = block('.h-head--b');
  const cta = block('.h-cta');
  const inspect = root.querySelector('.h-inspect');
  const inspectSqs = [...inspect.querySelectorAll('[data-sq]')].map((e) => e._sq);
  const rows = [...inspect.querySelectorAll('li')];
  const checks = [...inspect.querySelectorAll('.check path')];
  const barcode = inspect.querySelector('.barcode');
  const studio = new Studio3D(gl);

  // a deterministic barcode for the batch chip
  {
    const r = rng(5150);
    let x = 0;
    while (x < 118) {
      const w = r() < 0.6 ? 1.2 : r() < 0.7 ? 2.6 : 4;
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', x);
      bar.setAttribute('y', 0);
      bar.setAttribute('width', w);
      bar.setAttribute('height', 30);
      barcode.appendChild(bar);
      x += w + (r() < 0.5 ? 1.4 : 2.6);
    }
  }

  const r = rng(616);
  const motes = Array.from({ length: 60 }, () => ({ x: r(), y: r(), z: r(), ph: r() * TAU, f: r.range(0.15, 0.5) }));
  let ctx, W, H, dpr, top = 0, range = 1;

  function show(b, vis) {
    b.el.style.opacity = vis > 0 ? 1 : 0;
    if (b.rule) b.rule.style.transform = `scaleX(${ease.out(invlerp(0, 0.4, vis))})`;
    const n = b.sqs.length;
    b.sqs.forEach((q, i) => q.setProgress(invlerp(i / (n + 2), (i + 3) / (n + 2), vis)));
  }

  function background(h, t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createRadialGradient(0.56 * W, 0.42 * H, 0, 0.56 * W, 0.5 * H, 0.95 * W);
    g.addColorStop(0, '#3a2414');
    g.addColorStop(0.45, '#1c120b');
    g.addColorStop(1, '#0a0604');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // a soft overhead spot
    const sx = 0.55 * W, sy = -0.1 * H;
    const spot = ctx.createRadialGradient(sx, sy, 0, sx, sy, 1.15 * H);
    spot.addColorStop(0, 'rgba(255,214,150,0.16)');
    spot.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const k = W / 1920;
    for (const m of motes) {
      const x = (m.x + Math.sin(t * m.f + m.ph) * 0.01) * W;
      const y = ((m.y - t * 0.006 * (0.5 + m.z) - h * 0.3 * m.z) % 1 + 1) % 1 * H;
      const rr = (1 + m.z * 3) * k;
      const a = (0.12 + 0.3 * m.z) * (0.4 + 0.6 * Math.sin(t * (0.5 + m.f) + m.ph) ** 2);
      const mg = ctx.createRadialGradient(x, y, 0, x, y, rr * 3);
      mg.addColorStop(0, `rgba(255,224,170,${a})`);
      mg.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(x - rr * 3, y - rr * 3, rr * 6, rr * 6);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  return {
    resize(s) {
      W = s.vw;
      H = s.vh;
      dpr = s.dpr;
      bg.width = Math.round(W * dpr);
      bg.height = Math.round(H * dpr);
      ctx = bg.getContext('2d');
      studio.resize(W, H, dpr);
      top = docTop(root);
      range = root.offsetHeight - H;
    },
    locate: (k) => top + (k.h ?? 0) * range,

    update(s) {
      const ly = s.y - top;
      if (ly < -H || ly > range + H) return;
      const h = clamp(ly / range);
      const t = s.t;
      background(h, t);
      const info = studio.render(h, t);

      // the cut: a streak of light where the blade meets the stalk
      const fl = smoothstep(0.108, 0.116, h) * (1 - smoothstep(0.118, 0.135, h));
      flash.style.opacity = fl;
      if (fl > 0) {
        const [fx, fy] = studio.project(info.cut);
        flash.style.transform = `translate(${fx}px, ${fy}px) rotate(-24deg) scale(${0.6 + fl})`;
      }

      show(headA, Math.min(invlerp(-0.45 * H, 0.03 * range, ly), 1 - invlerp(0.19, 0.25, h)));

      // inspection: the chosen date, checked and batched
      const iv = invlerp(0.34, 0.41, h) * (1 - invlerp(0.53, 0.58, h));
      inspect.style.opacity = ease.out(iv);
      inspect.style.transform = `translateX(${(1 - ease.out(iv)) * 2}rem)`;
      inspectSqs.forEach((q) => q.setProgress(invlerp(0.2, 0.9, iv)));
      rows.forEach((row, i) => (row.style.opacity = ease.out(invlerp(0.25 + i * 0.15, 0.55 + i * 0.15, iv))));
      checks.forEach((c, i) => (c.style.strokeDashoffset = 1 - ease.out(invlerp(0.45 + i * 0.15, 0.7 + i * 0.15, iv))));
      if (iv > 0) {
        const [hx, hy] = studio.project(info.hero);
        const k = W / 120;
        const bx = inspect.offsetLeft - 1.2 * k, by = inspect.offsetTop + 2.4 * k;
        lead.setAttribute('d', `M${hx + 3.5 * k} ${hy} L${bx - 3 * k} ${by} L${bx} ${by}`);
        leadDot.setAttribute('cx', hx + 3.5 * k);
        leadDot.setAttribute('cy', hy);
      }
      lead.style.opacity = iv;
      lead.style.strokeDashoffset = 1 - ease.out(invlerp(0.1, 0.5, iv));
      leadDot.style.opacity = iv;

      show(headB, Math.min(invlerp(0.63, 0.72, h), 1 - invlerp(0.87, 0.92, h)));
      const cv = invlerp(0.9, 0.97, h);
      show(cta, cv);
      cta.el.querySelector('.h-cta__row').style.opacity = ease.out(invlerp(0.4, 1, cv));
      root.dataset.chapter = h < 0.6 ? 6 : 7;
    },
  };
}
