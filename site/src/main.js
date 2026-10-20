import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import './styles.css';
import { addScene, setLocator, start, docTop } from './engine.js';
import { mountSquiggles } from './lib/squiggle.js';
import { mountIcons } from './lib/icons.js';
import { smoothstep, hex, luma } from './lib/math.js';
import { heroScene } from './scenes/hero.js';
import { dateScene } from './scenes/date.js';
import { threadScene } from './scenes/thread.js';
import { growthScene } from './scenes/growth.js';
import { waterScene } from './scenes/water.js';
import { ripenScene } from './scenes/ripen.js';
import { harvestScene } from './scenes/harvest.js';

mountIcons();
mountSquiggles();

const hero = heroScene();
const growth = growthScene();
const water = waterScene();
const ripen = ripenScene();
const harvest = harvestScene();
addScene(hero);
addScene(dateScene(hero));
addScene(threadScene());
addScene(growth);
addScene(water);
addScene(ripen);
addScene(harvest);
addScene(chrome());

const locators = { hero, growth, water, ripen, harvest };
setLocator((k) => {
  if (locators[k.at] && k.offset === undefined) return locators[k.at].locate(k);
  return docTop(document.getElementById(k.at)) + (k.offset ?? 0) * innerHeight;
});

start();

// Fixed page chrome: nav ink + bar, chapter index, film grain. Each section
// declares data-ink / data-navbg / data-chapter (pinned scenes update theirs);
// the section under the nav wins, the later one when a sheet overlaps.
function chrome() {
  const html = document.documentElement;
  const dots = [...document.querySelectorAll('#chapters span')];
  const grain = document.getElementById('grain');
  const sections = [...document.querySelectorAll('[data-scene]')];
  let spans = [];

  // 220px noise tile, generated once
  const c = document.createElement('canvas');
  c.width = c.height = 220;
  const g = c.getContext('2d');
  const img = g.createImageData(220, 220);
  let seed = 1;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed % 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grain.style.backgroundImage = `url(${c.toDataURL()})`;

  const BARS = { dark: [18, 11, 8, 0.7], sand: [236, 220, 190, 0.78] };

  return {
    resize() {
      spans = sections.map((el) => ({ el, top: docTop(el), bottom: docTop(el) + el.offsetHeight }));
    },
    update(s) {
      const H = s.vh;
      const navH = 0.0575 * H;
      const probe = s.y + navH / 2;
      let cur = spans[0];
      for (const sp of spans) if (probe >= sp.top && probe < sp.bottom) cur = sp;
      const d = cur.el.dataset;
      const ink = d.ink || '#f7f0e3';
      html.style.setProperty('--nav-ink', ink);
      const light = luma(ink.startsWith('#') ? hex(ink) : ink.match(/\d+/g).slice(0, 3).map(Number)) < 0.5;
      html.style.setProperty('--nav-accent', light ? '#8a6424' : '#c8a04f');
      // frosted bar once content scrolls under the nav (fades in at the very top of the page)
      const bar = BARS[d.navbg];
      const a = bar ? bar[3] * (cur === spans[0] ? smoothstep(0.02, 0.14, s.y / H) : smoothstep(0, navH, s.y + navH - cur.top)) : 0;
      html.style.setProperty('--nav-bg', bar ? `rgba(${bar[0]},${bar[1]},${bar[2]},${a})` : 'transparent');
      const chapter = Number(d.chapter || 0);
      dots.forEach((dot, i) => dot.classList.toggle('is-on', i === chapter));

      const f = Math.floor(s.t * 24);
      const h = (f * 2654435761) >>> 0;
      grain.style.backgroundPosition = `${h % 220}px ${(h >>> 8) % 220}px`;
    },
  };
}
