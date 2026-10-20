// Export storyboard stills: node stills.mjs [outDir] [scale] [jpg|png]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serve, openPage, frame, locate } from './lib.mjs';

const out = path.resolve(process.argv[2] || '../storyboard');
const scale = Number(process.argv[3] || 1);
const ext = process.argv[4] === 'png' ? 'png' : 'jpg';
const SHOTS = [
  { name: '01-hero', at: 'hero', p: 0, t: 4.2 },
  { name: '02a-push-in', at: 'hero', p: 0.16, t: 6.0 },
  { name: '02b-date', at: 'hero', p: 0.4, t: 7.5 },
  { name: '02c-open', at: 'hero', p: 0.66, t: 9.5 },
  { name: '02d-seed', at: 'hero', p: 0.79, t: 10.5 },
  { name: '02e-fall', at: 'hero', p: 0.92, t: 11.2 },
  { name: '03-bridge', at: 'bridge', offset: 0.1, t: 13.0 },
  { name: '03a-night-fall', at: 'growth', q: 0.14, t: 15.0 },
  { name: '03b-landing', at: 'growth', q: 0.33, t: 16.0 },
  { name: '03c-burrow', at: 'growth', q: 0.47, t: 17.0 },
  { name: '03d-soil-cards', at: 'growth', q: 0.95, t: 19.0 },
  { name: '04-growth-sprout', at: 'growth', g: 0.085, t: 21.0 },
  { name: '05-growth-seedling', at: 'growth', g: 0.24, t: 22.0 },
  { name: '06-growth-young', at: 'growth', g: 0.46, t: 23.0 },
  { name: '07-growth-trunk', at: 'growth', g: 0.7, t: 24.5 },
  { name: '08-growth-mature', at: 'growth', g: 0.985, t: 26.0 },
];

await mkdir(out, { recursive: true });
const server = await serve();
const { browser, page } = await openPage(server.url, { scale });
try {
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const ys = await locate(page, SHOTS);
  for (const [i, shot] of SHOTS.entries()) {
    if (only && !only.some((o) => shot.name.includes(o))) continue;
    const y = ys[i];
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
