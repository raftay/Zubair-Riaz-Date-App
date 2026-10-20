# Zubair Riaz Premium Dates — Scroll Concept Film

**Project plan & design flow** · v1

> **Status:** All §9 decisions are locked to the defaults. **Phase 1 style frame: approved.** **Scenes 2 and 3 are built**, so scenes 1–4 now run as one film:
> - The pinned hero pushes into the date, which becomes a real-time 3D Ajwa date, opens, and lets its seed fall.
> - The seed rides the golden thread past the bridge statement.
> - Planting and growth are one continuous pinned shot: night fall, landing, burrowing, and the soil probes and cards, then the sprout.
>
> **Next:** 05 Water.

---

## 1. What we're making

A concept video, about 85–95 seconds long, that looks like someone slowly scrolling down a high-end brand website for **Zubair Riaz Premium Dates** (a working name). It is concept art, not a working store. The page tells one continuous story from top to bottom:

> Zubair holding a date → the date becomes a seed → planted in tracked soil → the palm grows → it is watered → the dates ripen → harvest & hand-selection → packed in a luxury box → shipped across the world → you scan the box and see the whole journey.

There is no real copy. Wherever a real site would have text, we draw **animated squiggle lines** shaped like headings, paragraphs, labels and buttons. The brand wordmark is the only exception (see Decisions).

### Core idea: "One unbroken golden thread"
The brand promise is traceability: they track everything from the soil to the water. We show that visually with **one continuous gold line** that runs down the whole page:

- It starts as the glint on the date in Zubair's hand
- It becomes the seed's path into the ground, then the **root**
- It traces up the **trunk** as the palm grows
- It turns into the **water stream** feeding the roots
- It becomes the **ribbon** that seals the box
- It ends as the **shipping arc** across the globe, landing at a customer's door

One line runs from soil to your door. It holds the whole film together and *is* the brand idea.

---

## 2. Deliverables

| # | Deliverable | Notes |
|---|---|---|
| 1 | **Master video**: 16:9, 1920×1080 @ 60fps, H.264 MP4 | Preview renders during development |
| 2 | **Final video**: 3840×2160 (4K) @ 60fps | Same page, rendered at 2× pixel density |
| 3 | *(Optional)* **Vertical cut**: 9:16, 1080×1920 | Mobile layout of the same site, for Shorts/Reels/TikTok |
| 4 | **Live HTML concept site** | Can be scrolled for real in a browser and demoed live |
| 5 | **Storyboard stills** | One high-res PNG per scene, for decks and thumbnails |

The video is silent by default so music and voiceover can be added in editing.

---

## 3. Creative direction

### Mood
Quiet luxury: dark, warm, cinematic. Think a premium watch or fragrance site, with the warmth of Madinah at golden hour. There is plenty of empty space, the camera moves slowly, and nothing feels busy.

### Palette
| Token | Hex | Used for |
|---|---|---|
| Ajwa Black | `#120B08` | Primary background (hero, packaging, footer) |
| Date Brown | `#3B2416` | Soil, deep sections |
| Rutab Amber | `#A8642A` | Ripening dates, warm highlights |
| Desert Sand | `#E8D9BD` | Sky, light sections |
| Cream | `#F7F0E3` | Light section backgrounds |
| Foil Gold | `#C8A04F` (gradient `#F3D88E → #9C7430`) | The golden thread, foil, logo, accents |
| Palm Green | `#4A5E3A` | Fronds, young dates (Kimri stage) |
| Oasis Teal | `#5E9C9A` | Water only, so it reads instantly |

Sections alternate between dark and light so the scroll has a rhythm: *dark hero → soil → dawn sky → sand/water → cream ripening → golden-hour harvest → black-and-gold packaging → night globe → cream traceability → black footer.*

### Typography (wordmark only)
- A high-contrast serif for the wordmark (e.g. Cormorant Garamond / Playfair Display), set in wide-spaced capitals: **ZUBAIR RIAZ · PREMIUM DATES**
- Everything else is squiggles

### The squiggle "type" system
Squiggles are generated as SVG paths so they look like real layout, not random scribbles:

| Role | Looks like |
|---|---|
| `display` | 1–2 thick, looping, calligraphic gold strokes (a headline) |
| `body` | 3–4 thin wavy lines, with the last line about 60% wide (a paragraph) |
| `label` | A short small squiggle with a leading dot (an eyebrow or caption) |
| `button` | A pill outline with a short squiggle inside |
| `data` | A tiny squiggle next to a **real graphic**: sparkline, gauge, ring chart or bar (for the traceability cards) |

Each squiggle **draws itself on** (a stroke animation) as its section scrolls into view, so it feels like text appearing.

### Texture & finish
- A subtle film grain over the whole page, so it doesn't look like flat vector art
- Soft vignettes, light-ray gradients and depth-of-field blur on background layers
- Gold uses an animated foil gradient, so it catches the light as you scroll

### Motion principles
- **Everything is driven by scroll.** Scenes scrub forward as you scroll, like flipping through a time-lapse
- **Pinned scenes.** Big moments (growth, ripening, packaging, globe) lock to the screen while the scroll drives the animation, then release
- **Parallax depth** in every scene: 3–5 layers moving at different speeds
- **Human scroll feel** in the video: eased starts and stops, short pauses on hero moments, never a robotic constant speed

---

## 4. Design flow, scene by scene

Times are approximate, from a target total of about 90s. Pacing is set later in one config file (see §5).

| # | Scene | Time | Behaviour |
|---|---|---|---|
| 1 | Hero: Zubair with the date | 0:00–0:07 | Static, then parallax |
| 2 | Date → seed transition | 0:07–0:12 | Pinned zoom |
| 3 | Planting: the soil | 0:12–0:20 | Pinned |
| 4 | Growth: the palm rises | 0:20–0:31 | Pinned (long) |
| 5 | Water | 0:31–0:39 | Scroll-through |
| 6 | Ripening: 4 stages | 0:39–0:50 | Pinned horizontal scroll |
| 7 | Harvest & hand-selection | 0:50–0:58 | Scroll-through |
| 8 | Packaging: the box | 0:58–1:07 | Pinned |
| 9 | Shipping: the globe | 1:07–1:17 | Pinned |
| 10 | Traceability: scan your box | 1:17–1:24 | Scroll-through |
| 11 | Collection, Zubair's sign-off, footer | 1:24–1:35 | Scroll-through, final hold |

### Scene 1: Hero (Zubair holding a date)
- **Layout:** full-screen, Ajwa Black background with a warm spotlight. Zubair is cut out from his photo background and stands on the right two-thirds, holding a single glossy date toward the camera. A large `display` squiggle (the headline) and a `body` squiggle sit on the left, with a gold `button` below them.
- **Nav bar:** a small gold logo mark (a stylised date seed) and the wordmark on the left. Squiggle nav items and a pill "shop" button sit on the right, over a frosted-glass bar.
- **Motion:** Zubair, the background glow and the dust particles move at different parallax depths. The date in his hand catches a slow **gold glint** that sweeps across it; this is the first appearance of the golden thread. A small scroll cue pulses at the bottom.
- **Out:** as the scroll begins, the camera pushes in on the date.

### Scene 2: The date becomes the seed
- **Pinned.** The view zooms into the date until it fills the screen. Zubair fades and blurs away, and the date "opens" in an elegant cutaway to reveal the **seed** inside.
- The seed detaches and **falls** down the screen, trailing the golden thread. The background shifts from black to deep Date Brown.
- **Out:** the seed drops below a horizon line into the earth.

### Scene 3: Planting (the soil)
- **Pinned soil cross-section.** Layered strata: fine sand on top, then darker loam, then mineral-flecked bedrock. Small particles drift in the layers.
- The seed settles. Soil grains fall in and cover it, and a soft pulse radiates out.
- **Traceability cards** slide in from the side, glassy panels showing `label` + `data` squiggles: a **pH gauge**, a **mineral ring chart** and a **soil-moisture bar**. This is "we track the soil", told without words.
- The golden thread grows down out of the seed as the **first root**.
- **Out:** a tiny green sprout breaks the surface, and the camera starts tilting upward.

### Scene 4: Growth (the palm rises)
- **Pinned, long scene. It's the centrepiece.** Scrolling *grows* the date palm: sprout → sapling → young palm → full mature palm, with its crown of arching fronds and textured diamond-pattern trunk.
- Underground, the roots spread out in gold-traced lines (a split view: earth below, sky above).
- **Time-lapse sky:** the sun arcs across, days pass in light/shadow sweeps, and the sky moves from pre-dawn indigo to Desert Sand. A thin **years ring** in the corner fills as the palm matures.
- The golden thread runs up the trunk as it grows.
- **Out:** the camera settles at mid-trunk height for the water scene.

### Scene 5: Water
- Drip-irrigation lines run along the ground; **Oasis Teal droplets** form, fall and soak in. Ripples spread and the soil darkens where the water lands.
- Cut down below ground: the water travels down the root (the golden thread briefly glows teal), up through the trunk, and out to the fronds, which lift and brighten.
- A **water-log card** (a sparkline of daily litres, plus `data` squiggles) floats in. This is "we track every drop".
- **Out:** the camera rises up the trunk to the crown.

### Scene 6: Ripening (the four real stages)
- **Pinned horizontal scroll.** Scrolling down moves the page sideways through four panels. Each shows a hanging date cluster up close, with a `label` + `body` squiggle:
  1. **Kimri**: hard, green
  2. **Khalal**: crisp, yellow-red
  3. **Rutab**: half-soft, turning amber-brown
  4. **Tamr**: fully ripe, deep near-black, wrinkled skin (Ajwa-style)
- The dates **morph colour and texture** between panels, so it plays as one continuous ripening. Backgrounds warm from cream to amber.
- A progress rail along the bottom marks the four stages.
- **Out:** the last panel holds on a perfect Tamr cluster in golden-hour light.

### Scene 7: Harvest & hand-selection
- A harvester's gloved hand and a curved blade cut the cluster. It lowers into a **woven palm-leaf basket**, and the dates tumble in with weight and bounce.
- The basket empties onto a sorting surface. One by one, **hand-selected** dates are lifted out; imperfect ones slide away.
- A single perfect date rises onto a pedestal and **rotates slowly** under studio light, like a hero product shot. A batch-ID chip (`label` squiggle + a small barcode graphic) appears beside it.
- **Out:** the date floats down toward an open box below.

### Scene 8: Packaging (the box)
- **Pinned.** The scene turns Ajwa Black and gold. A **luxury box**: matte black with gold-foil edges and an embossed logo mark. It sits open, shown in real 3D with soft studio lighting.
- Dates drop into the grid of compartments one at a time, with satisfying little settles.
- The lid swings closed, and the golden thread wraps around it as a **ribbon**. A **wax-seal** stamp presses down.
- A **traceability tag** with a QR-style graphic is tied on.
- The box makes a slow 3/4 turn so the foil catches the light.
- **Out:** the box lifts and shrinks into the night sky.

### Scene 9: Shipping (around the world)
- **Pinned.** A dark, elegant **3D globe** with fine gold coastlines and a gentle rotation. A glowing point marks **Madinah**.
- Gold arcs launch from Madinah and land one after another in **London, New York, Toronto, Karachi, Lahore, Dubai, Istanbul, Kuala Lumpur, Jakarta, Sydney and Johannesburg**. Each landing gives off a small pulse ring.
- Tiny plane and ship glyphs travel along a few of the arcs. A counter-style `data` graphic (dots filling up) shows reach.
- **Out:** the camera follows one arc down to a front door, and the box lands on a doorstep.

### Scene 10: Traceability (scan your box)
- **Cream section.** A phone mockup scans the box's tag, and the screen shows the **date's full journey** as a vertical timeline: soil card → water card → ripening stage → harvest date → packing → shipping. The icons and mini-graphics echo every scene above, with squiggles as the text.
- This is the payoff: "you can see everything your date went through".

### Scene 11: Collection, Zubair's sign-off, footer
- **Collection grid:** three boxes (for example Ajwa, Sukkari and Safawi variants), each with a `label` squiggle (name), a `body` squiggle and a `button`. They lift gently on scroll.
- **Sign-off:** a second, warmer photo of Zubair (or a close crop of the hero photo) beside a large quote-style `display` squiggle. A **signature** draws itself in gold.
- **Footer:** Ajwa Black, with squiggle link columns, a newsletter `button` and a giant faded wordmark across the bottom.
- **End:** the golden thread arrives and forms the logo mark. Hold for 2s, then fade.

---

## 5. Technical approach

### Build stack
- **Vite + vanilla JS**: a fast, simple static site with no framework overhead
- **GSAP + ScrollTrigger**: scroll-scrubbed timelines and pinning (all GSAP plugins are free to use)
- **Inline SVG**: illustrations (soil, palm, roots, water, dates, basket, hands, squiggles), all built in code so they stay sharp at 4K
- **Three.js**: the packaging box and the globe, where real lighting makes the gold foil look premium
- **d3-geo + world-atlas TopoJSON**: accurate coastlines for the globe
- **Procedural generators**: a `squiggle()` function (§3) and a `palm()` function that builds the tree at any growth stage from a single 0→1 value

### How the video gets rendered (deterministic capture)
A screen recording would drop frames and stutter, so instead we **render the video frame by frame**:

1. Every animation on the page is a pure function of **scroll position** and a **virtual clock**. Ambient motion such as frond sway, shimmer and grain reads the virtual clock, not real time.
2. A **choreography file** (`capture/choreography.json`) describes the "human scroll": keyframes of *time → scroll position*, with eased moves and holds. Changing the pacing means editing this one file.
3. **Playwright + headless Chromium** (already installed here) opens the page. For each frame it sets the scroll position, advances the virtual clock by 1/60s, waits for paint and takes a screenshot.
4. Screenshots stream straight into **ffmpeg**, which encodes the MP4 (H.264, high quality, `yuv420p` so it plays everywhere). Optionally we also export ProRes for editors.
5. 4K uses the same run at `deviceScaleFactor: 2`.

Every render is identical and perfectly smooth at 60fps, and re-timing never needs a new recording.

### Planned project structure
```
/site
  index.html
  /src
    main.js                 scroll engine, virtual clock, capture hooks
    /scenes                 one module per scene (hero, seed, soil, growth, water,
                            ripening, harvest, packaging, globe, trace, footer)
    /lib                    squiggle.js, palm.js, thread.js (golden thread), grain.js
    /styles
  /assets/img               Zubair photo(s), cutouts
/capture
  record.mjs                Playwright frame-by-frame capture → ffmpeg
  choreography.json         scroll timing keyframes
/storyboard                 exported stills per scene
/out                        rendered videos (git-ignored)
PLAN.md
```

---

## 6. Assets & sourcing

| Asset | Source |
|---|---|
| **Zubair photo (hero)** | See below |
| Palm, soil, water, dates, basket, hands, box, globe | **Built in code** (SVG / Three.js), so there are no licensing issues and everything stays sharp at any resolution |
| Coastlines | world-atlas (open data) |
| Fonts | Google Fonts (open licence) |

### The Zubair photo
- **Best option:** an **official high-resolution photo** from Zubair or his team (at least 3000px on the long edge), ideally of him **holding a date**, or holding something we can swap a date into. Shot on a plain background is ideal.
- **Fallback (to start now):** we source the best publicly available image of him (channel art, video thumbnails, socials), cut him out of the background and composite a rendered date into his hand if needed. This works for a **pitch or concept**. For **public release**, the photo should come from or be approved by his team, and public images are usually too low-res for a clean 4K hero.

---

## 7. Production phases & checkpoints

| Phase | Work | Review checkpoint |
|---|---|---|
| **0** | Lock decisions (§9), source the photo | You confirm the plan |
| **1** | **Style frame**: build the hero and one journey scene (Growth) to final quality, and export stills | ✅ **You approve the look** before we build the rest |
| **2** | Site skeleton, scroll engine, virtual clock, squiggle system, golden thread | — |
| **3** | Scenes 2–9 (the journey) | — |
| **4** | Scenes 10–11 (trace, collection, sign-off, footer) | — |
| **5** | Capture pipeline, scroll choreography, **1080p preview render** | ✅ **You review the preview video** (pacing, scenes) |
| **6** | Polish pass, final **4K render**, storyboard stills, optional vertical cut | ✅ Final delivery |

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| No good public photo of Zubair holding a date | Composite a rendered date into his hand; ask his team for an official shot |
| Public photos are too low-res for 4K | Use a 1080p master until an official photo arrives; the hero layout is designed so the photo doesn't need to fill all 4K pixels |
| Illustrated look reads as "cartoon" rather than premium | Restrained palette, grain, depth of field, real 3D lighting on the hero objects, and the Phase 1 style-frame approval before scaling up |
| 3D (WebGL) is slow in headless rendering | Rendering is frame-by-frame, so speed doesn't affect smoothness; CSS-3D or canvas fallbacks exist if needed |
| Video runs long | All timing lives in `choreography.json`, so we can trim to 60s or make a 30s social cut without rebuilding |

---

## 9. Decisions needed (defaults in **bold**)

1. **Photo:** Can you get an official high-res photo of Zubair, ideally holding a date? → **Default: I source a public placeholder for the concept**
2. **Visual style:**
   - **A: Premium illustrated / 3D**, built entirely in code (recommended, and fully buildable here)
   - B: Photoreal. This needs you to supply AI-generated or stock image sequences for each stage, which I'd wire in as scroll-scrubbed frames
3. **Wordmark:** **Show "ZUBAIR RIAZ · PREMIUM DATES" as real text in the logo only; squiggles everywhere else** / squiggles even for the logo
4. **Formats:** **1080p60 preview → 4K60 final**; also a 9:16 vertical cut? (**optional, after the main film**)
5. **Framing:** **Full-bleed website** / shown inside a browser-window mockup
6. **Length:** **~90s** / tighter ~60s
7. **Hero product angle:** **Madinah Ajwa as the signature date** (fits Zubair's Madinah connection) / a neutral mixed selection
