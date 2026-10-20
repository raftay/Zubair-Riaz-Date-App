// Render engine. Every scene's update() is a pure function of (scrollY, time),
// so the capture script can step through frames exactly: it calls
// window.__zr.frame(y, t) and screenshots. In the live page a rAF loop feeds
// real scroll + clock into the same path.
const scenes = [];
export const state = { y: 0, t: 0, vw: 1920, vh: 1080, dpr: 1 };
const params = new URLSearchParams(location.search);
export const CAPTURE = params.has('capture');

export function addScene(scene) {
  scenes.push(scene);
}

// Absolute document top of an element (stable while scrolling, unlike getBoundingClientRect).
export function docTop(el) {
  let y = 0;
  while (el) {
    y += el.offsetTop;
    el = el.offsetParent;
  }
  return y;
}

function measure() {
  state.vw = window.innerWidth;
  state.vh = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 3);
  for (const s of scenes) s.resize?.(state);
}

export function render() {
  for (const s of scenes) s.update(state);
}

let t0 = null;
function loop(now) {
  if (t0 === null) t0 = now;
  state.t = (now - t0) / 1000;
  state.y = window.scrollY;
  render();
  requestAnimationFrame(loop);
}

async function assetsReady() {
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((img) => (img.complete ? img.decode().catch(() => {}) : new Promise((r) => (img.onload = img.onerror = r)))),
  );
}

export async function start() {
  history.scrollRestoration = 'manual';
  await assetsReady();
  measure();
  window.addEventListener('resize', () => {
    measure();
    render();
  });
  if (CAPTURE) document.documentElement.classList.add('is-capture');
  else requestAnimationFrame(loop);

  window.__zr = {
    ready: true,
    frame(y, t) {
      window.scrollTo(0, y);
      state.y = window.scrollY;
      state.t = t;
      render();
    },
    maxScroll: () => document.documentElement.scrollHeight - window.innerHeight,
    // Document positions of each section, for writing scroll choreography.
    sections: () =>
      [...document.querySelectorAll('[data-scene]')].map((el) => ({
        id: el.id,
        top: docTop(el),
        height: el.offsetHeight,
      })),
  };
}
