import { docTop } from '../engine.js';
import { invlerp, smoothstep, ease, clamp, lerp, TAU } from '../lib/math.js';
import { rng } from '../lib/rand.js';
import { drawFrond } from '../lib/palm.js';

// Where the date sits inside the photo (fraction of the person box).
export const DATE_IN_PHOTO = [0.356, 0.856];
// Screen point the camera pushes the date toward, as a fraction of the viewport.
export const DATE_CENTER = [0.5, 0.52];

// 01 · Hero: Zubair holding a date, under a Madinah arch. The stage is pinned;
// scrolling pushes the camera into the date he's holding (scene 02 takes over
// from there, see date.js).
export function heroScene() {
  const root = document.getElementById('hero');
  const nav = document.getElementById('nav');
  const photo = root.querySelector('.hero__photo');
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
  const eyebrowSq = content.querySelector('.eyebrow i')._sq;
  const titleSq = root.querySelector('.hero__title')._sq;
  const bodySq = root.querySelector('.hero__body')._sq;
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

  let ctx, W, H, dpr, top = 0, range = 1;
  const D = [0, 0];

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
      top = docTop(root);
      range = root.offsetHeight - H;
      dust.width = Math.round(W * dpr);
      dust.height = Math.round(H * dpr);
      ctx = dust.getContext('2d');
      paintFronds(s);
      D[0] = person.offsetLeft + DATE_IN_PHOTO[0] * person.offsetWidth;
      D[1] = person.offsetTop + DATE_IN_PHOTO[1] * person.offsetHeight;
    },

    // hero progress (0..1 across the pinned range)
    progress: (s) => clamp((s.y - top) / range),
    // the photographed date's screen point and the push-in zoom at progress p
    datePoint(p) {
      const e = ease.inOut(invlerp(0.02, 0.3, p));
      return [lerp(D[0], DATE_CENTER[0] * W, e), lerp(D[1], DATE_CENTER[1] * H, e), 1 + 2.4 * e];
    },
    locate: (k) => top + (k.p ?? 0) * range,

    update(s) {
      const t = s.t;
      const p = clamp((s.y - top) / range);
      if (s.y > top + range + H) return; // scrolled away
      const intro = (a, b, fn = ease.out) => fn(invlerp(a, b, t));
      root.dataset.chapter = p < 0.2 ? 0 : 1;

      // --- intro reveal (virtual clock) ---
      glow.style.opacity = intro(0, 1.6);
      beam.style.opacity = intro(0.4, 2.2) * (0.85 + 0.15 * Math.sin(t * 0.7));
      fronds.style.opacity = intro(0.2, 1.8);
      arch[0].style.strokeDashoffset = 1 - intro(0.3, 2.4, ease.inOut);
      arch[1].style.strokeDashoffset = 1 - intro(0.6, 2.8, ease.inOut);
      const pi = intro(0.2, 1.6);
      person.style.opacity = pi;
      person.style.transform = `translateY(${(1 - pi) * 2.2}rem)`;

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

      // --- push in on the date (scroll) ---
      const [dx, dy, Z] = this.datePoint(p);
      photo.style.transformOrigin = '0 0';
      photo.style.transform = `translate(${dx - Z * D[0]}px, ${dy - Z * D[1]}px) scale(${Z})`;
      const blur = 7 * smoothstep(0.1, 0.26, p);
      photo.style.filter = `blur(${blur.toFixed(2)}px) brightness(${1 - 0.45 * smoothstep(0.08, 0.26, p)})`;
      photo.style.opacity = 1 - smoothstep(0.22, 0.36, p);
      bg.style.opacity = 1 - smoothstep(0.06, 0.2, p);

      content.style.opacity = 1 - smoothstep(0.015, 0.09, p);
      content.style.transform = `translateY(${-smoothstep(0, 0.12, p) * 0.18 * H}px)`;

      // glint on the date: breathes at rest, then flares into the 3D date
      const gl = intro(2.0, 2.9);
      const pulse = 0.82 + 0.18 * Math.sin(t * 2.1) ** 2;
      const flare = smoothstep(0.08, 0.19, p);
      const gone = smoothstep(0.2, 0.27, p);
      glint.style.opacity = gl * (1 - gone);
      glint.style.transform = `translate(${dx}px, ${dy}px) scale(${pulse * (1 + flare * 3.2)}) rotate(${t * 9 + p * 160}deg)`;

      cue.style.opacity = intro(2.8, 3.4) * (1 - smoothstep(0.005, 0.04, p));
      cueSq.setProgress(invlerp(2.9, 3.5, t));
      mouseDot.style.transform = `translateY(${((t * 0.8) % 1) * 0.7}rem)`;
      mouseDot.style.opacity = 1 - ((t * 0.8) % 1);

      // --- floating dust in the warm light ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const da = intro(0.5, 2.2) * (1 - 0.62 * smoothstep(0.16, 0.32, p)) * (1 - smoothstep(0.85, 1, p));
      if (da <= 0.01) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        const y = (((m.y - t * m.sp - p * 0.25 * m.z) % 1) + 1) % 1;
        const x = m.x + Math.sin(t * m.f + m.ph) * m.sw - 0.12 * smoothstep(0.1, 0.4, p);
        const px = x * W;
        const py = y * H;
        const size = (0.7 + m.z * 2.4) * (W / 1920) * (1 + 0.7 * m.z * smoothstep(0.05, 0.3, p));
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
