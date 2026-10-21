// 07–08 · Harvest → selection → packaging, as one continuous 3D studio shot
// (three.js). Everything is a pure function of the section progress h (0..1)
// plus the virtual clock t, so the capture can step through it frame by frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rng } from './rand.js';
import { clamp, lerp, invlerp, smoothstep, ease, keys } from './math.js';
import { buildBunch, poseBunch, datesMesh, setRipeness, DATE_LEN } from './cluster3d.js';
import { ajwaDate } from './date3d.js';

const F = -11; // studio floor
const BOX = new THREE.Vector3(9, F, 0); // gift box sits here on the floor
const BW = 4.4, BD = 3.3, BH = 0.85; // box width (x), depth (z), height (y)
const HERO_AT = new THREE.Vector3(0, F + 3.55, 1.0); // where the chosen date is inspected
const H_CUT = 0.115; // the sickle meets the stalk

const N_HEAP = 90, N_RAIN = 24, N_BOX = 11;
const SLOT = (i) => new THREE.Vector3(-1.5 + (i % 4), 0, -1 + Math.floor(i / 4)); // 4 × 3 compartments; slot 11 is the hero's

function canvasTex(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// woven palm-leaf strips for the basket
const weave = () =>
  canvasTex(1024, 256, (c, w, h) => {
    const r = rng(12);
    c.fillStyle = '#8a6532';
    c.fillRect(0, 0, w, h);
    const sw = 32, sh = 16;
    for (let y = 0; y < h; y += sh) {
      for (let x = 0; x < w; x += sw) {
        const over = ((x / sw + y / sh) & 1) === 0;
        const g = c.createLinearGradient(x, y, over ? x + sw : x, over ? y : y + sh);
        const base = over ? [196, 152, 86] : [158, 116, 60];
        const k = 0.85 + r() * 0.3;
        g.addColorStop(0, `rgb(${base.map((v) => Math.min(255, v * k * 0.8)).join(',')})`);
        g.addColorStop(0.5, `rgb(${base.map((v) => Math.min(255, v * k * 1.05)).join(',')})`);
        g.addColorStop(1, `rgb(${base.map((v) => Math.min(255, v * k * 0.75)).join(',')})`);
        c.fillStyle = g;
        c.fillRect(x + 1, y + 1, sw - 2, sh - 2);
      }
    }
  });

// a radial pool of shadow for objects sitting on the floor
const shadowTex = () =>
  canvasTex(256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  });

// gold-foil wordmark for the lid (drawn once fonts are ready)
const logoTex = () =>
  canvasTex(1024, 440, (c, w, h) => {
    c.fillStyle = '#fff';
    c.strokeStyle = '#fff';
    c.textAlign = 'center';
    // seed mark
    c.lineWidth = 7;
    c.beginPath();
    c.ellipse(w / 2, 92, 34, 66, 0, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(w / 2, 46);
    c.quadraticCurveTo(w / 2 + 7, 92, w / 2, 138);
    c.stroke();
    c.font = '600 112px "Cormorant Garamond", Georgia, serif';
    c.letterSpacing = '30px';
    c.fillText('ZUBAIR RIAZ', w / 2 + 15, 290);
    c.font = '500 40px "Cormorant Garamond", Georgia, serif';
    c.letterSpacing = '26px';
    c.fillText('PREMIUM DATES', w / 2 + 13, 370);
    c.fillRect(w / 2 - 160, 316, 320, 3);
  });

// cream tag: QR-style code, a seed mark and squiggle "copy"
const tagTex = () =>
  canvasTex(640, 400, (c, w, h) => {
    const r = rng(77);
    c.fillStyle = '#efe4cc';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b8954e';
    c.lineWidth = 6;
    c.strokeRect(14, 14, w - 28, h - 28);
    const n = 25, cell = 10, ox = 44, oy = 76;
    c.fillStyle = '#24170e';
    const finder = (x, y) => {
      c.fillRect(ox + x * cell, oy + y * cell, 7 * cell, 7 * cell);
      c.fillStyle = '#efe4cc';
      c.fillRect(ox + (x + 1) * cell, oy + (y + 1) * cell, 5 * cell, 5 * cell);
      c.fillStyle = '#24170e';
      c.fillRect(ox + (x + 2) * cell, oy + (y + 2) * cell, 3 * cell, 3 * cell);
    };
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
        if (!inFinder && r() < 0.48) c.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    finder(0, 0);
    finder(n - 7, 0);
    finder(0, n - 7);
    // seed mark + squiggles
    c.strokeStyle = '#8a6424';
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(420, 106, 14, 26, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#3b2a1c';
    c.lineCap = 'round';
    [[340, 170, 230, 3.2], [340, 214, 200, 2.2], [340, 248, 170, 2.2], [340, 282, 190, 2.2], [340, 316, 120, 2.2]].forEach(([x, y, len, lw], i) => {
      c.lineWidth = lw;
      c.beginPath();
      for (let k = 0; k <= len; k += 3) {
        const yy = y + Math.sin(k * 0.34 + i) * (i ? 4 : 7) - (i ? 0 : Math.abs(Math.sin(k * 0.12)) * 6);
        k ? c.lineTo(x + k, yy) : c.moveTo(x + k, yy);
      }
      c.stroke();
    });
  });

export class Studio3D {
  constructor(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    this.renderer = renderer;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    // the studio floor fades into the dark backdrop instead of meeting it at a horizon
    scene.fog = new THREE.Fog('#140c07', 16, 34);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);

    const key = new THREE.DirectionalLight(0xffd8a8, 2.6);
    key.position.set(-6, 9, 8);
    const rim = new THREE.DirectionalLight(0xffb45a, 3.2);
    rim.position.set(6, 4, -7);
    const top = new THREE.DirectionalLight(0xfff1dc, 1.1);
    top.position.set(2, 14, 2);
    scene.add(key, rim, top, new THREE.HemisphereLight(0xfff0dc, 0x1a0d06, 0.45));
    this.key = key;

    this.buildHarvest();
    this.buildBox();
    this.W = 1920;
    this.H = 1080;
    this.ready = false;
  }

  buildHarvest() {
    const s = this.scene;
    const r = rng(902);
    // the ripe bunch, its stalk split where the sickle cuts
    const b = buildBunch();
    poseBunch(b, 3);
    b.stalk.visible = false;
    const pts = b.stalkCurve.getPoints(80);
    const cut = pts.findIndex((p) => p.y < 3.65);
    this.cutPoint = pts[cut].clone();
    const tube = (p) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 24, 0.11, 10, false);
    s.add(new THREE.Mesh(tube(pts.slice(0, cut + 1)), b.strandMat));
    b.group.add(new THREE.Mesh(tube(pts.slice(cut)), b.strandMat));
    b.group.rotation.y = 0.65;
    s.add(b.group);
    this.bunch = b;

    // sickle: crescent steel blade on a wooden handle, pivoting at the handle's end
    const shape = new THREE.Shape();
    shape.absarc(0.9, 0, 1.0, Math.PI, 0.26, true);
    shape.absarc(0.95, -0.12, 0.82, 0.38, Math.PI - 0.05, false);
    shape.closePath();
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 48 }),
      new THREE.MeshStandardMaterial({ color: '#d4d6da', metalness: 1, roughness: 0.25 }),
    );
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.09, 1.1, 18),
      new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.65 }),
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.x = -0.6;
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.12, 18), new THREE.MeshStandardMaterial({ color: '#c9a04f', metalness: 1, roughness: 0.3 }));
    ferrule.rotation.z = Math.PI / 2;
    ferrule.position.x = -0.05;
    const sickle = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(blade, handle, ferrule);
    inner.position.x = 1.15;
    sickle.add(inner);
    sickle.position.set(-2.4, 2.9, 0.9);
    s.add(sickle);
    this.sickle = sickle;

    // woven basket on the floor
    const prof = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      prof.push(new THREE.Vector2(1.45 + 0.85 * Math.pow(u, 0.8), u * 1.9));
    }
    const wv = weave();
    wv.wrapS = wv.wrapT = THREE.RepeatWrapping;
    wv.repeat.set(3, 1);
    const basket = new THREE.Group();
    basket.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 72), new THREE.MeshStandardMaterial({ map: wv, roughness: 0.85, side: THREE.DoubleSide })));
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.11, 12, 96), new THREE.MeshStandardMaterial({ map: wv, roughness: 0.8 }));
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 1.9;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), new THREE.MeshStandardMaterial({ color: '#5c4222', roughness: 0.9 }));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.02;
    basket.add(rimMesh, bottom);
    basket.position.set(0, F, 0);
    s.add(basket);

    // floor + soft shadows
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#100a07', roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = F;
    s.add(floor);
    const shadow = shadowTex();
    for (const [x, sz] of [[0, 6.2], [BOX.x, 7.4]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz * 0.8), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, F + 0.01, 0);
      s.add(m);
    }

    // loose dates: heap in the basket, a shower landing on it, and the box's eleven
    const n = N_HEAP + N_RAIN + N_BOX;
    const loose = datesMesh(
      Array.from({ length: n }, () => r.range(-0.15, 0.1)),
      Array.from({ length: n }, () => r.range(0, 0.2)),
    );
    this.looseSize = setRipeness(loose, 3);
    s.add(loose.mesh);
    this.loose = loose;
    const lying = () =>
      new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2 + r.range(-0.35, 0.35)));
    const wall = (y) => 1.45 + 0.85 * Math.pow(clamp((y - F) / 1.9), 0.8);
    this.heap = Array.from({ length: N_HEAP }, (_, i) => {
      const layer = Math.floor(i / 30);
      const u = Math.sqrt(r());
      const a = r() * Math.PI * 2;
      const y = F + 0.3 + layer * 0.3 + (1 - u) * 0.4;
      const rr = u * (wall(y) - 0.38);
      return { p: new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr), q: lying() };
    });
    this.rain = Array.from({ length: N_RAIN }, (_, i) => {
      const rr = Math.sqrt(r()) * 1.4;
      const a = r() * Math.PI * 2;
      const land = new THREE.Vector3(Math.cos(a) * rr, F + 1.25 + (1 - rr / 1.5) * 0.3, Math.sin(a) * rr);
      return { land, q: lying(), spin: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), t0: 0.165 + (i / N_RAIN) * 0.075 };
    });
    this.boxDates = Array.from({ length: N_BOX }, (_, i) => ({ q: lying(), t0: 0.585 + i * 0.0105 }));

    // the chosen one: the hero Ajwa date from scene 02, with halo rings
    this.hero = ajwaDate();
    this.hero.scale.setScalar(DATE_LEN / 2);
    s.add(this.hero);
    const haloMat = new THREE.MeshBasicMaterial({ color: '#ffdc94', transparent: true, opacity: 0, depthWrite: false });
    this.halos = [0.44, 0.54].map((rad) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.008, 8, 128), haloMat.clone());
      s.add(m);
      return m;
    });
  }

  buildBox() {
    const g = new THREE.Group();
    g.position.copy(BOX);
    this.box = g;
    this.scene.add(g);
    const black = new THREE.MeshPhysicalMaterial({ color: '#100c0a', roughness: 0.72, clearcoat: 0.18, clearcoatRoughness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: '#d6ad5c', metalness: 1, roughness: 0.26 });
    this.gold = gold;
    const add = (parent, w, h, d, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const t = 0.08;
    // base: floor + four walls, gold foil along the rim
    add(g, BW, t, BD, 0, t / 2, 0, black);
    add(g, BW, BH, t, 0, BH / 2, -BD / 2 + t / 2, black);
    add(g, BW, BH, t, 0, BH / 2, BD / 2 - t / 2, black);
    add(g, t, BH, BD, -BW / 2 + t / 2, BH / 2, 0, black);
    add(g, t, BH, BD, BW / 2 - t / 2, BH / 2, 0, black);
    add(g, BW + 0.02, 0.03, t + 0.02, 0, BH, -BD / 2 + t / 2, gold);
    add(g, BW + 0.02, 0.03, t + 0.02, 0, BH, BD / 2 - t / 2, gold);
    add(g, t + 0.02, 0.03, BD, -BW / 2 + t / 2, BH, 0, gold);
    add(g, t + 0.02, 0.03, BD, BW / 2 - t / 2, BH, 0, gold);
    // compartments: dividers + cream liners
    for (const x of [-1, 0, 1]) add(g, 0.035, 0.5, BD - 2 * t, x, 0.3, 0, black);
    for (const z of [-0.5, 0.5]) add(g, BW - 2 * t, 0.5, 0.035, 0, 0.3, z, black);
    const liner = new THREE.MeshStandardMaterial({ color: '#e7d3a6', roughness: 0.92 });
    for (let i = 0; i < 12; i++) {
      const p = SLOT(i);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), liner);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, t + 0.005, p.z);
      g.add(m);
    }

    // lid, hinged along the back top edge
    const hinge = new THREE.Group();
    hinge.position.set(0, BH, -BD / 2);
    g.add(hinge);
    const lid = new THREE.Group();
    lid.position.set(0, 0, BD / 2);
    hinge.add(lid);
    const LW = BW + 0.12, LD = BD + 0.12, LH = 0.42;
    add(lid, LW, t, LD, 0, LH - t / 2, 0, black);
    add(lid, LW, LH, t, 0, LH / 2, -LD / 2 + t / 2, black);
    add(lid, LW, LH, t, 0, LH / 2, LD / 2 - t / 2, black);
    add(lid, t, LH, LD, -LW / 2 + t / 2, LH / 2, 0, black);
    add(lid, t, LH, LD, LW / 2 - t / 2, LH / 2, 0, black);
    // suede lining under the lid (the open lid faces the camera)
    const suede = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 1, envMapIntensity: 0.15 });
    add(lid, LW - 2 * t, 0.01, LD - 2 * t, 0, LH - t - 0.006, 0, suede);
    // foil frame inset on the lid
    const fy = LH + 0.004;
    add(lid, LW - 0.5, 0.012, 0.035, 0, fy, -LD / 2 + 0.25, gold);
    add(lid, LW - 0.5, 0.012, 0.035, 0, fy, LD / 2 - 0.25, gold);
    add(lid, 0.035, 0.012, LD - 0.5, -LW / 2 + 0.25, fy, 0, gold);
    add(lid, 0.035, 0.012, LD - 0.5, LW / 2 - 0.25, fy, 0, gold);
    add(lid, LW + 0.01, 0.025, 0.02, 0, 0.012, LD / 2, gold); // front edge foil
    this.logo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 0.99),
      new THREE.MeshStandardMaterial({ color: '#d6ad5c', metalness: 1, roughness: 0.28, transparent: true, alphaTest: 0.2 }),
    );
    this.logo.rotation.x = -Math.PI / 2;
    this.logo.position.set(0, fy + 0.004, 0.15);
    lid.add(this.logo);
    this.hinge = hinge;
    this.lid = lid;
    this.LH = LH;

    // ribbon: two satin bands that wrap over the closed lid and down the sides
    const satin = new THREE.MeshStandardMaterial({ color: '#c9a04f', metalness: 0.75, roughness: 0.34 });
    const topY = BH + LH + 0.012;
    const RX = 1.6, RZ = 1.0; // ribbon runs off-centre, crossing near the front-right corner
    this.ribbon = [
      [add(g, LW + 0.03, 0.02, 0.32, 0, topY, RZ, satin), 'x'],
      [add(g, 0.32, 0.02, LD + 0.03, RX, topY + 0.004, 0, satin), 'z'],
      [add(g, 0.32, BH + LH, 0.02, RX, (BH + LH) / 2, LD / 2 + 0.012, satin), 'y'],
      [add(g, 0.02, BH + LH, 0.32, LW / 2 + 0.012, (BH + LH) / 2, RZ, satin), 'y'],
    ];
    // wax seal at the crossing
    const seal = new THREE.Group();
    const wax = new THREE.MeshPhysicalMaterial({ color: '#5c1414', roughness: 0.35, clearcoat: 0.6 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.07, 40), wax);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 10, 48), wax);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 32), wax);
    mark.rotation.x = Math.PI / 2;
    mark.scale.set(0.6, 1, 1);
    mark.position.y = 0.045;
    seal.add(disc, ring, mark);
    seal.position.set(RX, topY + 0.045, RZ);
    g.add(seal);
    this.seal = seal;
    this.sealY = topY + 0.045;
    // traceability tag on a gold cord from the front-right corner
    const tag = new THREE.Group();
    tag.position.set(LW / 2 - 0.1, BH + LH - 0.05, LD / 2 + 0.03);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), gold);
    cord.position.y = -0.25;
    this.tagCard = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.6), new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }));
    this.tagCard.position.set(0.06, -0.78, 0.02);
    tag.add(cord, this.tagCard);
    g.add(tag);
    this.tag = tag;
  }

  resize(W, H, dpr) {
    this.W = W;
    this.H = H;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    if (!this.ready) {
      // canvas textures with type are drawn once fonts have loaded
      this.logo.material.map = logoTex();
      this.logo.material.needsUpdate = true;
      this.tagCard.material.map = tagTex();
      this.tagCard.material.needsUpdate = true;
      this.ready = true;
    }
  }

  // world point → screen pixels
  project(v) {
    const p = v.clone().project(this.camera);
    return [((p.x + 1) / 2) * this.W, ((1 - p.y) / 2) * this.H];
  }

  render(h, t) {
    const m = new THREE.Matrix4();
    const sv = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    // the finished box makes a slow 3/4 turn; anything sitting in it turns too
    const boxRot = -0.62 * ease.inOut(invlerp(0.88, 1, h));
    const boxQ = new THREE.Quaternion().setFromAxisAngle(Y, boxRot);
    const inBox = (p) => p.sub(BOX).applyAxisAngle(Y, boxRot).add(BOX);

    // --- camera: bunch → (fall) → basket → hero close-up → box → 3/4 hero ---
    const K = (c) => keys(h, c, ease.inOutSine);
    const cam = this.camera;
    cam.position.set(
      K([[0, 0.3], [0.13, 0.3], [0.2, 0], [0.27, 0], [0.36, 0.25], [0.56, -0.2], [0.67, BOX.x - 0.5], [0.84, BOX.x - 0.5], [1, BOX.x + 2.4]]),
      K([[0, 0.6], [0.1, 0.8], [0.13, 0.8], [0.2, F + 5], [0.27, F + 5], [0.36, HERO_AT.y + 0.35], [0.56, HERO_AT.y + 0.3], [0.67, F + 6.2], [0.84, F + 6], [1, F + 3.6]]),
      K([[0, 13.5], [0.13, 13], [0.2, 9.6], [0.27, 9.2], [0.36, HERO_AT.z + 2.6], [0.56, HERO_AT.z + 2.4], [0.67, 8.8], [0.84, 8.6], [1, 9.4]]),
    );
    const target = new THREE.Vector3(
      K([[0.56, 0], [0.67, BOX.x - 0.8], [0.84, BOX.x - 0.8], [1, BOX.x + 1.5]]),
      K([[0, 0.2], [0.1, 0.5], [0.13, 0.5], [0.2, F + 1.3], [0.27, F + 1.4], [0.36, HERO_AT.y], [0.56, HERO_AT.y], [0.67, F + 0.4], [0.84, F + 0.5], [1, F + 0.6]]),
      K([[0.27, 0], [0.36, HERO_AT.z], [0.56, HERO_AT.z], [0.67, 0]]),
    );
    cam.lookAt(target);

    // --- harvest: sickle sweep, cut, fall ---
    const sw = invlerp(0.04, 0.17, h);
    this.sickle.visible = sw > 0 && sw < 1;
    this.sickle.rotation.z = lerp(-1.5, 0.9, ease.inOutSine(sw)) + Math.sin(t * 2) * 0.01;
    const fall = ease.in(invlerp(H_CUT, H_CUT + 0.075, h));
    const bg = this.bunch.group;
    bg.visible = h < H_CUT + 0.075;
    bg.position.set(fall * 0.6, -fall * 13, 0);
    bg.rotation.set(0, 0.65 + Math.sin(t * 0.35) * 0.04, -fall * 0.5);

    // --- loose dates ---
    const L = this.loose;
    const sz = (DATE_LEN / 2) * this.looseSize;
    const heapOn = h > 0.14 && h < 0.66;
    this.heap.forEach((d, i) => {
      sv.setScalar(heapOn ? sz : 0);
      m.compose(d.p, d.q, sv);
      L.mesh.setMatrixAt(i, m);
    });
    this.rain.forEach((d, i) => {
      const u = clamp((h - d.t0) / 0.032);
      const on = heapOn && h > d.t0;
      const y = lerp(F + 9, d.land.y, u * u) + (u >= 1 ? 0.14 * Math.abs(Math.sin(Math.PI * clamp((h - d.t0 - 0.032) / 0.012))) : 0);
      v.set(d.land.x, y, d.land.z);
      q.setFromAxisAngle(d.spin, (1 - u) * 7).multiply(d.q);
      sv.setScalar(on ? sz : 0);
      m.compose(v, q, sv);
      L.mesh.setMatrixAt(N_HEAP + i, m);
    });
    this.boxDates.forEach((d, i) => {
      const u = clamp((h - d.t0) / 0.028);
      const slot = SLOT(i).add(BOX);
      const seat = BOX.y + 0.2;
      const y = lerp(seat + 3.2, seat, u * u) + (u >= 1 ? 0.1 * Math.abs(Math.sin(Math.PI * clamp((h - d.t0 - 0.028) / 0.01))) : 0);
      inBox(v.set(slot.x, y, slot.z));
      // lie along x in the compartment
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
        .premultiply(new THREE.Quaternion().setFromAxisAngle(Y, (1 - u) * 3 + 0.08 * (i % 3)))
        .premultiply(boxQ);
      sv.setScalar(h > d.t0 ? sz : 0);
      m.compose(v, q, sv);
      L.mesh.setMatrixAt(N_HEAP + N_RAIN + i, m);
    });
    L.mesh.instanceMatrix.needsUpdate = true;
    L.uniforms.uDim.value = 1 - 0.55 * smoothstep(0.29, 0.36, h) * (1 - smoothstep(0.56, 0.62, h));

    // --- the chosen date: rises from the heap, turns in the light, floats into its slot ---
    const hero = this.hero;
    const rise = ease.inOut(invlerp(0.27, 0.35, h));
    const go = ease.inOut(invlerp(0.6, 0.73, h));
    hero.visible = h > 0.14;
    const fromHeap = new THREE.Vector3(0.1, F + 1.45, 0.2);
    const slot = SLOT(11).add(BOX);
    slot.y = BOX.y + 0.2;
    if (go > 0) {
      v.copy(HERO_AT).lerp(slot, go);
      v.y += Math.sin(go * Math.PI) * 1.4;
    } else v.copy(fromHeap).lerp(HERO_AT, rise);
    if (go >= 1) inBox(v);
    hero.position.copy(v);
    const spin = t * 0.5 + h * 6;
    const lieQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const standQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, spin, 0.32));
    hero.quaternion.copy(lieQ).slerp(standQ, rise * (1 - go));
    if (go >= 1) hero.quaternion.premultiply(boxQ);
    const halo = smoothstep(0.31, 0.36, h) * (1 - smoothstep(0.54, 0.6, h));
    this.halos.forEach((ring, i) => {
      ring.visible = halo > 0;
      ring.position.copy(HERO_AT);
      ring.rotation.set(Math.PI / 2 - 0.35 + i * 0.12, 0, t * (i ? -0.3 : 0.4));
      ring.material.opacity = halo * (i ? 0.45 : 0.8);
      ring.scale.setScalar(1 + 0.04 * Math.sin(t * 2 + i));
    });

    // --- box: lid closes, ribbon wraps, seal presses, tag swings ---
    const close = ease.inOut(invlerp(0.735, 0.79, h));
    this.hinge.rotation.x = lerp(-1.95, 0, close);
    const rib = ease.out(invlerp(0.79, 0.84, h));
    this.ribbon.forEach(([band, axis], i) => {
      const k = clamp(rib * 1.6 - i * 0.2);
      band.visible = k > 0.001;
      band.scale.set(axis === 'x' ? k : 1, axis === 'y' ? k : 1, axis === 'z' ? k : 1);
      if (axis === 'y') band.position.y = ((BH + this.LH) / 2) * (2 - k);
    });
    const press = invlerp(0.835, 0.865, h);
    this.seal.visible = press > 0;
    this.seal.position.y = this.sealY + (1 - ease.out(press)) * 0.6;
    this.seal.scale.set(1 + 0.12 * Math.sin(Math.PI * press), 1 - 0.3 * Math.sin(Math.PI * press), 1 + 0.12 * Math.sin(Math.PI * press));
    const tg = invlerp(0.86, 0.9, h);
    this.tag.visible = tg > 0;
    const sway = Math.exp(-(h - 0.86) * 18) * Math.sin(t * 3.2);
    this.tag.rotation.set(0.15, -0.3, (1 - ease.out(tg)) * 1.2 + 0.18 * sway);
    this.box.rotation.y = boxRot;
    this.key.position.set(-6 + 3 * Math.sin(t * 0.3), 9, 8);

    this.renderer.render(this.scene, cam);
    return { hero: hero.position.clone(), cut: this.cutPoint.clone(), sweep: sw };
  }
}
