// Export storyboard stills: node stills.mjs [outDir] [scale] [jpg|png]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serve, openPage, frame, resolveY } from './lib.mjs';

const out = path.resolve(process.argv[2] || '../storyboard');
const scale = Number(process.argv[3] || 1);
const ext = process.argv[4] === 'png' ? 'png' : 'jpg';
const SHOTS = [
  { name: '01-hero', y: 0, t: 4.2 },
  { name: '02-hero-scroll', y: 380, t: 5.0 },
  { name: '03-bridge', section: 'bridge', offset: 0.1, t: 6.0 },
  { name: '04-growth-seed', section: 'growth', g: 0.0, t: 7.0 },
  { name: '05-growth-sprout', section: 'growth', g: 0.085, t: 8.0 },
  { name: '06-growth-seedling', section: 'growth', g: 0.24, t: 9.0 },
  { name: '07-growth-young', section: 'growth', g: 0.46, t: 10.0 },
  { name: '08-growth-trunk', section: 'growth', g: 0.7, t: 11.5 },
  { name: '09-growth-mature', section: 'growth', g: 0.985, t: 13.0 },
];

await mkdir(out, { recursive: true });
const server = await serve();
const { browser, page } = await openPage(server.url, { scale });
try {
  const sections = await page.evaluate(() => window.__zr.sections());
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const shot of SHOTS) {
    if (only && !only.some((o) => shot.name.includes(o))) continue;
    const y = resolveY(sections, 1080, shot);
    // warm-up frame so anything clock-driven settles
    await frame(page, y, shot.t - 1 / 60);
    await frame(page, y, shot.t);
    await page.screenshot(ext === 'png' ? { path: path.join(out, `${shot.name}.png`) } : { path: path.join(out, `${shot.name}.jpg`), type: 'jpeg', quality: 92 });
    console.log('wrote', shot.name, 'y=', Math.round(y));
  }
} finally {
  await browser.close();
  server.close();
}
