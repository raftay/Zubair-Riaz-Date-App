import { docTop } from '../engine.js';
import { clamp, invlerp, ease } from '../lib/math.js';

// The golden thread: starts as the glint on the date in Zubair's hand and is
// drawn down the page as you scroll, landing on the seed in the growth scene.
// Its tip always leads a little below the middle of the screen.
export function threadScene() {
  const svg = document.getElementById('thread');
  const glow = svg.querySelector('.thread__glow');
  const core = svg.querySelector('.thread__core');
  const tip = svg.querySelector('.thread__tip');
  const person = document.querySelector('.hero__person');
  const glint = document.querySelector('.hero__glint');
  const bridge = document.getElementById('bridge');
  const growth = document.getElementById('growth');
  const bridgeInner = bridge.querySelector('.bridge__inner');
  const bridgeMark = bridge.querySelector('.bridge__mark');
  const [bLabel, bTitle] = [...bridge.querySelectorAll('[data-sq]')].map((e) => e._sq);

  let total = 0, table = [], innerTop = 0;

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
      const gx = person.offsetLeft + glint.offsetLeft + glint.offsetWidth / 2;
      const gy = person.offsetTop + glint.offsetTop + glint.offsetHeight / 2;
      const bTop = docTop(bridge);
      const bH = bridge.offsetHeight;
      const end = docTop(growth);
      const ex = 0.62 * W;
      const pts = [
        [gx, gy],
        [gx + 0.03 * W, gy + 0.2 * H],
        [0.8 * W, bTop + 0.38 * bH],
        [0.76 * W, bTop + 0.74 * bH],
        [ex, end - 0.16 * H],
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
      for (let i = 0; i <= 600; i++) {
        const l = (i / 600) * total;
        const p = core.getPointAtLength(l);
        table.push([l, p.x, p.y]);
      }
      for (const el of [glow, core]) el.style.strokeDasharray = `${total} ${total + 10}`;
      innerTop = docTop(bridgeInner);
    },

    update(s) {
      const H = s.vh;
      // length whose point sits at the target depth below the viewport top
      const target = s.y + 0.8 * H;
      let i = 0;
      while (i < table.length - 1 && table[i][2] < target) i++;
      const [len, x, y] = table[i];
      const shown = s.y > 4 ? len : 0;
      for (const el of [glow, core]) el.style.strokeDashoffset = total - shown;
      const tipOn = shown > 4 && shown < total - 2;
      tip.style.opacity = tipOn ? 1 : 0;
      if (tipOn) {
        tip.setAttribute('cx', x);
        tip.setAttribute('cy', y);
        tip.setAttribute('r', 3.2 + 1.2 * Math.sin(s.t * 6) ** 2);
      }

      // bridge statement writes itself as it rises into view
      const rel = innerTop - s.y;
      const p = invlerp(0.92 * H, 0.38 * H, rel);
      bridgeMark.style.opacity = ease.out(invlerp(0, 0.3, p));
      bridgeMark.style.transform = `translateY(${(1 - ease.out(invlerp(0, 0.3, p))) * 1.5}rem)`;
      bLabel.setProgress(invlerp(0.1, 0.45, p));
      bTitle.setProgress(ease.inOutSine(invlerp(0.25, 1, p)));
      bridgeInner.style.transform = `translateY(${clamp(rel / H - 0.5) * -6}vh)`;
    },
  };
}
