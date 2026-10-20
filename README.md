# Zubair Riaz Premium Dates: scroll concept film

A concept "website" for a premium date brand. It's built as a real scrolling page and rendered frame by frame into a video that looks like someone slowly scrolling down it. See [PLAN.md](PLAN.md) for the creative direction and scene-by-scene flow.

**Current stage:** Scenes 1–8 are built and run 64s: Hero → the date becomes the seed → planting → growth → water → ripening → harvest → packaging.

## Layout

```
site/        the concept site (Vite, vanilla JS, canvas + SVG; no copy, only squiggles)
  src/engine.js        scroll/clock render loop + capture hooks (window.__zr)
  src/lib/squiggle.js  squiggle "type" that stands in for real text
  src/lib/palm.js      procedural date palm, fronds, roots
  src/lib/landscape.js the palm's world: time-lapse sky, horizon, soil cross-section
  src/lib/date3d.js    3D Ajwa date + seed (three.js), opens in halves
  src/lib/cluster3d.js 3D date bunch that ripens Kimri → Khalal → Rutab → Tamr
  src/lib/studio3d.js  3D studio for harvest + packaging: sickle, basket, gift box, ribbon, seal, tag
  src/scenes/          hero.js (01, pinned) · date.js (02, same stage) · thread.js (falling seed + bridge)
                       growth.js (03 planting + 04 growth, one continuous pinned shot)
                       water.js (05) · ripen.js (06, horizontal panels)
                       harvest.js (07 harvest + 08 packaging, one continuous 3D shot)
                       sections marked .sheet slide up over the pinned stage before them
  public/img/          Zubair cut-out (graded, upscaled)
capture/     Playwright + ffmpeg renderer
  choreography.json    the "human scroll": time → position keyframes
  record.mjs           renders the film
  stills.mjs           renders storyboard stills
storyboard/  exported stills
out/         rendered videos (git-ignored)
```

## Run the site

```bash
cd site && npm install && npm run dev      # http://127.0.0.1:5173
```

## Render

```bash
cd site && npm run build                   # the renderer serves the built site
cd ../capture && npm install
node stills.mjs                            # → storyboard/*.jpg  (node stills.mjs ../storyboard 1 png for PNG)
./film.sh ../out/film.mp4                  # 1920×1080 @ 60fps, in resumable 10s segments
./film.sh ../out/film-4k.mp4 10 --scale 2 --png   # 3840×2160
node record.mjs --from 9 --to 15           # render one part of the timeline directly
```

Every animation is a pure function of scroll position and a virtual clock, so renders are frame-exact and identical every time. If a render is interrupted, run `film.sh` again: finished segments in `out/parts/` are kept, and it resumes with the next one. To change the pacing, edit `capture/choreography.json`, then delete `out/parts/<name>/` so the segments re-render. You never need to re-record by hand. Keys name story beats rather than pixels: `{ "at": "hero", "p": 0.4 }` (hero + date scene), `{ "at": "growth", "q": 0.5 }` (planting), `{ "at": "growth", "g": 0.7 }` (growth), `{ "at": "water", "w": 0.5 }`, `{ "at": "ripen", "p": 0.5 }`, `{ "at": "harvest", "h": 0.5 }`, or `{ "at": "bridge", "offset": 0.4 }`. The page resolves them itself (`window.__zr.locate`).

The 3D date, the date bunch and the studio render through WebGL. Headless Chromium uses SwiftShader for this (the renderer passes `--enable-unsafe-swiftshader`), so frames in those scenes take a little longer to capture.

## Photo

`site/public/img/zubair.webp` is cut out from a frame of one of Zubair's public YouTube thumbnails. It was upscaled 4× with Real-ESRGAN, the background was removed with BiRefNet, and the tee was regraded to the brand's sand tone (a small logo was removed). It's **a placeholder for the concept only**. Public release needs an official photo from Zubair's team, and a higher-res source would also sharpen the 4K render.
