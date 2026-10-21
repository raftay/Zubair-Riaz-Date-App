import { docTop } from '../engine.js';

// The falling seed rides the tip of the thread at this fraction of the viewport.
export const LEAD = 0.62;

// The golden thread: picks up where the date scene lets the seed fall and is
// drawn down the page as you scroll. The seed itself is the tip, so it seems
// to drift down through the dark, landing in the soil scene.
export function threadScene() {
  const svg = document.getElementById('thread');
  const glow = svg.querySelector('.thread__glow');
  const core = svg.querySelector('.thread__core');
  const seed = svg.querySelector('.thread__seed');
  const hero = document.getElementById('hero');
  const bridge = document.getElementById('bridge');
  const growth = document.getElementById('growth');

  let total = 0, table = [], start = 0, k = 1;

  // Catmull-Rom through points -> cubic Bézier path data
  function spline(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }

  return {
    resize(s) {
      const W = s.vw, H = s.vh;
      k = W / 1920;
      start = docTop(hero) + hero.offsetHeight - H; // where the hero stage unpins
      const bTop = docTop(bridge);
      const bH = bridge.offsetHeight;
      const end = docTop(growth);
      const ex = 0.62 * W;
      const pts = [
        [0.5 * W, start + LEAD * H],
        [0.5 * W, start + (LEAD + 0.1) * H],
        [0.6 * W, bTop + 0.35 * bH],
        [ex, end - 0.12 * H],
        [ex, end - 0.02 * H],
        [ex, end],
      ];
      svg.setAttribute('width', W);
      svg.setAttribute('height', end + 2);
      svg.style.height = end + 2 + 'px';
      const d = spline(pts);
      glow.setAttribute('d', d);
      core.setAttribute('d', d);
      total = core.getTotalLength();
      table = [];
      for (let i = 0; i <= 800; i++) {
        const l = (i / 800) * total;
        const p = core.getPointAtLength(l);
        table.push([l, p.x, p.y]);
      }
      for (const el of [glow, core]) el.style.strokeDasharray = `${total} ${total + 10}`;
    },

    update(s) {
      const H = s.vh;
      // length whose point sits at the seed's depth in the viewport
      const target = s.y + LEAD * H;
      let i = 0;
      while (i < table.length - 1 && table[i][2] < target) i++;
      const [len, x, y] = table[i];
      const shown = s.y > start ? len : 0;
      for (const el of [glow, core]) el.style.strokeDashoffset = total - shown;
      const tipOn = s.y > start && shown < total - 1;
      seed.style.opacity = tipOn ? 1 : 0;
      if (tipOn) {
        // tilt with the curve, like a seed drifting as it falls
        const j = Math.max(1, i);
        const ang = Math.atan2(table[j][1] - table[j - 1][1], table[j][2] - table[j - 1][2]);
        seed.setAttribute('transform', `translate(${x} ${y}) rotate(${(-ang * 180) / Math.PI * 0.8}) scale(${k})`);
      }
    },
  };
}
