import { invlerp, smoothstep, ease, clamp, TAU } from '../lib/math.js';
import { rng } from '../lib/rand.js';
import { drawFrond } from '../lib/palm.js';

// 01 · Hero: Zubair holding a date, under a Madinah arch.
export function heroScene() {
  const root = document.getElementById('hero');
  const nav = document.getElementById('nav');
  const bg = root.querySelector('.hero__bg');
  const glow = root.querySelector('.hero__glow');
  const beam = root.querySelector('.hero__beam');
  const arch = [...root.querySelectorAll('.hero__arch path')];
  const fronds = root.querySelector('.hero__fronds');
  const dust = root.querySelector('.hero__dust');
  const person = root.querySelector('.hero__person');
  const glint = root.querySelector('.hero__glint');
  const content = root.querySelector('.hero__content');
  const rule = content.querySelector('.eyebrow__rule');
  const ctas = [...content.querySelectorAll('.btn')];
  const feats = [...content.querySelectorAll('.features li')];
  const cue = root.querySelector('.hero__cue');
  const mouseDot = root.querySelector('.mouse b');
  const sq = (sel) => root.querySelector(sel)._sq;
  const eyebrowSq = content.querySelector('.eyebrow i')._sq;
  const titleSq = sq('.hero__title');
  const bodySq = sq('.hero__body');
  const ctaSqs = ctas.map((b) => b.querySelector('i')._sq);
  const featSqs = feats.map((f) => f.querySelector('i')._sq);
  const navSqs = [...nav.querySelectorAll('[data-sq]')].map((e) => e._sq);
  const cueSq = cue.querySelector('i')._sq;

  const r = rng(404);
  const motes = Array.from({ length: 110 }, () => ({
    x: 0.64 + (r() + r() + r() - 1.5) * 0.32,
    y: r(),
    z: r(),
    sp: r.range(0.008, 0.03),
    sw: r.range(0.004, 0.016),
    f: r.range(0.2, 0.7),
    ph: r() * TAU,
  }));

  let ctx, W, H, dpr;

  function paintFronds(s) {
    const c = fronds.getContext('2d');
    fronds.width = Math.round(s.vw * s.dpr);
    fronds.height = Math.round(s.vh * s.dpr);
    c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    const k = s.vw / 1920;
    const base = { leaflets: 54, lm: 0.4, v: 0.5, lw: 1.7, unfurl: 1, age: 0, depth: 1, light: [0, 1, 0], amb: [1, 1, 1] };
    c.filter = `blur(${10 * k}px)`;
    // out-of-focus fronds hanging into frame, like standing under a palm
    drawFrond(c, { ...base, x: 1980 * k, y: -60 * k, s: 2.3 * k, phi: Math.PI + 0.25, elev: 1.9, len: 360, droop: 0.32, flat: 'rgba(52,32,18,0.85)' });
    drawFrond(c, { ...base, x: 1780 * k, y: -120 * k, s: 2.1 * k, phi: Math.PI - 0.5, elev: 2.15, len: 330, droop: 0.28, flat: 'rgba(40,25,15,0.9)' });
    drawFrond(c, { ...base, x: -80 * k, y: -90 * k, s: 2 * k, phi: 0.3, elev: 1.95, len: 300, droop: 0.3, flat: 'rgba(44,27,16,0.75)' });
    c.filter = `blur(${4 * k}px)`;
    drawFrond(c, { ...base, x: 2010 * k, y: 760 * k, s: 1.6 * k, phi: Math.PI + 0.1, elev: 1.25, len: 300, droop: 0.22, flat: 'rgba(7,4,2,0.92)' });
    c.filter = 'none';
  }

  return {
    resize(s) {
      W = s.vw;
      H = s.vh;
      dpr = s.dpr;
      dust.width = Math.round(W * dpr);
      dust.height = Math.round(H * dpr);
      ctx = dust.getContext('2d');
      paintFronds(s);
    },

    update(s) {
      const t = s.t;
      const p = clamp(s.y / s.vh); // scroll-out progress
      if (p >= 1) return; // fully off screen
      const intro = (a, b, fn = ease.out) => fn(invlerp(a, b, t));

      // --- intro reveal (virtual clock) ---
      glow.style.opacity = intro(0, 1.6);
      beam.style.opacity = intro(0.4, 2.2) * (0.85 + 0.15 * Math.sin(t * 0.7));
      fronds.style.opacity = intro(0.2, 1.8);
      const ad = intro(0.3, 2.4, ease.inOut);
      arch[0].style.strokeDashoffset = 1 - ad;
      arch[1].style.strokeDashoffset = 1 - intro(0.6, 2.8, ease.inOut);
      const pi = intro(0.2, 1.6);
      person.style.opacity = pi;
      person.style.transform = `translateY(${(1 - pi) * 2.2}rem)`;
      person.style.filter = `brightness(${0.55 + 0.45 * pi})`;

      nav.style.opacity = intro(0.6, 1.6);
      navSqs.forEach((q, i) => q.setProgress(invlerp(0.8 + i * 0.08, 1.5 + i * 0.08, t)));

      rule.style.transform = `scaleX(${intro(0.8, 1.5)})`;
      eyebrowSq.setProgress(invlerp(0.9, 1.5, t));
      titleSq.setProgress(ease.inOutSine(invlerp(1.0, 2.6, t)));
      bodySq.setProgress(invlerp(1.7, 2.8, t));
      ctas.forEach((b, i) => {
        const k = intro(2.1 + i * 0.15, 2.8 + i * 0.15);
        b.style.opacity = k;
        b.style.transform = `translateY(${(1 - k) * 0.8}rem)`;
        ctaSqs[i].setProgress(invlerp(2.3 + i * 0.15, 2.9 + i * 0.15, t));
      });
      feats.forEach((f, i) => {
        const k = intro(2.5 + i * 0.12, 3.2 + i * 0.12);
        f.style.opacity = k;
        featSqs[i].setProgress(invlerp(2.7 + i * 0.12, 3.3 + i * 0.12, t));
      });

      // glint on the date: breathes, then flares as you start to scroll
      const gl = intro(2.0, 2.9);
      const pulse = 0.82 + 0.18 * Math.sin(t * 2.1) ** 2;
      const flare = 1 + smoothstep(0, 0.25, p) * 0.5;
      glint.style.opacity = gl;
      glint.style.transform = `scale(${pulse * flare}) rotate(${t * 9}deg)`;

      const ci = intro(2.8, 3.4) * (1 - smoothstep(0.02, 0.12, p));
      cue.style.opacity = ci;
      cueSq.setProgress(invlerp(2.9, 3.5, t));
      mouseDot.style.transform = `translateY(${((t * 0.8) % 1) * 0.7}rem)`;
      mouseDot.style.opacity = 1 - ((t * 0.8) % 1);

      // --- scroll-out parallax (person moves 1:1 so the thread stays in his hand) ---
      content.style.transform = `translateY(${-p * s.vh * 0.34}px)`;
      content.style.opacity = 1 - smoothstep(0.04, 0.32, p);
      bg.style.transform = `translateY(${p * s.vh * 0.42}px)`;

      // --- floating dust in the warm light ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const da = intro(0.5, 2.2);
      for (const m of motes) {
        const y = ((m.y - t * m.sp) % 1 + 1) % 1;
        const x = m.x + Math.sin(t * m.f + m.ph) * m.sw;
        const px = x * W;
        const py = y * H + p * H * 0.2 * m.z;
        const size = (0.7 + m.z * 2.4) * (W / 1920);
        const tw = 0.25 + 0.75 * Math.sin(t * (0.8 + m.f) + m.ph) ** 2;
        const a = da * tw * (0.25 + 0.55 * m.z) * (1 - smoothstep(0.75, 1, y) * 0.6);
        const g = ctx.createRadialGradient(px, py, 0, px, py, size * 4);
        g.addColorStop(0, `rgba(255,226,160,${a})`);
        g.addColorStop(1, 'rgba(255,190,100,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - size * 4, py - size * 4, size * 8, size * 8);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
