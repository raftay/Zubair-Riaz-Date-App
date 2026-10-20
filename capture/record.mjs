// Render the scroll film frame by frame and stream it into ffmpeg.
//   node record.mjs [--out ../out/film.mp4] [--scale 1|2] [--from s] [--to s] [--png]
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { serve, openPage, frame, locate } from './lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] ?? true : d;
};
const out = path.resolve(arg('out', '../out/film.mp4'));
const scale = Number(arg('scale', 1));
const png = process.argv.includes('--png');
const chore = JSON.parse(await readFile(new URL('./choreography.json', import.meta.url)));
const fps = chore.fps;

// Fritsch–Carlson monotone cubic: smooth, never overshoots, stops cleanly on holds.
function monotone(xs, ys) {
  const n = xs.length;
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = 0;
  m[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const server = await serve();
const { browser, page } = await openPage(server.url, { scale });
try {
  const curve = monotone(chore.keys.map((k) => k.t), await locate(page, chore.keys));
  const end = chore.keys[chore.keys.length - 1].t;
  const from = Number(arg('from', 0));
  const to = Math.min(Number(arg('to', end)), end);
  const first = Math.round(from * fps), last = Math.round(to * fps);

  await mkdir(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', png ? 'png' : 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', scale > 1 ? '14' : '16', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));

  const t0 = Date.now();
  for (let i = first; i <= last; i++) {
    const t = i / fps;
    await frame(page, Math.round(curve(t) * scale) / scale, t);
    const buf = await page.screenshot(png ? { type: 'png' } : { type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((i - first) % 120 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`frame ${i - first}/${last - first}  ${el.toFixed(0)}s elapsed`);
    }
  }
  ff.stdin.end();
  await done;
  console.log('wrote', out);
} finally {
  await browser.close();
  server.close();
}
