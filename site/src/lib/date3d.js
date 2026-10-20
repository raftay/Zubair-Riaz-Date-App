// Real-time 3D Ajwa date + seed (three.js). The date is a wrinkled ellipsoid
// split into two halves with clipping planes; each half carries a painted
// cut face, so it can open like a book to reveal the seed.
// Everything is placed in screen pixels so the DOM choreography can drive it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rng, noise3 } from './rand.js';

const HINGE = 0.42; // halves open around the back edge of the date

function canvasTex(w, h, paint, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function dateGeometry() {
  const n = noise3(17);
  const g = new THREE.SphereGeometry(1, 200, 150);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const ridge = (x) => 1 - Math.abs(x);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y = v.y;
    // oblong, slightly fuller at the base and gently curved like a real date
    const taper = 1 - 0.07 * y - 0.06 * y * y;
    let x = v.x * 0.5 * taper;
    let z = v.z * 0.47 * taper;
    x += 0.045 * (1 - y * y);
    // creases: ridged noise stretched along the length, plus finer cross-wrinkles
    const a = ridge(n(v.x * 3.0, y * 1.25, v.z * 3.0)) ** 3;
    const b = ridge(n(v.x * 6.8 + 11, y * 2.6, v.z * 6.8)) ** 2;
    const c = n(v.x * 15, y * 5.5, v.z * 15 + 3);
    const d = 0.05 * a + 0.024 * b + 0.006 * c;
    const ends = 1 - 0.6 * Math.abs(y) ** 6; // keep the tips smooth
    x *= 1 - d * 1.25 * ends;
    z *= 1 - d * 1.25 * ends;
    pos.setXYZ(i, x, y * (1 - 0.01 * a), z);
  }
  g.computeVertexNormals();
  return g;
}

function seedGeometry() {
  const n = noise3(5);
  const g = new THREE.SphereGeometry(1, 140, 100);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y = v.y;
    let x = v.x * 0.17;
    let z = v.z * 0.155;
    // the ventral groove that runs the length of a date pit
    const along = 1 - Math.abs(y) ** 6;
    const groove = z > 0 ? Math.exp(-((x / 0.03) ** 2)) * along : 0;
    z -= 0.06 * groove;
    const bump = 1 + 0.03 * n(v.x * 9, y * 12, v.z * 9);
    pos.setXYZ(i, x * bump, y * 0.6, z * bump);
    const k = 1 - 0.55 * groove - 0.12 * Math.max(0, n(v.x * 4, y * 6, v.z * 4));
    col.set([k, k * 0.97, k * 0.94], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const skinColor = () =>
  canvasTex(1024, 512, (c, w, h) => {
    const r = rng(3);
    c.fillStyle = '#2b1610';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 90;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      const warm = r() < 0.5;
      g.addColorStop(0, warm ? 'rgba(104,48,24,0.32)' : 'rgba(12,5,3,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 900; i++) {
      c.strokeStyle = r() < 0.5 ? 'rgba(10,4,2,0.22)' : 'rgba(120,64,34,0.12)';
      c.lineWidth = 0.6 + r() * 1.4;
      const x = r() * w, y = r() * h, len = 20 + r() * 80;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + (r() - 0.5) * 18, y + len / 2, x + (r() - 0.5) * 10, y + len);
      c.stroke();
    }
  });

const skinBump = () =>
  canvasTex(
    1024,
    512,
    (c, w, h) => {
      const r = rng(9);
      c.fillStyle = '#808080';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        c.strokeStyle = r() < 0.6 ? `rgba(0,0,0,${0.15 + r() * 0.3})` : `rgba(255,255,255,${0.1 + r() * 0.2})`;
        c.lineWidth = 0.5 + r() * 1.6;
        const x = r() * w, y = r() * h, len = 8 + r() * 46;
        c.beginPath();
        c.moveTo(x, y);
        c.bezierCurveTo(x + (r() - 0.5) * 16, y + len * 0.3, x + (r() - 0.5) * 16, y + len * 0.7, x + (r() - 0.5) * 8, y + len);
        c.stroke();
      }
    },
    false,
  );

// Cut face of a halved date: caramel flesh, darker toward the skin, with the
// seed cavity in the middle (filled = seed still in it, empty = imprint).
// Cut face of a halved date: caramel flesh, darker toward the skin, fibrous,
// with the papery imprint the seed leaves in the middle.
const fleshFace = (side) =>
  canvasTex(1024, 1024, (c, w) => {
    const R = w / 2;
    const r = rng(side < 0 ? 21 : 22);
    const nz = noise3(side < 0 ? 31 : 32);
    c.save();
    c.beginPath();
    c.arc(R, R, R, 0, Math.PI * 2);
    c.clip();
    const g = c.createRadialGradient(R, R * 0.96, 0, R, R, R);
    g.addColorStop(0, '#e3a659');
    g.addColorStop(0.38, '#c47a34');
    g.addColorStop(0.72, '#8d4518');
    g.addColorStop(0.9, '#57230c');
    g.addColorStop(1, '#1d0a04');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
    // mottled translucency
    const img = c.getImageData(0, 0, w, w);
    for (let y = 0; y < w; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const m = nz(x / 90, y / 160, 0.5) * 0.6 + nz(x / 30, y / 70, 3) * 0.4;
        const f = 1 + m * 0.16;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const i = ((y + dy) * w + x + dx) * 4;
          img.data[i] = Math.min(255, img.data[i] * f);
          img.data[i + 1] = Math.min(255, img.data[i + 1] * f);
          img.data[i + 2] = Math.min(255, img.data[i + 2] * f);
        }
      }
    }
    c.putImageData(img, 0, 0);
    // fibres running the length of the fruit
    for (let i = 0; i < 900; i++) {
      const x = r() * w;
      const y = r() * w;
      const len = 40 + r() * 180;
      c.strokeStyle = r() < 0.55 ? `rgba(255,220,160,${0.04 + r() * 0.07})` : `rgba(70,24,6,${0.05 + r() * 0.08})`;
      c.lineWidth = 1 + r() * 2.5;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + (x - R) * 0.05 + (r() - 0.5) * 10, y + len / 2, x + (x - R) * 0.08, y + len);
      c.stroke();
    }
    // seed imprint (sized to the seed: 0.17/0.448 by 0.6/0.955 of the radius)
    const rx = 0.4 * R, ry = 0.66 * R;
    c.beginPath();
    c.ellipse(R, R, rx * 1.12, ry * 1.05, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(250,226,180,0.35)';
    c.fill();
    c.beginPath();
    c.ellipse(R, R, rx, ry, 0, 0, Math.PI * 2);
    const cg = c.createRadialGradient(R - rx * 0.3, R - ry * 0.2, 0, R, R, ry);
    cg.addColorStop(0, '#d2a66c');
    cg.addColorStop(0.6, '#b4844c');
    cg.addColorStop(1, '#84532a');
    c.fillStyle = cg;
    c.fill();
    c.strokeStyle = 'rgba(96,50,18,0.75)';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(R, R - ry * 0.86);
    c.quadraticCurveTo(R + 9, R, R, R + ry * 0.86);
    c.stroke();
    // wet sheen
    const s = c.createRadialGradient(R * 0.72, R * 0.58, 0, R * 0.72, R * 0.58, R * 0.75);
    s.addColorStop(0, 'rgba(255,236,200,0.2)');
    s.addColorStop(1, 'rgba(255,236,200,0)');
    c.fillStyle = s;
    c.fillRect(0, 0, w, w);
    // thin skin rim
    c.beginPath();
    c.arc(R, R, R - 6, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(20,8,3,0.95)';
    c.lineWidth = 14;
    c.stroke();
    c.restore();
  });

const seedTex = () =>
  canvasTex(512, 256, (c, w, h) => {
    const r = rng(4);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#b48858');
    g.addColorStop(0.5, '#a07246');
    g.addColorStop(1, '#8c6038');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      c.fillStyle = r() < 0.5 ? `rgba(90,52,22,${r() * 0.25})` : `rgba(240,214,170,${r() * 0.2})`;
      c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 3);
    }
  });

export class Date3D {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.localClippingEnabled = true;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.38;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.1, 100);
    this.camera.position.set(0, 0, 20);

    const key = new THREE.DirectionalLight(0xffdcae, 2.7);
    key.position.set(-4.5, 5, 6);
    const rim = new THREE.DirectionalLight(0xffb45c, 3.6);
    rim.position.set(5, 2.5, -4);
    const rim2 = new THREE.DirectionalLight(0xffc98a, 1.4);
    rim2.position.set(-5, -1, -3);
    const fill = new THREE.DirectionalLight(0xa8b4ff, 0.22);
    fill.position.set(3, -3, 5);
    scene.add(key, rim, rim2, fill, new THREE.HemisphereLight(0xfff0dc, 0x170a05, 0.45));

    // --- the date ---
    const geo = dateGeometry();
    const skinMap = skinColor();
    const bump = skinBump();
    this.date = new THREE.Group(); // screen placement + roll
    this.spin = new THREE.Group(); // yaw around the long axis
    this.date.add(this.spin);
    scene.add(this.date);
    this.halves = [-1, 1].map((side) => {
      const plane = new THREE.Plane();
      const local = new THREE.Plane(new THREE.Vector3(side, 0, 0), 0); // three.js keeps the positive side
      const skin = new THREE.MeshPhysicalMaterial({
        map: skinMap,
        bumpMap: bump,
        bumpScale: 1.3,
        roughness: 0.6,
        clearcoat: 0.38,
        clearcoatRoughness: 0.42,
        sheen: 0.6,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color('#8f4a26'),
        clippingPlanes: [plane],
        transparent: true,
      });
      const flesh = new THREE.MeshStandardMaterial({
        color: '#8a4418',
        emissive: '#3a1404',
        roughness: 0.45,
        side: THREE.BackSide,
        clippingPlanes: [plane],
        transparent: true,
      });
      const face = new THREE.MeshPhysicalMaterial({
        map: fleshFace(side),
        roughness: 0.32,
        clearcoat: 0.9,
        clearcoatRoughness: 0.2,
        emissive: '#4a1a06',
        emissiveIntensity: 0.18,
        transparent: true,
      });
      const pivot = new THREE.Group();
      const body = new THREE.Group();
      body.position.z = HINGE;
      pivot.position.z = -HINGE;
      pivot.add(body);
      body.add(new THREE.Mesh(geo, skin));
      const shell = new THREE.Mesh(geo, flesh);
      shell.scale.setScalar(0.965);
      body.add(shell);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(1, 128), face);
      cap.scale.set(0.448, 0.955, 1);
      cap.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      body.add(cap);
      this.spin.add(pivot);
      return { side, pivot, body, plane, local, mats: [skin, flesh, face] };
    });

    // --- the seed ---
    this.seed = new THREE.Group();
    this.seedSpin = new THREE.Group();
    this.seed.add(this.seedSpin);
    this.seedMat = new THREE.MeshPhysicalMaterial({
      map: seedTex(),
      color: '#a8865f',
      vertexColors: true,
      roughness: 0.66,
      clearcoat: 0.18,
      clearcoatRoughness: 0.5,
      sheen: 0.4,
      sheenColor: new THREE.Color('#f0d0a0'),
      emissive: '#ffcf7a',
      emissiveIntensity: 0,
      transparent: true,
    });
    this.seedSpin.add(new THREE.Mesh(seedGeometry(), this.seedMat));
    scene.add(this.seed);
    this.W = 1920;
    this.H = 1080;
  }

  resize(W, H, dpr) {
    this.W = W;
    this.H = H;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.ppu = H / (2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
  }

  place(obj, x, y, pxHeight, unitHeight) {
    obj.position.set((x - this.W / 2) / this.ppu, -(y - this.H / 2) / this.ppu, 0);
    obj.scale.setScalar(pxHeight / (unitHeight * this.ppu));
  }

  /**
   * date: { x, y, h (px), yaw, roll, open 0..1, spread, alpha }
   * seed: { x, y, h (px), yaw, roll, pitch, alpha, glow }
   */
  render(date, seed) {
    const d = this.date;
    d.visible = date.alpha > 0.003;
    if (d.visible) {
      this.place(d, date.x, date.y, date.h, 2);
      d.rotation.set(0, 0, date.roll);
      this.spin.rotation.set(date.pitch || 0, date.yaw, 0);
      const ang = date.open * 1.05;
      for (const h of this.halves) {
        h.pivot.rotation.y = h.side * ang; // cut faces swing toward the camera
        h.pivot.position.x = h.side * (0.02 * date.open + date.spread);
        for (const m of h.mats) m.opacity = date.alpha;
      }
    }
    const s = this.seed;
    s.visible = seed.alpha > 0.003;
    if (s.visible) {
      this.place(s, seed.x, seed.y, seed.h, 1.2);
      s.rotation.set(0, 0, seed.roll);
      this.seedSpin.rotation.set(seed.pitch || 0, seed.yaw, 0);
      this.seedMat.opacity = seed.alpha;
      this.seedMat.emissiveIntensity = seed.glow;
    }
    this.scene.updateMatrixWorld(true);
    for (const h of this.halves) h.plane.copy(h.local).applyMatrix4(h.body.matrixWorld);
    this.renderer.render(this.scene, this.camera);
  }

  clear() {
    this.renderer.clear();
  }
}
