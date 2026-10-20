// Squiggle "type": cursive-looking strokes that stand in for real copy.
// Each letter is one turn of a trochoid (x = a·t + c·sin t). When c > a the
// stroke loops back over itself like a cursive l/e; when c < a it's a hump
// like m/n. Words are separate paths so they can be written one after another.
import { rng } from './rand.js';
import { TAU, clamp } from './math.js';

const NS = 'http://www.w3.org/2000/svg';
const REM = 16; // design px per rem at 1920 wide

const STYLES = {
  display: { xh: 23, adv: 21, loops: 0.42, tall: 0.2, stroke: 4.6, lh: 86, slant: 0.2, word: [3, 7], gap: 26, steps: 18 },
  title: { xh: 14, adv: 14, loops: 0.36, tall: 0.18, stroke: 3, lh: 54, slant: 0.18, word: [3, 7], gap: 17, steps: 16 },
  body: { xh: 6.2, adv: 8.6, loops: 0.12, tall: 0.12, stroke: 1.55, lh: 27, slant: 0.12, word: [2, 7], gap: 10, steps: 10 },
  label: { xh: 4.6, adv: 7.4, loops: 0, tall: 0.04, stroke: 1.5, lh: 16, slant: 0, word: [3, 6], gap: 10, steps: 9 },
};

function word(r, st, x, base, maxX) {
  const pts = [];
  const letters = Math.round(r.range(st.word[0], st.word[1]));
  for (let i = 0; i < letters; i++) {
    const tall = r() < st.tall;
    const h = st.xh * (tall ? r.range(1.75, 2.05) : r.range(0.78, 1.12));
    const adv = st.adv * r.range(0.78, 1.18);
    if (x + adv > maxX && i > 1) break;
    const a = adv / TAU;
    const c = a * (tall || r() < st.loops ? r.range(1.25, 1.9) : r.range(0.25, 0.8));
    for (let k = i === 0 ? 0 : 1; k <= st.steps; k++) {
      const t = (k / st.steps) * TAU;
      const y = base - (h * (1 - Math.cos(t))) / 2;
      pts.push([x + a * t + c * Math.sin(t) + st.slant * (base - y), y]);
    }
    x += adv;
  }
  // short exit flick
  const last = pts[pts.length - 1];
  pts.push([last[0] + st.adv * 0.35, last[1] - st.xh * 0.35]);
  return { pts, x };
}

const toPath = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');

export function squiggle(kind, { width, lines = 1, seed = 1, last = 0.62, align = 'left' } = {}) {
  const st = STYLES[kind];
  const r = rng(seed * 7919 + kind.length);
  const pad = st.stroke + st.adv;
  const rows = [];
  for (let li = 0; li < lines; li++) {
    const lw = lines > 1 && li === lines - 1 ? width * last * r.range(0.9, 1.1) : width * r.range(0.9, 1);
    const base = li * st.lh + st.lh * 0.74;
    const words = [];
    let x = pad;
    while (x < lw - st.adv * 2) {
      const w = word(r, st, x, base, lw);
      words.push(w.pts);
      x = w.x + st.gap * r.range(0.8, 1.25);
    }
    rows.push({ words, w: x - st.gap });
  }
  const W = width + pad * 2;
  const H = lines * st.lh;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W.toFixed(0)} ${H}`);
  svg.setAttribute('class', `sq sq--${kind}`);
  svg.style.width = W / REM + 'rem';
  svg.style.height = H / REM + 'rem';
  const paths = [];
  for (const row of rows) {
    const dx = align === 'center' ? (W - row.w) / 2 - pad : 0;
    for (const pts of row.words) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', toPath(dx ? pts.map(([x, y]) => [x + dx, y]) : pts));
      p.setAttribute('pathLength', '1');
      p.setAttribute('stroke-width', st.stroke);
      svg.appendChild(p);
      paths.push(p);
    }
  }
  let prev = -1;
  const setProgress = (prog) => {
    prog = clamp(prog);
    if (prog === prev) return;
    prev = prog;
    const n = paths.length;
    const spread = 2.2;
    for (let i = 0; i < n; i++) {
      const local = clamp((prog * (n + spread) - i) / spread);
      const p = paths[i];
      p.style.opacity = local > 0.002 ? 1 : 0;
      p.style.strokeDashoffset = 1 - local;
    }
  };
  setProgress(0);
  return { el: svg, setProgress };
}

// Build every <i data-sq="kind" data-w="rem" ...> placeholder inside root.
export function mountSquiggles(root = document) {
  const out = [];
  let auto = 1;
  root.querySelectorAll('[data-sq]').forEach((el) => {
    const d = el.dataset;
    const sq = squiggle(d.sq, {
      width: parseFloat(d.w || 20) * REM,
      lines: parseInt(d.lines || 1, 10),
      seed: parseInt(d.seed || auto++, 10),
      last: parseFloat(d.last || 0.62),
      align: d.align || 'left',
    });
    el.appendChild(sq.el);
    el._sq = sq;
    out.push(el);
  });
  return out;
}
