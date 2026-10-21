// Export storyboard stills: node stills.mjs [outDir] [scale] [jpg|png]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serve, openPage, frame, locate } from './lib.mjs';

const out = path.resolve(process.argv[2] || '../storyboard');
const scale = Number(process.argv[3] || 1);
const ext = process.argv[4] === 'png' ? 'png' : 'jpg';
// one still per stop: the places in the film where a section's copy sits
const SHOTS = [
  { name: '01-hero', at: 'hero', p: 0, t: 4.2 },
  { name: '02-date', at: 'hero', p: 0.47, t: 6.5 },
  { name: '03-soil', at: 'growth', q: 0.95, t: 14.5 },
  { name: '04-growth', at: 'growth', g: 0.98, t: 20.8 },
  { name: '05-water', at: 'water', w: 0.3, t: 24.8 },
  { name: '06-ripening', at: 'ripen', p: 0.6, t: 31.0 },
  { name: '07-harvest', at: 'harvest', h: 0.46, t: 38.5 },
  { name: '08-box', at: 'harvest', h: 1, t: 45.0 },
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
