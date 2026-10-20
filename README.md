# Zubair Riaz Premium Dates: scroll concept film

A concept "website" for a premium date brand. It's built as a real scrolling page and rendered frame by frame into a video that looks like someone slowly scrolling down it. See [PLAN.md](PLAN.md) for the creative direction and scene-by-scene flow.

**Current stage:** Phase 1 style frame (Hero → bridge → Growth).

## Layout

```
site/        the concept site (Vite, vanilla JS, canvas + SVG; no copy, only squiggles)
  src/engine.js        scroll/clock render loop + capture hooks (window.__zr)
  src/lib/squiggle.js  squiggle "type" that stands in for real text
  src/lib/palm.js      procedural date palm, fronds, roots
  src/scenes/          one module per scene
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
node stills.mjs                            # → storyboard/*.png
node record.mjs --out ../out/film.mp4      # 1920×1080 @ 60fps
node record.mjs --scale 2 --png --out ../out/film-4k.mp4   # 3840×2160
node record.mjs --from 9 --to 15           # render part of the timeline
```

Every animation is a pure function of scroll position and a virtual clock, so renders are frame-exact and identical every time. To change the pacing, edit `capture/choreography.json`. You never need to re-record by hand.

## Photo

`site/public/img/zubair.webp` is cut out from a frame of one of Zubair's public YouTube thumbnails. It was upscaled 4× with Real-ESRGAN, the background was removed with BiRefNet, and the tee was regraded to the brand's sand tone (a small logo was removed). It's **a placeholder for the concept only**. Public release needs an official photo from Zubair's team, and a higher-res source would also sharpen the 4K render.
