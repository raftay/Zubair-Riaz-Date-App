// Shared capture helpers: serve the built site and open it in capture mode.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SITE = path.resolve(here, '../site');
const PORT = Number(process.env.PORT || 4173);

export async function serve() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: SITE, stdio: 'ignore' });
  let exited = null;
  proc.on('exit', (c) => (exited = c));
  // vite prints nothing without a TTY, so poll until it answers
  for (let i = 0; ; i++) {
    if (exited !== null) throw new Error('vite preview exited ' + exited);
    if (i > 200) throw new Error('vite preview did not start');
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return { url: `http://127.0.0.1:${PORT}/?capture`, close: () => proc.kill() };
}

export async function openPage(url, { width = 1920, height = 1080, scale = 1 } = {}) {
  const browser = await chromium.launch({ args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__zr && window.__zr.ready);
  return { browser, page };
}

// Render one exact frame (scroll y, clock t) and wait for it to paint.
export async function frame(page, y, t) {
  await page.evaluate(
    ([y, t]) =>
      new Promise((r) => {
        window.__zr.frame(y, t);
        requestAnimationFrame(() => requestAnimationFrame(r));
      }),
    [y, t],
  );
}

// Map a named position to a document scroll y.
export function resolveY(sections, vh, shot) {
  if (shot.y !== undefined) return shot.y;
  const s = sections.find((x) => x.id === shot.section);
  if (shot.g !== undefined) {
    const range = s.height - vh;
    return s.top + (0.02 + shot.g * 0.95) * range;
  }
  return s.top + (shot.offset ?? 0) * vh;
}
