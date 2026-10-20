import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import './styles.css';
import { addScene, setLocator, start, docTop } from './engine.js';
import { mountSquiggles } from './lib/squiggle.js';
import { mountIcons } from './lib/icons.js';
import { invlerp, ease, smoothstep } from './lib/math.js';
import { heroScene } from './scenes/hero.js';
import { dateScene } from './scenes/date.js';
import { threadScene } from './scenes/thread.js';
import { growthScene } from './scenes/growth.js';

mountIcons();
mountSquiggles();

const hero = heroScene();
const growth = growthScene();
addScene(hero);
addScene(dateScene(hero));
addScene(threadScene());
addScene(growth);
addScene(chrome());

setLocator((k) => {
  if (k.at === 'hero') return hero.locate(k);
  if (k.at === 'growth') return growth.locate(k);
  return docTop(document.getElementById(k.at)) + (k.offset ?? 0) * innerHeight;
});

start();

// Fixed page chrome: nav ink, chapter index, film grain, tail teaser.
function chrome() {
  const html = document.documentElement;
  const dots = [...document.querySelectorAll('#chapters span')];
  const grain = document.getElementById('grain');
  const tail = document.getElementById('tail');
  const [tLabel, tTitle] = [...tail.querySelectorAll('[data-sq]')].map((e) => e._sq);
  const tMark = tail.querySelector('.tail__mark');

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

  let tailTop = 0, growthTop = 0;
  return {
    resize() {
      tailTop = docTop(tail);
      growthTop = docTop(document.getElementById('growth'));
    },
    update(s) {
      const H = s.vh;
      const ink = growth.navInk(s);
      const onTail = s.y > tailTop - 0.04 * H;
      const navInk = onTail ? '#2a1a10' : ink || '#f7f0e3';
      html.style.setProperty('--nav-ink', navInk);
      // gold accent darkens on light backgrounds
      const light = onTail || (ink && parseInt(ink.split(',')[0].slice(5), 10) < 120);
      html.style.setProperty('--nav-accent', light ? '#8a6424' : '#c8a04f');
      // frosted bar once content scrolls under the nav; clear over the pinned sky
      const navH = 0.0575 * H;
      const dark = smoothstep(0.02, 0.14, s.y / H) * smoothstep(0, navH, growthTop - s.y);
      const sand = 1 - smoothstep(0, navH, tailTop - s.y);
      html.style.setProperty('--nav-bg', sand > 0 ? `rgba(236,220,190,${0.78 * sand})` : `rgba(18,11,8,${0.7 * dark})`);
      const chapter = onTail ? 4 : s.y >= growthTop ? growth.chapter(s) : hero.progress(s) < 0.2 ? 0 : 1;
      dots.forEach((d, i) => d.classList.toggle('is-on', i === chapter));

      const f = Math.floor(s.t * 24);
      const h = (f * 2654435761) >>> 0;
      grain.style.backgroundPosition = `${h % 220}px ${(h >>> 8) % 220}px`;

      const p = invlerp(0.95 * H, 0.4 * H, tailTop + 0.35 * tail.offsetHeight - s.y);
      tMark.style.opacity = ease.out(invlerp(0, 0.4, p));
      tLabel.setProgress(invlerp(0.15, 0.5, p));
      tTitle.setProgress(ease.inOutSine(invlerp(0.3, 1, p)));
    },
  };
}
