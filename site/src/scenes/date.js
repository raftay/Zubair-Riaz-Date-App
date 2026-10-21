import { invlerp, smoothstep, ease, lerp, keys } from '../lib/math.js';
import { Date3D } from '../lib/date3d.js';
import { DATE_CENTER } from './hero.js';
import { LEAD } from './thread.js';

const SEED_RY = 14.4; // seed glyph half-height at 1920 wide (matches the soil scene's seed)

// 02 · The date becomes the seed. Runs on the hero's pinned stage: the glint on
// the photographed date flares into a real 3D Ajwa date, which turns like a
// product shot and opens to reveal its seed, then lets the seed fall away — trailing
// the golden thread that continues down the page.
export function dateScene(hero) {
  const root = document.getElementById('hero');
  const gl = root.querySelector('.date__gl');
  const glow = root.querySelector('.date__glow');
  const orbit = root.querySelector('.date__orbit');
  const [ring, ticks] = orbit.querySelectorAll('ellipse');
  const trail = root.querySelector('.date__trail');
  const trailPaths = [trail.querySelector('.date__trail-glow'), trail.querySelector('.date__trail-core')];
  const glyph = trail.querySelector('.seedglyph');
  const ui = (sel) => {
    const el = root.querySelector(sel);
    return {
      el,
      rule: el.querySelector('.eyebrow__rule'),
      sqs: [...el.querySelectorAll('[data-sq]')].map((e) => e._sq),
      items: [...el.querySelectorAll('li')],
    };
  };
  const product = ui('.date-ui--product');
  const date3d = new Date3D(gl);

  let W = 1920, H = 1080, k = 1, end = 0;

  // write a block in, then (optionally) un-write it again
  function block(b, p, a, z, out0, out1) {
    const vis = Math.min(invlerp(a, z, p), 1 - invlerp(out0, out1, p));
    b.el.style.opacity = vis > 0 ? 1 : 0;
    if (b.rule) b.rule.style.transform = `scaleX(${ease.out(invlerp(0, 0.4, vis))})`;
    const n = b.sqs.length;
    b.sqs.forEach((q, i) => q.setProgress(invlerp(i / (n + 2), (i + 3) / (n + 2), vis)));
    b.items.forEach((li, i) => {
      const v = ease.out(invlerp(0.15 + i * 0.12, 0.55 + i * 0.12, vis));
      li.style.opacity = v;
      li.style.transform = `translateY(${(1 - v) * 1.2}rem)`;
    });
    return vis;
  }

  return {
    resize(s) {
      W = s.vw;
      H = s.vh;
      k = W / 1920;
      date3d.resize(W, H, s.dpr);
      end = hero.locate({ p: 1 });
    },

    update(s) {
      if (s.y > end + H) return;
      const p = hero.progress(s);
      const t = s.t;
      const C = [DATE_CENTER[0] * W, DATE_CENTER[1] * H];

      // --- the date ---
      const appear = smoothstep(0.13, 0.21, p);
      const u = ease.inOut(invlerp(0.13, 0.33, p));
      const [px, py] = hero.datePoint(p);
      const open = ease.inOut(invlerp(0.52, 0.68, p));
      const burst = ease.in(invlerp(0.7, 0.86, p));
      const hDate = (lerp(95, 560, u) + 40 * smoothstep(0.33, 0.5, p) + 60 * open + 260 * burst) * k;
      const dx = lerp(px, C[0], u);
      const dy = lerp(py, C[1], u) + Math.sin(t * 0.9) * 4 * k * u;
      const yaw = keys(p, [[0.13, 1.4], [0.33, 0.35], [0.47, -0.5], [0.55, 0]], ease.inOutSine) + Math.sin(t * 0.5) * 0.03 * (1 - open);
      const roll = keys(p, [[0.13, 0.95], [0.33, 0.34], [0.47, 0.26], [0.56, 0.1], [0.7, 0.08]], ease.inOutSine);
      const dateAlpha = appear * (1 - smoothstep(0.74, 0.86, p));

      // --- the seed: rides inside the date, lifts out, then falls away ---
      const lift = ease.inOut(invlerp(0.68, 0.8, p));
      const fall = invlerp(0.82, 1, p);
      const liftY = C[1] - 0.035 * H;
      const hIn = 0.6 * hDate;
      const hLift = 0.6 * 660 * 1.25 * k;
      const hEnd = 2 * SEED_RY * k;
      let sx = lerp(dx, C[0], lift);
      let sy = lerp(dy, liftY, lift);
      let sh = lerp(hIn, hLift, lift);
      if (fall > 0) {
        const f = ease.inOut(fall);
        sx = C[0];
        sy = lerp(liftY, LEAD * H, f);
        sh = Math.exp(lerp(Math.log(hLift), Math.log(hEnd), f));
      }
      const seedFade = smoothstep(0.93, 0.975, p);
      const seed = {
        x: sx,
        y: sy,
        h: sh,
        yaw: lerp(lerp(yaw, 0.55, lift), 0, ease.inOut(fall)),
        roll: lerp(lerp(roll, 0.25, lift), 0, ease.inOut(fall)),
        pitch: lerp(0.12 * lift, 0, fall),
        alpha: (open > 0.01 ? appear : 0) * (1 - seedFade),
        glow: 0.12 * lift * (1 - fall),
      };

      gl.style.opacity = appear;
      if (appear > 0.003) {
        date3d.render({ x: dx, y: dy, h: hDate, yaw, roll, open, spread: 0.1 * open + 0.95 * burst, alpha: dateAlpha }, seed);
      }

      // --- warm light, orbit ring ---
      glow.style.opacity = smoothstep(0.14, 0.3, p) * (1 - 0.45 * smoothstep(0.7, 0.9, p)) * (1 - smoothstep(0.9, 1, p));
      const ringIn = ease.inOut(invlerp(0.26, 0.38, p));
      const ringOut = 1 - smoothstep(0.48, 0.56, p);
      ring.style.strokeDashoffset = 1 - ringIn;
      orbit.style.opacity = ringOut;
      ticks.style.opacity = 0.35 * ringIn * ringOut;

      // --- copy: one product block, held while the date turns and opens ---
      block(product, p, 0.27, 0.39, 0.7, 0.77);

      // --- golden thread trailing the falling seed, then the seed glyph ---
      const ta = smoothstep(0.82, 0.87, p) * (s.y <= end + H ? 1 : 0);
      if (ta > 0) {
        const d = `M${C[0]} ${liftY} L${sx} ${sy}`;
        trailPaths.forEach((el) => el.setAttribute('d', d));
      }
      trailPaths.forEach((el) => (el.style.opacity = ta));
      glyph.style.opacity = s.y <= end ? seedFade : 0;
      glyph.setAttribute('transform', `translate(${C[0]} ${LEAD * H}) scale(${k})`);
    },
  };
}
