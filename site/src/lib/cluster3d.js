// A hanging date bunch (three.js) that ripens through the four real stages:
// Kimri (green) → Khalal (yellow / red) → Rutab (browning from the tip) →
// Tamr (dark, wrinkled). One instanced mesh draws every date; a shader picks
// each date's colour from a shared ripeness value plus a per-date offset, and a
// morph target adds the Tamr wrinkles.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, noise3 } from './rand.js';

const DATE_SCALE = 0.31; // date geometry is 2 units long → ~0.62 world units
const lin = (hex) => new THREE.Color(hex); // THREE.Color parses sRGB hex into linear

function dateBody() {
  const n = noise3(23);
  const ridge = (x) => 1 - Math.abs(x);
  const g = new THREE.SphereGeometry(1, 48, 36);
  const pos = g.attributes.position;
  const smooth = new Float32Array(pos.count * 3);
  const wrinkled = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y = v.y;
    const taper = 1 - 0.05 * y - 0.06 * y * y;
    const x = v.x * 0.54 * taper;
    const z = v.z * 0.52 * taper;
    smooth.set([x, y, z], i * 3);
    const a = ridge(n(v.x * 2.8, y * 1.2, v.z * 2.8)) ** 3;
    const b = ridge(n(v.x * 6 + 11, y * 2.4, v.z * 6)) ** 2;
    const d = 0.07 * a + 0.03 * b;
    const ends = 1 - 0.6 * Math.abs(y) ** 6;
    wrinkled.set([x * (1 - d * 1.5 * ends) * 0.94, y * 0.97, z * (1 - d * 1.5 * ends) * 0.94], i * 3);
  }
  const normalsOf = (arr) => {
    const t = g.clone();
    t.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    t.computeVertexNormals();
    return t.attributes.normal;
  };
  g.setAttribute('position', new THREE.BufferAttribute(smooth, 3));
  g.setAttribute('normal', normalsOf(smooth));
  g.morphAttributes.position = [new THREE.BufferAttribute(wrinkled, 3)];
  g.morphAttributes.normal = [normalsOf(wrinkled)];
  return g;
}

export class Cluster3D {
  constructor(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.1, 100);
    this.camera.position.set(0, 0, 20);

    // golden-hour light from the left, warm rim from behind
    const key = new THREE.DirectionalLight(0xffd9a6, 2.8);
    key.position.set(-6, 4, 6);
    const rim = new THREE.DirectionalLight(0xffb560, 3.0);
    rim.position.set(5, 3, -5);
    const fill = new THREE.DirectionalLight(0xbfcaff, 0.35);
    fill.position.set(4, -2, 5);
    scene.add(key, rim, fill, new THREE.HemisphereLight(0xfff2de, 0x2a1608, 0.55));

    this.group = new THREE.Group();
    scene.add(this.group);
    this.build();
    this.W = 1920;
    this.H = 1080;
  }

  build() {
    const r = rng(314);
    const UP = new THREE.Vector3(0, 1, 0);
    // local origin sits at the visual centre of the bunch
    const head = new THREE.Vector3(0, 2.2, 0);
    const stalk = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.0, 7.4, -0.6),
      new THREE.Vector3(-0.5, 4.9, -0.2),
      new THREE.Vector3(-0.1, 3.2, 0),
      head,
    ]);
    const strandGeos = [new THREE.TubeGeometry(stalk, 40, 0.11, 10, false)];
    const dates = [];
    const N = 26;
    for (let j = 0; j < N; j++) {
      const phi = j * 2.39996 + r.range(-0.2, 0.2);
      const alpha = r.range(0.3, 1.0);
      const len = r.range(2.9, 4.2);
      const out = new THREE.Vector3(Math.cos(phi) * Math.sin(alpha), 0, Math.sin(phi) * Math.sin(alpha));
      const curve = new THREE.CatmullRomCurve3([
        head.clone(),
        head.clone().addScaledVector(out, 0.8).add(new THREE.Vector3(0, -0.2, 0)),
        head.clone().addScaledVector(out, 1.5).add(new THREE.Vector3(0, -len * 0.5, 0)),
        head.clone().addScaledVector(out, 1.75).add(new THREE.Vector3(0, -len, 0)),
      ]);
      strandGeos.push(new THREE.TubeGeometry(curve, 24, 0.028, 6, false));
      const k = Math.round(r.range(5, 8));
      for (let i = 0; i < k; i++) {
        const u = 0.3 + 0.7 * (i / (k - 1));
        const p = curve.getPoint(u);
        const t = curve.getTangent(u);
        const side = new THREE.Vector3().crossVectors(t, UP).normalize().multiplyScalar(i % 2 ? 1 : -1);
        const attach = p.clone().addScaledVector(side, 0.05);
        const center = p
          .clone()
          .addScaledVector(side, 0.2 + r.range(0, 0.08))
          .add(new THREE.Vector3(r.range(-0.05, 0.05), -0.3, r.range(-0.05, 0.05)));
        const axis = attach.clone().sub(center).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(UP, axis);
        quat.multiply(new THREE.Quaternion().setFromAxisAngle(UP, r() * Math.PI * 2));
        // outer, lower dates ripen a touch ahead of the inner ones
        const off = r.range(-0.2, 0.2) + (u - 0.6) * 0.18;
        const hue = r() < 0.3 ? r.range(0.45, 1) : r.range(0, 0.18);
        dates.push({ center, axis, quat, off, hue, size: r.range(0.9, 1.08) });
      }
    }
    const strands = new THREE.Mesh(
      mergeGeometries(strandGeos),
      (this.strandMat = new THREE.MeshStandardMaterial({ color: '#d9a03a', roughness: 0.55, metalness: 0 })),
    );
    this.group.add(strands);

    // dates
    const geo = dateBody();
    const n = dates.length;
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(Float32Array.from(dates, (d) => d.off), 1));
    geo.setAttribute('aHue', new THREE.InstancedBufferAttribute(Float32Array.from(dates, (d) => d.hue), 1));
    const uniforms = {
      uRipe: { value: 0 },
      cKimri: { value: lin('#6f8a33') },
      cKhalalY: { value: lin('#e6b23a') },
      cKhalalR: { value: lin('#c2402a') },
      cRutab: { value: lin('#6e3412') },
      cTamr: { value: lin('#2a140c') },
    };
    this.uniforms = uniforms;
    const mat = new THREE.MeshPhysicalMaterial({
      roughness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.28,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ffd9a0'),
    });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aOff;\nattribute float aHue;\nvarying float vY;\nvarying float vOff;\nvarying float vHue;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y; vOff = aOff; vHue = aHue;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uRipe;\nuniform vec3 cKimri, cKhalalY, cKhalalR, cRutab, cTamr;\nvarying float vY;\nvarying float vOff;\nvarying float vHue;',
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float rr = clamp(uRipe + vOff, 0.0, 3.0);
          vec3 kh = mix(cKhalalY, cKhalalR, vHue);
          vec3 c;
          if (rr < 1.0) c = mix(cKimri, kh, smoothstep(0.0, 1.0, rr));
          else if (rr < 2.0) {
            // rutab: browning creeps up from the tip (y = -1) to the cap (y = 1)
            float front = mix(-1.3, 1.3, rr - 1.0);
            c = mix(kh, cRutab, smoothstep(front + 0.16, front - 0.16, vY));
          } else c = mix(cRutab, cTamr, smoothstep(2.0, 2.85, rr));
          diffuseColor.rgb = c;`,
        );
    };
    this.dateMat = mat;
    this.dates = dates;
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.morphTargetInfluences = [0];
    this.group.add(this.mesh);

    // calyx caps where each date meets its strand
    this.capMat = new THREE.MeshStandardMaterial({ color: '#e2b24a', roughness: 0.6 });
    const capGeo = new THREE.CylinderGeometry(0.075, 0.12, 0.12, 12);
    this.caps = new THREE.InstancedMesh(capGeo, this.capMat, n);
    this.group.add(this.caps);
    this.m = new THREE.Matrix4();
    this.sv = new THREE.Vector3();
    this.pv = new THREE.Vector3();
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

  /**
   * ripe: 0 kimri · 1 khalal · 1.5 half rutab · 2 rutab · 3 tamr
   * x, y: screen point for the bunch head; h: pixel height of ~8 world units
   */
  render({ ripe, x, y, h, yaw, pitch = 0 }) {
    const g = this.group;
    g.position.set((x - this.W / 2) / this.ppu, -(y - this.H / 2) / this.ppu, 0);
    g.scale.setScalar(h / (8 * this.ppu));
    g.rotation.set(pitch, yaw, 0);
    this.uniforms.uRipe.value = ripe;
    const tamr = Math.min(1, Math.max(0, (ripe - 1.9) / 1.0));
    this.mesh.morphTargetInfluences[0] = tamr;
    this.dateMat.roughness = 0.3 + 0.28 * tamr;
    this.dateMat.clearcoat = 0.6 - 0.35 * tamr;
    // plump through khalal, slight shrink as the fruit dries to tamr
    const size = ripe < 1 ? 0.86 + 0.14 * ripe : 1 - 0.12 * tamr;
    this.strandMat.color.set(tamr > 0.5 ? '#c78a35' : '#d9a03a');
    this.capMat.color.set(ripe < 0.6 ? '#9aa04a' : tamr > 0.5 ? '#b98a3c' : '#e2b24a');
    const { m, sv, pv } = this;
    this.dates.forEach((d, i) => {
      const s = DATE_SCALE * d.size * size;
      sv.set(s, s, s);
      m.compose(d.center, d.quat, sv);
      this.mesh.setMatrixAt(i, m);
      pv.copy(d.center).addScaledVector(d.axis, s * 1.02);
      sv.set(s * 2.2, s * 2.2, s * 2.2);
      m.compose(pv, d.quat, sv);
      this.caps.setMatrixAt(i, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.caps.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
