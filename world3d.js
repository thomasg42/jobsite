/**
 * The jobsite world for the Jobsite sample: a dusk sky over Montana hills, the
 * lot, a two-story house under construction (stairs up to the second floor),
 * a tower crane and site props. Everything is drawn in code from the vendored
 * three.js, so the page still works offline at the coffee table.
 */
import * as THREE from "./vendor/three.module.js";

/** The house is turned so the default camera sees its front and its open stair side. */
export const HOUSE_TURN = 0.62;
export const HOUSE_TOP = 7.75;
export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif';

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

// ---------------------------------------------------------------------------
// Rounded box. Adapted from three.js examples/jsm/geometries/RoundedBoxGeometry.js (MIT).
// ---------------------------------------------------------------------------
const _n = new THREE.Vector3();
function arcUv(faceDir, normal, uvAxis, projAxis, radius, side) {
  const tot = (2 * Math.PI * radius) / 4;
  const centerLen = Math.max(side - 2 * radius, 0);
  _n.copy(normal);
  _n[projAxis] = 0;
  _n.normalize();
  const arcUvRatio = (0.5 * tot) / (tot + centerLen);
  const arcAngleRatio = 1.0 - _n.angleTo(faceDir) / (Math.PI / 4);
  if (Math.sign(_n[uvAxis]) === 1) return arcAngleRatio * arcUvRatio;
  return centerLen / (tot + centerLen) + arcUvRatio + arcUvRatio * (1.0 - arcAngleRatio);
}

export class RoundedBox extends THREE.BoxGeometry {
  constructor(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1) {
    segments = segments * 2 + 1;
    radius = Math.min(width / 2, height / 2, depth / 2, radius);
    super(1, 1, 1, segments, segments, segments);
    if (segments === 1) return;
    const flat = this.toNonIndexed();
    this.index = null;
    this.attributes.position = flat.attributes.position;
    this.attributes.normal = flat.attributes.normal;
    this.attributes.uv = flat.attributes.uv;
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(radius);
    const positions = this.attributes.position.array;
    const normals = this.attributes.normal.array;
    const uvs = this.attributes.uv.array;
    const faceTris = positions.length / 6;
    const faceDir = new THREE.Vector3();
    const half = 0.5 / segments;
    for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
      position.fromArray(positions, i);
      normal.copy(position);
      normal.x -= Math.sign(normal.x) * half;
      normal.y -= Math.sign(normal.y) * half;
      normal.z -= Math.sign(normal.z) * half;
      normal.normalize();
      positions[i] = box.x * Math.sign(position.x) + normal.x * radius;
      positions[i + 1] = box.y * Math.sign(position.y) + normal.y * radius;
      positions[i + 2] = box.z * Math.sign(position.z) + normal.z * radius;
      normals[i] = normal.x;
      normals[i + 1] = normal.y;
      normals[i + 2] = normal.z;
      switch (Math.floor(i / faceTris)) {
        case 0:
          faceDir.set(1, 0, 0);
          uvs[j] = arcUv(faceDir, normal, "z", "y", radius, depth);
          uvs[j + 1] = 1.0 - arcUv(faceDir, normal, "y", "z", radius, height);
          break;
        case 1:
          faceDir.set(-1, 0, 0);
          uvs[j] = 1.0 - arcUv(faceDir, normal, "z", "y", radius, depth);
          uvs[j + 1] = 1.0 - arcUv(faceDir, normal, "y", "z", radius, height);
          break;
        case 2:
          faceDir.set(0, 1, 0);
          uvs[j] = 1.0 - arcUv(faceDir, normal, "x", "z", radius, width);
          uvs[j + 1] = arcUv(faceDir, normal, "z", "x", radius, depth);
          break;
        case 3:
          faceDir.set(0, -1, 0);
          uvs[j] = 1.0 - arcUv(faceDir, normal, "x", "z", radius, width);
          uvs[j + 1] = 1.0 - arcUv(faceDir, normal, "z", "x", radius, depth);
          break;
        case 4:
          faceDir.set(0, 0, 1);
          uvs[j] = 1.0 - arcUv(faceDir, normal, "x", "y", radius, width);
          uvs[j + 1] = 1.0 - arcUv(faceDir, normal, "y", "x", radius, height);
          break;
        default:
          faceDir.set(0, 0, -1);
          uvs[j] = arcUv(faceDir, normal, "x", "y", radius, width);
          uvs[j + 1] = 1.0 - arcUv(faceDir, normal, "y", "x", radius, height);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Canvas helpers and textures (drawn once at start-up)
// ---------------------------------------------------------------------------
export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
  return g;
}

function grain(g, w, h, r, amount) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function speckle(g, w, h, r, count, colors, min, max, alpha) {
  for (let i = 0; i < count; i += 1) {
    g.globalAlpha = alpha * (0.45 + r() * 0.55);
    g.fillStyle = colors[(r() * colors.length) | 0];
    const s = min + r() * (max - min);
    g.fillRect(r() * w, r() * h, s, s);
  }
  g.globalAlpha = 1;
}

function blotches(g, w, h, r, count, dark, light, min, max) {
  for (let i = 0; i < count; i += 1) {
    const x = r() * w;
    const y = r() * h;
    const rad = min + r() * (max - min);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, r() < 0.5 ? dark : light);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

function woodCanvas(r) {
  const w = 128;
  const h = 1024;
  const c = makeCanvas(w, h);
  const g = c.getContext("2d");
  const base = g.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, "#d4ad76");
  base.addColorStop(0.5, "#e3c28e");
  base.addColorStop(1, "#d0a66d");
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 48; i += 1) {
    const x0 = r() * w;
    const amp = 1.5 + r() * 5;
    const freq = 0.003 + r() * 0.01;
    const ph = r() * 6.28;
    g.strokeStyle = r() < 0.5 ? "rgba(146,98,48,0.24)" : "rgba(120,78,36,0.14)";
    g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath();
    for (let y = 0; y <= h; y += 8) {
      const x = x0 + Math.sin(y * freq + ph) * amp;
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let k = 0; k < 2; k += 1) {
    const kx = 24 + r() * (w - 48);
    const ky = r() * h;
    const grad = g.createRadialGradient(kx, ky, 0, kx, ky, 11);
    grad.addColorStop(0, "rgba(92,56,24,0.85)");
    grad.addColorStop(1, "rgba(92,56,24,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(kx, ky, 7, 13, 0, 0, Math.PI * 2);
    g.fill();
  }
  grain(g, w, h, r, 14);
  return c;
}

function osbCanvas(r) {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  g.fillStyle = "#c29a5d";
  g.fillRect(0, 0, s, s);
  const tones = ["#a47a40", "#d9b67b", "#b78c4f", "#e7c990", "#9a7039", "#cea86a", "#8f6834"];
  for (let i = 0; i < 2800; i += 1) {
    g.save();
    g.translate(r() * s, r() * s);
    g.rotate(r() * Math.PI);
    g.fillStyle = tones[(r() * tones.length) | 0];
    g.globalAlpha = 0.5 + r() * 0.45;
    const w = 10 + r() * 36;
    const h = 3 + r() * 8;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
  }
  g.globalAlpha = 1;
  grain(g, s, s, r, 16);
  return c;
}

function concreteCanvas(r) {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  g.fillStyle = "#a4a39d";
  g.fillRect(0, 0, s, s);
  blotches(g, s, s, r, 46, "rgba(70,70,66,0.16)", "rgba(222,222,215,0.14)", 30, 110);
  speckle(g, s, s, r, 4200, ["#7b7a75", "#c6c5bf", "#8d8c87", "#5f5e5a"], 1, 2.6, 0.55);
  grain(g, s, s, r, 16);
  return c;
}

function shingleCanvas(r) {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  g.fillStyle = "#17181b";
  g.fillRect(0, 0, s, s);
  const rows = 8;
  const rh = s / rows;
  const tw = s / 4;
  for (let row = 0; row < rows; row += 1) {
    const off = (row % 2) * (tw / 2);
    for (let i = -1; i < 5; i += 1) {
      const l = 40 + r() * 16;
      g.fillStyle = `rgb(${l},${l + 2},${l + 7})`;
      g.fillRect(i * tw + off + 1.5, row * rh, tw - 3, rh - 4);
    }
    const sh = g.createLinearGradient(0, row * rh + rh - 12, 0, row * rh + rh);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = sh;
    g.fillRect(0, row * rh + rh - 12, s, 12);
  }
  speckle(g, s, s, r, 9000, ["#62656d", "#2a2c31", "#7d808a"], 1, 2, 0.5);
  return c;
}

function dirtCanvas(r) {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  g.fillStyle = "#7a6048";
  g.fillRect(0, 0, s, s);
  blotches(g, s, s, r, 70, "rgba(60,44,30,0.3)", "rgba(170,140,108,0.25)", 20, 90);
  speckle(g, s, s, r, 3500, ["#8b7258", "#3d2c1f", "#a08667", "#2e2117"], 1, 3.5, 0.6);
  for (let i = 0; i < 160; i += 1) {
    g.fillStyle = r() < 0.5 ? "rgba(150,138,120,0.7)" : "rgba(95,84,72,0.7)";
    g.beginPath();
    g.ellipse(r() * s, r() * s, 1.5 + r() * 3, 1 + r() * 2.5, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  grain(g, s, s, r, 22);
  return c;
}

function grassCanvas(r) {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  g.fillStyle = "#34442a";
  g.fillRect(0, 0, s, s);
  blotches(g, s, s, r, 50, "rgba(20,28,14,0.4)", "rgba(92,104,58,0.28)", 30, 120);
  const greens = ["#3e4f2b", "#24311b", "#4f5f33", "#6a6a3c", "#344426"];
  for (let i = 0; i < 9000; i += 1) {
    g.strokeStyle = greens[(r() * greens.length) | 0];
    g.globalAlpha = 0.35 + r() * 0.5;
    g.lineWidth = 0.8 + r() * 1.2;
    const x = r() * s;
    const y = r() * s;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 7);
    g.stroke();
  }
  g.globalAlpha = 1;
  grain(g, s, s, r, 14);
  return c;
}

function gravelCanvas(r) {
  const s = 256;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  g.fillStyle = "#6a6660";
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1400; i += 1) {
    const l = 70 + r() * 90;
    g.fillStyle = `rgb(${l},${l - 4},${l - 10})`;
    g.beginPath();
    g.ellipse(r() * s, r() * s, 1.5 + r() * 3.5, 1.2 + r() * 2.5, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  grain(g, s, s, r, 18);
  return c;
}

function paperCanvas(r) {
  const s = 256;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  g.fillStyle = "#e2bd72";
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 600; i += 1) {
    g.strokeStyle = r() < 0.5 ? "rgba(255,240,205,0.22)" : "rgba(150,110,40,0.14)";
    g.lineWidth = 0.6;
    const x = r() * s;
    const y = r() * s;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 16, y + (r() - 0.5) * 16);
    g.stroke();
  }
  grain(g, s, s, r, 10);
  return c;
}

function featherCanvas() {
  const s = 256;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.72, "#fff");
  grad.addColorStop(1, "#000");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

function glowCanvas() {
  const s = 128;
  const c = makeCanvas(s, s);
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.2, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.14)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

export function canvasTexture(c, { repeat = null, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  return t;
}

export function makeTextures(maxAniso) {
  const r = rng(1109);
  const aniso = Math.max(1, Math.min(8, maxAniso || 1));
  const T = (c, repeat, srgb = true) => canvasTexture(c, { repeat, srgb, aniso });
  return {
    aniso,
    wood: T(woodCanvas(r)),
    osb: T(osbCanvas(r)),
    concrete: T(concreteCanvas(r)),
    shingles: T(shingleCanvas(r)),
    dirt: T(dirtCanvas(r), [7, 7]),
    grass: T(grassCanvas(r), [170, 170]),
    gravel: T(gravelCanvas(r)),
    paper: T(paperCanvas(r)),
    feather: T(featherCanvas(), null, false),
    glow: T(glowCanvas()),
  };
}

export function makeMaterials(tex) {
  return {
    wood: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.8, metalness: 0 }),
    osb: new THREE.MeshStandardMaterial({ map: tex.osb, roughness: 0.86, metalness: 0 }),
    white: new THREE.MeshStandardMaterial({ color: 0xeceae3, roughness: 0.42, metalness: 0 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xa9cdf0,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.34,
      envMapIntensity: 1.8,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    }),
    door: new THREE.MeshStandardMaterial({ color: 0x2b3a4c, roughness: 0.48, metalness: 0.05 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.25, metalness: 1 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.32, metalness: 0.9 }),
    crane: new THREE.MeshStandardMaterial({ color: 0xe0a632, roughness: 0.42, metalness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.5, metalness: 0.6 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.4, metalness: 0.8 }),
    dumpster: new THREE.MeshStandardMaterial({ color: 0x2c5a61, roughness: 0.6, metalness: 0.35 }),
    concrete: new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.92 }),
  };
}

// ---------------------------------------------------------------------------
// Sky, light environment, ground, trees, mountains, stars
// ---------------------------------------------------------------------------
export const SKY_COLORS = {
  top: 0x0b1530,
  mid: 0x3b3f6b,
  horizon: 0xd58b5c,
  below: 0x15120f,
  sun: 0xffc993,
  fog: 0x6f5b5c,
};

function skyMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(SKY_COLORS.top) },
      mid: { value: new THREE.Color(SKY_COLORS.mid) },
      horizon: { value: new THREE.Color(SKY_COLORS.horizon) },
      below: { value: new THREE.Color(SKY_COLORS.below) },
      sunDir: { value: sunDir.clone().normalize() },
      sunColor: { value: new THREE.Color(SKY_COLORS.sun) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 below;
      uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float sun = max(dot(d, sunDir), 0.0);
        vec3 hz = mix(horizon * 0.72, horizon * 1.3, pow(sun, 3.0));
        vec3 col = mix(hz, mid, smoothstep(0.0, 0.2, h));
        col = mix(col, top, smoothstep(0.16, 0.7, h));
        col = mix(col, below, 1.0 - smoothstep(-0.07, 0.0, h));
        col += sunColor * (pow(sun, 900.0) * 5.0 + pow(sun, 14.0) * 0.28);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildSky(scene, sunDir) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(460, 48, 24), skyMaterial(sunDir));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  return sky;
}

/** A blurred copy of the sky so metal, glass and gloss pick up the dusk light. */
export function buildEnvironment(renderer, sunDir) {
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial(sunDir)));
  const warm = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd8a8, side: THREE.DoubleSide }),
  );
  warm.position.copy(sunDir.clone().normalize().multiplyScalar(40));
  warm.lookAt(0, 0, 0);
  envScene.add(warm);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0.03);
  pmrem.dispose();
  return target.texture;
}

export function buildGround(scene, tex) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 1, color: 0xc4cca8 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);
  const lot = new THREE.Mesh(
    new THREE.CircleGeometry(19, 96),
    new THREE.MeshStandardMaterial({
      map: tex.dirt,
      alphaMap: tex.feather,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  lot.rotation.x = -Math.PI / 2;
  lot.position.y = 0.01;
  lot.receiveShadow = true;
  lot.renderOrder = 0;
  scene.add(lot);
  return { grass, lot };
}

export function buildTrees(scene, seed = 4) {
  const r = rng(seed);
  const spots = [];
  while (spots.length < 90) {
    const a = r() * Math.PI * 2;
    const rad = 30 + r() * 48;
    const front = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.75;
    if (front && rad < 52) continue;
    spots.push({ x: Math.sin(a) * rad, z: Math.cos(a) * rad, s: 0.8 + r() * 0.9, ry: r() * 6 });
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b2a1f, roughness: 0.92, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 1 });
  const tiers = [
    [new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6).translate(0, 0.8, 0), bark],
    [new THREE.ConeGeometry(1.7, 2.8, 9).translate(0, 2.4, 0), mat],
    [new THREE.ConeGeometry(1.3, 2.5, 9).translate(0, 3.7, 0), mat],
    [new THREE.ConeGeometry(0.85, 2.2, 9).translate(0, 4.9, 0), mat],
  ];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  tiers.forEach(([geo, material]) => {
    const inst = new THREE.InstancedMesh(geo, material, spots.length);
    spots.forEach((p, i) => {
      q.setFromAxisAngle(UP, p.ry);
      m.compose(V(p.x, 0, p.z), q, V(p.s, p.s * (0.9 + (i % 5) * 0.06), p.s));
      inst.setMatrixAt(i, m);
    });
    inst.frustumCulled = false;
    scene.add(inst);
  });
}

export function buildMountains(scene, seed = 9) {
  const r = rng(seed);
  const layer = (radius, base, amps, color, snow, snowLine) => {
    const n = 220;
    const phases = amps.map(() => r() * 6.28);
    const pos = [];
    const col = [];
    const c0 = new THREE.Color(color).multiplyScalar(0.62);
    const c1 = new THREE.Color(color);
    const cs = new THREE.Color(snow);
    let peak = 0;
    const hs = [];
    for (let i = 0; i <= n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      let h = base;
      amps.forEach(([amp, freq], k) => {
        h += amp * (1 - Math.abs(Math.sin(a * freq + phases[k])));
      });
      hs.push(h);
      peak = Math.max(peak, h);
    }
    for (let i = 0; i <= n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.sin(a) * radius;
      const z = Math.cos(a) * radius;
      pos.push(x, -6, z, x, hs[i], z);
      const top = hs[i] > peak * snowLine ? cs : c1;
      col.push(c0.r, c0.g, c0.b, top.r, top.g, top.b);
    }
    const idx = [];
    for (let i = 0; i < n; i += 1) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    scene.add(mesh);
  };
  layer(300, 26, [[34, 3], [22, 5], [12, 11], [5, 23]], 0x5d6582, 0x9ea6bf, 0.8);
  layer(220, 12, [[20, 4], [12, 7], [6, 15], [2.5, 31]], 0x343a52, 0x7d86a1, 0.9);
}

export function buildStars(scene, seed = 3) {
  const r = rng(seed);
  const pts = [];
  while (pts.length < 1100 * 3) {
    const th = r() * Math.PI * 2;
    const y = 0.32 + r() * 0.68;
    const rad = Math.sqrt(1 - y * y);
    pts.push(Math.cos(th) * rad * 430, y * 430, Math.sin(th) * rad * 430);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xdfe6ff,
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      fog: false,
    }),
  );
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  scene.add(stars);
  return stars;
}

// ---------------------------------------------------------------------------
// Animated assembly: every board drops into place in build order, can shatter
// outward when the job is deleted, and flies home when it comes back.
// ---------------------------------------------------------------------------
class Build {
  constructor() {
    this.items = [];
  }

  board(mat, a, b, w, d, stage) {
    const dir = V(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = dir.length();
    dir.divideScalar(len || 1);
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    this.items.push({ mat, pos: V((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), quat, scale: V(w, len, d), stage });
  }

  box(mat, x, y, z, sx, sy, sz, stage, quat = null) {
    this.items.push({
      mat,
      pos: V(x, y, z),
      quat: quat ? quat.clone() : new THREE.Quaternion(),
      scale: V(sx, sy, sz),
      stage,
    });
  }

  mesh(object, stage) {
    this.items.push({
      mesh: object,
      pos: object.position.clone(),
      quat: object.quaternion.clone(),
      scale: object.scale.clone(),
      stage,
    });
  }
}

const STAGES = [
  [0, 0.07],
  [0.07, 0.3],
  [0.3, 0.4],
  [0.4, 0.55],
  [0.55, 0.72],
  [0.72, 0.86],
  [0.86, 0.985],
];
const LOCAL = 0.05;

function assemble(build, group, materials, seed) {
  const r = rng(seed);
  const byStage = new Map();
  build.items.forEach((item) => {
    if (!byStage.has(item.stage)) byStage.set(item.stage, []);
    byStage.get(item.stage).push(item);
  });
  byStage.forEach((list, stage) => {
    list.sort((p, q) => (p.pos.y - q.pos.y) * 3 + (p.pos.x - q.pos.x) * 0.12 + (p.pos.z - q.pos.z) * 0.04);
    const [s0, s1] = STAGES[stage];
    list.forEach((item, i) => {
      item.delay = s0 + (s1 - s0 - LOCAL) * (list.length > 1 ? i / (list.length - 1) : 0);
    });
  });
  build.items.forEach((item) => {
    item.drop = V((r() - 0.5) * 0.5, 2.6 + r() * 2.6, (r() - 0.5) * 0.5);
    item.dropSpin = V((r() - 0.5) * 0.35, (r() - 0.5) * 0.35, (r() - 0.5) * 0.35);
    const out = V(item.pos.x, 0, item.pos.z);
    if (out.lengthSq() < 0.01) out.set(r() - 0.5, 0, r() - 0.5);
    out.normalize();
    item.scatter = out.multiplyScalar(1.2 + r() * 3.2).add(V((r() - 0.5) * 2.2, 1.5 + r() * 5.5, (r() - 0.5) * 2.2));
    item.scatterSpin = V((r() - 0.5) * 4, (r() - 0.5) * 4, (r() - 0.5) * 4);
  });
  const sets = new Map();
  build.items.forEach((item) => {
    if (item.mesh) {
      group.add(item.mesh);
      return;
    }
    if (!sets.has(item.mat)) sets.set(item.mat, []);
    sets.get(item.mat).push(item);
  });
  const instanced = [];
  sets.forEach((list, key) => {
    const inst = new THREE.InstancedMesh(UNIT_BOX, materials[key], list.length);
    inst.castShadow = key !== "glass";
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    list.forEach((item, i) => {
      item.inst = inst;
      item.index = i;
    });
    group.add(inst);
    instanced.push(inst);
  });

  let mode = "drop";
  const m = new THREE.Matrix4();
  const p = V(0, 0, 0);
  const q = new THREE.Quaternion();
  const qs = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = V(0, 0, 0);
  return {
    count: build.items.length,
    setMode(next) {
      mode = next;
    },
    apply(b) {
      for (const item of build.items) {
        const k = clamp01((b - item.delay) / LOCAL);
        const f = 1 - easeOut(k);
        const off = mode === "drop" ? item.drop : item.scatter;
        const spin = mode === "drop" ? item.dropSpin : item.scatterSpin;
        p.copy(item.pos).addScaledVector(off, f);
        e.set(spin.x * f, spin.y * f, spin.z * f);
        qs.setFromEuler(e);
        q.copy(item.quat).premultiply(qs);
        const hidden = mode === "drop" && k <= 0;
        if (item.mesh) {
          item.mesh.position.copy(p);
          item.mesh.quaternion.copy(q);
          item.mesh.scale.copy(item.scale);
          item.mesh.visible = !hidden;
        } else {
          s.copy(item.scale);
          if (hidden) s.set(0, 0, 0);
          m.compose(p, q, s);
          item.inst.setMatrixAt(item.index, m);
        }
      }
      instanced.forEach((inst) => {
        inst.instanceMatrix.needsUpdate = true;
      });
    },
  };
}

// ---------------------------------------------------------------------------
// The house: 8.4 m x 6.6 m, two stories, framed in 2x4s on 16" centers
// ---------------------------------------------------------------------------
function sheathRects(a0, a1, y0, y1, holes) {
  const cuts = new Set([a0, a1]);
  holes.forEach((h) => {
    if (h.a1 > a0 && h.a0 < a1) {
      cuts.add(Math.max(a0, h.a0));
      cuts.add(Math.min(a1, h.a1));
    }
  });
  for (let s = a0 + 1.22; s < a1 - 0.05; s += 1.22) cuts.add(s);
  const xs = [...cuts].sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    const s0 = xs[i];
    const s1 = xs[i + 1];
    if (s1 - s0 < 0.02) continue;
    const mid = (s0 + s1) / 2;
    const hole = holes.find((h) => mid > h.a0 && mid < h.a1);
    const spans = hole ? [[y0, y0 + hole.sill], [y0 + hole.head, y1]] : [[y0, y1]];
    spans.forEach(([b0, b1]) => {
      if (b1 - b0 < 0.03) return;
      const ys = [b0];
      const seam = y0 + 2.44;
      if (seam > b0 + 0.03 && seam < b1 - 0.03) ys.push(seam);
      ys.push(b1);
      for (let j = 0; j < ys.length - 1; j += 1) out.push([s0, s1, ys[j], ys[j + 1]]);
    });
  }
  return out;
}

export function buildHouse(materials, tex) {
  const group = new THREE.Group();
  group.rotation.y = HOUSE_TURN;
  const B = new Build();
  const W = 8.4;
  const D = 6.6;
  const hw = W / 2;
  const hd = D / 2;
  const SLAB = 0.35;
  const WALL = 2.6;
  const JOIST = 0.24;
  const SUB = 0.018;
  const T = 0.09;
  const t = 0.04;
  const y1 = SLAB;
  const deck = y1 + WALL;
  const y2 = deck + JOIST + SUB;
  const yR = y2 + WALL;
  const OPEN = { x0: -hw, x1: -3.0, z0: -1.95, z1: 2.0 };

  // ---- stage 0: slab and front stoop
  const slabTex = tex.concrete.clone();
  slabTex.repeat.set(3, 2.4);
  slabTex.needsUpdate = true;
  const slabMat = new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.92 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, SLAB, D + 0.24), slabMat);
  slab.position.set(0, SLAB / 2, 0);
  slab.castShadow = true;
  slab.receiveShadow = true;
  B.mesh(slab, 0);
  [[SLAB, 0.35, hd + 0.29], [SLAB / 2, 0.35, hd + 0.64]].forEach(([h, d, z]) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, d), materials.concrete);
    step.position.set(0, h / 2, z);
    step.castShadow = true;
    step.receiveShadow = true;
    B.mesh(step, 0);
  });

  // ---- installed windows and doors
  function install(axis, c, side, y, h, stage) {
    const w = h.a1 - h.a0;
    const hgt = h.head - h.sill;
    const am = (h.a0 + h.a1) / 2;
    const ym = y + h.sill + hgt / 2;
    const f = 0.06;
    const put = (mat, da, dy, la, ly, dn, thick) => {
      if (axis === "x") B.box(mat, am + da, ym + dy, c + dn, la, ly, thick, stage);
      else B.box(mat, c + dn, ym + dy, am + da, thick, ly, la, stage);
    };
    put("white", -w / 2 + f / 2, 0, f, hgt, 0, 0.11);
    put("white", w / 2 - f / 2, 0, f, hgt, 0, 0.11);
    put("white", 0, hgt / 2 - f / 2, w, f, 0, 0.11);
    if (h.kind === "door") {
      put("door", 0, -f / 2, w - 2 * f, hgt - f, side * 0.02, 0.045);
      put("brass", w / 2 - f - 0.1, -0.06, 0.05, 0.05, side * 0.06, 0.05);
      return;
    }
    put("white", 0, -hgt / 2 + f / 2, w, f, 0, 0.11);
    put("white", 0, -hgt / 2 + 0.02, w + 0.12, 0.04, side * 0.07, 0.06);
    if (w > 1.3) put("white", 0, 0, 0.05, hgt - 2 * f, 0, 0.08);
    put("glass", 0, 0, w - 2 * f, hgt - 2 * f, side * 0.012, 0.012);
  }

  // ---- a framed wall, with optional OSB sheathing on the outside
  function wall({ axis, c, a0, a1, y, holes = [], stage, sheath = null, side = 1 }) {
    const at = (a, yy) => (axis === "x" ? V(a, yy, c) : V(c, yy, a));
    const along = (p, q, vert, across) =>
      axis === "x" ? B.board("wood", p, q, vert, across, stage) : B.board("wood", p, q, across, vert, stage);
    const stud = (a, bottom, top) =>
      axis === "x"
        ? B.board("wood", at(a, bottom), at(a, top), t, T, stage)
        : B.board("wood", at(a, bottom), at(a, top), T, t, stage);
    const bottom = y + t;
    const top = y + WALL - 2 * t;
    along(at(a0, y + t / 2), at(a1, y + t / 2), t, T);
    along(at(a0, y + WALL - 1.5 * t), at(a1, y + WALL - 1.5 * t), t, T);
    along(at(a0, y + WALL - t / 2), at(a1, y + WALL - t / 2), t, T);
    const hit = (a) => holes.find((h) => a > h.a0 - 0.1 && a < h.a1 + 0.1);
    const spots = [];
    for (let a = a0 + t / 2; a < a1 - t; a += 0.406) spots.push(a);
    spots.push(a1 - t / 2);
    spots.forEach((a) => {
      const h = hit(a);
      if (!h) {
        stud(a, bottom, top);
        return;
      }
      if (h.sill > 0.05 && a > h.a0 && a < h.a1) stud(a, bottom, y + h.sill - t);
      if (y + h.head + 0.24 < top - 0.04 && a > h.a0 && a < h.a1) stud(a, y + h.head + 0.24, top);
    });
    holes.forEach((h) => {
      stud(h.a0 - 1.5 * t, bottom, top);
      stud(h.a1 + 1.5 * t, bottom, top);
      stud(h.a0 - t / 2, bottom, y + h.head);
      stud(h.a1 + t / 2, bottom, y + h.head);
      along(at(h.a0 - t, y + h.head + 0.12), at(h.a1 + t, y + h.head + 0.12), 0.24, T);
      if (h.sill > 0.05) along(at(h.a0, y + h.sill - t / 2), at(h.a1, y + h.sill - t / 2), t, T);
    });
    if (!sheath) return;
    const [s0, s1] = sheath;
    const off = side * (T / 2 + 0.007);
    sheathRects(Math.max(a0, s0), Math.min(a1, s1), y, y + WALL, holes).forEach(([p0, p1, q0, q1]) => {
      const am = (p0 + p1) / 2;
      const ym = (q0 + q1) / 2;
      const len = p1 - p0 - 0.004;
      const ht = q1 - q0 - 0.004;
      if (axis === "x") B.box("osb", am, ym, c + off, len, ht, 0.012, 6);
      else B.box("osb", c + off, ym, am, 0.012, ht, len, 6);
    });
    holes.forEach((h) => {
      if (h.a1 > s0 && h.a0 < s1) install(axis, c, side, y, h, 6);
    });
  }

  const win = (a0, a1) => ({ a0, a1, sill: 0.9, head: 2.1, kind: "window" });
  const door = (a0, a1) => ({ a0, a1, sill: 0, head: 2.1, kind: "door" });
  const slider = (a0, a1) => ({ a0, a1, sill: 0, head: 2.1, kind: "slider" });
  const inner = [-hd + T, hd - T];

  // ---- stage 1: first-floor walls (front-left and the stair side stay open framing)
  wall({ axis: "x", c: hd - T / 2, a0: -hw, a1: hw, y: y1, stage: 1, side: 1, sheath: [-0.62, hw], holes: [win(-3.0, -1.6), door(-0.45, 0.45), win(1.6, 3.0)] });
  wall({ axis: "x", c: -hd + T / 2, a0: -hw, a1: hw, y: y1, stage: 1, side: -1, sheath: [-hw, hw], holes: [win(-2.6, -1.4), slider(0.6, 2.4)] });
  wall({ axis: "z", c: -hw + T / 2, a0: inner[0], a1: inner[1], y: y1, stage: 1, side: -1, holes: [win(-0.6, 0.6)] });
  wall({ axis: "z", c: hw - T / 2, a0: inner[0], a1: inner[1], y: y1, stage: 1, side: 1, sheath: [-hd, hd], holes: [win(-1.0, 1.0)] });

  // ---- stage 2: second-floor deck (rim, joists, stair opening)
  const jy = deck + JOIST / 2;
  B.board("wood", V(-hw, jy, hd - t / 2), V(hw, jy, hd - t / 2), JOIST, t, 2);
  B.board("wood", V(-hw, jy, -hd + t / 2), V(hw, jy, -hd + t / 2), JOIST, t, 2);
  B.board("wood", V(-hw + t / 2, jy, -hd + t), V(-hw + t / 2, jy, hd - t), t, JOIST, 2);
  B.board("wood", V(hw - t / 2, jy, -hd + t), V(hw - t / 2, jy, hd - t), t, JOIST, 2);
  const joist = (x, z0, z1) => B.board("wood", V(x, jy, z0), V(x, jy, z1), t, JOIST, 2);
  for (let x = -hw + 0.406; x < hw - 0.1; x += 0.406) {
    if (x < OPEN.x1 + 0.08) {
      joist(x, -hd + t, OPEN.z0 - t);
      joist(x, OPEN.z1 + t, hd - t);
    } else {
      joist(x, -hd + t, hd - t);
    }
  }
  joist(OPEN.x1 + t / 2, -hd + t, hd - t);
  joist(OPEN.x1 + 1.5 * t, -hd + t, hd - t);
  B.board("wood", V(OPEN.x0 + t, jy, OPEN.z0 - t / 2), V(OPEN.x1, jy, OPEN.z0 - t / 2), JOIST, t, 2);
  B.board("wood", V(OPEN.x0 + t, jy, OPEN.z1 + t / 2), V(OPEN.x1, jy, OPEN.z1 + t / 2), JOIST, t, 2);

  // ---- stage 3: subfloor sheets (two not down yet) and the stairs
  const sy = deck + JOIST + SUB / 2;
  [
    [OPEN.x1, hw, -hd, hd],
    [-hw, OPEN.x1, -hd, OPEN.z0],
    [-hw, OPEN.x1, OPEN.z1, hd],
  ].forEach(([x0, x1, z0, z1]) => {
    for (let x = x0; x < x1 - 0.02; x += 1.22) {
      for (let z = z0; z < z1 - 0.02; z += 2.44) {
        const xe = Math.min(x + 1.22, x1);
        const ze = Math.min(z + 2.44, z1);
        const cx = (x + xe) / 2;
        const cz = (z + ze) / 2;
        if (cx > 2.2 && cz < -1.2) continue;
        B.box("osb", cx, sy, cz, xe - x - 0.004, SUB, ze - z - 0.004, 3);
      }
    }
  });
  const RISERS = 15;
  const rise = (y2 - y1) / RISERS;
  const run = 0.26;
  const zTop = OPEN.z0;
  const zBot = zTop + (RISERS - 1) * run;
  const sx0 = -hw + T + 0.02;
  const sx1 = OPEN.x1 - 0.02;
  const scx = (sx0 + sx1) / 2;
  const lineY = (z) => y1 + rise * ((zBot - z) / run + 0.5) - 0.2;
  const zs0 = zBot - 0.29;
  [sx0 + 0.03, scx, sx1 - 0.03].forEach((x) => B.board("wood", V(x, lineY(zs0), zs0), V(x, lineY(zTop), zTop), t, 0.26, 3));
  for (let i = 1; i < RISERS; i += 1) {
    B.box("wood", scx, y1 + i * rise - 0.018, zBot - (i - 0.5) * run, sx1 - sx0, 0.035, run + 0.025, 3);
  }
  const railX = sx1 + 0.05;
  B.board("wood", V(railX, y1, zBot - 0.1), V(railX, y1 + 1.12, zBot - 0.1), 0.08, 0.08, 3);
  B.board("wood", V(railX, y1 + rise + 0.92, zBot - 0.13), V(railX, y1 + (RISERS - 1) * rise + 0.92, zTop + 0.13), 0.05, 0.08, 3);
  B.board("wood", V(railX, y1 + rise + 0.5, zBot - 0.13), V(railX, y1 + (RISERS - 1) * rise + 0.5, zTop + 0.13), 0.04, 0.06, 3);

  // ---- stage 4: second-floor walls and guard rails around the stair opening
  wall({ axis: "x", c: hd - T / 2, a0: -hw, a1: hw, y: y2, stage: 4, side: 1, holes: [win(-3.0, -1.8), win(-0.6, 0.6), win(1.8, 3.0)] });
  wall({ axis: "x", c: -hd + T / 2, a0: -hw, a1: hw, y: y2, stage: 4, side: -1, sheath: [-hw, hw], holes: [win(-2.6, -1.4), win(1.4, 2.6)] });
  wall({ axis: "z", c: -hw + T / 2, a0: inner[0], a1: inner[1], y: y2, stage: 4, side: -1, holes: [win(-0.6, 0.6)] });
  wall({ axis: "z", c: hw - T / 2, a0: inner[0], a1: inner[1], y: y2, stage: 4, side: 1, sheath: [-hd, hd], holes: [win(-0.7, 0.7)] });
  const post = (x, z) => B.board("wood", V(x, y2, z), V(x, y2 + 1.05, z), t, T, 4);
  const gx = OPEN.x1 + 0.12;
  [OPEN.z0 + 0.1, 0, OPEN.z1 - 0.1].forEach((z) => post(gx, z));
  [1.0, 0.55].forEach((h) => B.board("wood", V(gx + 0.05, y2 + h, OPEN.z0 + 0.05), V(gx + 0.05, y2 + h, OPEN.z1 - 0.05), 0.04, 0.09, 4));
  [-3.6].forEach((x) => post(x, OPEN.z1 + 0.1));
  [1.0, 0.55].forEach((h) => B.board("wood", V(-hw + T, y2 + h, OPEN.z1 + 0.15), V(OPEN.x1 + 0.1, y2 + h, OPEN.z1 + 0.15), 0.09, 0.04, 4));

  // ---- stage 5: roof trusses, gable studs, ridge and fascia
  const pitch = 0.5;
  const over = 0.45;
  const eaveY = yR + 0.125 - over * pitch;
  const ridgeY = yR + 0.125 + hd * pitch;
  const chordY = (z) => yR + 0.125 + (hd - Math.abs(z)) * pitch;
  const N = 15;
  for (let i = 0; i < N; i += 1) {
    const x = -hw + 0.03 + (i * (W - 0.06)) / (N - 1);
    B.board("wood", V(x, yR + 0.045, -hd), V(x, yR + 0.045, hd), t, T, 5);
    B.board("wood", V(x, eaveY, hd + over), V(x, ridgeY, 0), t, 0.14, 5);
    B.board("wood", V(x, eaveY, -hd - over), V(x, ridgeY, 0), t, 0.14, 5);
    B.board("wood", V(x, yR + 0.09, 0), V(x, ridgeY - 0.07, 0), t, T, 5);
    B.board("wood", V(x, yR + 0.1, 0.06), V(x, chordY(hd / 2) - 0.07, hd / 2), t, T, 5);
    B.board("wood", V(x, yR + 0.1, -0.06), V(x, chordY(hd / 2) - 0.07, -hd / 2), t, T, 5);
    if (i === 0 || i === N - 1) {
      [-2.4, -1.6, -0.8, 0.8, 1.6, 2.4].forEach((z) => B.board("wood", V(x, yR + 0.09, z), V(x, chordY(z) - 0.07, z), t, T, 5));
    }
  }
  B.board("wood", V(-hw - 0.2, ridgeY + 0.03, 0), V(hw + 0.2, ridgeY + 0.03, 0), 0.22, t, 5);
  B.board("wood", V(-hw - 0.2, eaveY - 0.08, hd + over + 0.02), V(hw + 0.2, eaveY - 0.08, hd + over + 0.02), 0.2, 0.03, 5);
  B.board("wood", V(-hw - 0.2, eaveY - 0.08, -hd - over - 0.02), V(hw + 0.2, eaveY - 0.08, -hd - over - 0.02), 0.2, 0.03, 5);

  // ---- stage 6: roof sheathing and shingles, the work light and the ladder
  const ang = Math.atan(pitch);
  const L = Math.hypot(hd + over, (hd + over) * pitch);
  const slope = {
    front: {
      eave: V(0, eaveY, hd + over),
      up: V(0, Math.sin(ang), -Math.cos(ang)),
      n: V(0, Math.cos(ang), Math.sin(ang)),
      q: new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), ang),
    },
    back: {
      eave: V(0, eaveY, -hd - over),
      up: V(0, Math.sin(ang), Math.cos(ang)),
      n: V(0, Math.cos(ang), -Math.sin(ang)),
      q: new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -ang),
    },
  };
  const onRoof = (side, x0, x1, s0, s1, lift) => {
    const sl = slope[side];
    const c = sl.eave.clone().addScaledVector(sl.up, (s0 + s1) / 2).addScaledVector(sl.n, lift);
    c.x = (x0 + x1) / 2;
    return { c, q: sl.q, sx: x1 - x0, sz: s1 - s0 };
  };
  const sheets = (side, x0, x1) => {
    for (let x = x0; x < x1 - 0.02; x += 2.44) {
      for (let s = 0; s < L - 0.02; s += 1.22) {
        const p = onRoof(side, x, Math.min(x + 2.44, x1), s, Math.min(s + 1.22, L), 0.078);
        B.box("osb", p.c.x, p.c.y, p.c.z, p.sx - 0.004, 0.015, p.sz - 0.004, 6, p.q);
      }
    }
  };
  sheets("back", -hw - 0.2, hw + 0.2);
  sheets("front", 0.4, hw + 0.2);
  const shingles = (side, x0, x1, frac) => {
    const p = onRoof(side, x0, x1, 0, L * frac, 0.091);
    const map = tex.shingles.clone();
    map.repeat.set(p.sx, p.sz);
    map.needsUpdate = true;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(p.sx, 0.01, p.sz),
      new THREE.MeshStandardMaterial({ map, roughness: 0.88 }),
    );
    mesh.position.copy(p.c);
    mesh.quaternion.copy(p.q);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    B.mesh(mesh, 6);
  };
  shingles("back", -hw - 0.2, hw + 0.2, 0.62);
  shingles("front", 0.4, hw + 0.2, 0.36);

  const lamp = new THREE.Group();
  const legMat = materials.dark;
  for (let k = 0; k < 3; k += 1) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), legMat);
    const a = (k / 3) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.22, 0.45, Math.sin(a) * 0.22);
    leg.rotation.set(-Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45);
    lamp.add(leg);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 6), legMat);
  pole.position.y = 1.35;
  const head = new THREE.Mesh(new RoundedBox(0.34, 0.26, 0.14, 2, 0.03), materials.crane);
  head.position.set(0, 1.92, 0);
  head.rotation.y = -0.9;
  const lens = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false }),
  );
  lens.position.set(0, 0, 0.071);
  head.add(lens);
  lamp.add(pole, head);
  lamp.position.set(1.6, y1, 0.8);
  lamp.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  B.mesh(lamp, 6);
  const lampLight = new THREE.PointLight(0xffb36b, 0, 14, 2);
  lampLight.position.set(1.45, y1 + 1.95, 0.75);
  group.add(lampLight);

  const lx = [3.3, 3.75];
  const lb = hd + 1.25;
  const lt = hd + 0.12;
  const ly = y2 + 0.5;
  lx.forEach((x) => B.board("alu", V(x, 0.02, lb), V(x, ly, lt), 0.04, 0.07, 6));
  for (let k = 1; k < 13; k += 1) {
    const f = k / 13;
    const y = 0.02 + (ly - 0.02) * f;
    const z = lb + (lt - lb) * f;
    B.board("alu", V(lx[0], y, z), V(lx[1], y, z), 0.03, 0.03, 6);
  }

  const assembly = assemble(B, group, materials, 2026);
  return {
    group,
    assembly,
    lampLight,
    size: { W, D, top: ridgeY + 0.15 },
    stairs: V(scx, y1 + 1.4, 0),
  };
}

// ---------------------------------------------------------------------------
// Tower crane: lattice mast, slewing jib with trolley, hook and a lumber load
// ---------------------------------------------------------------------------
function latticeMesh(bars, material) {
  const inst = new THREE.InstancedMesh(UNIT_BOX, material, bars.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  bars.forEach((bar, i) => {
    const dir = V(bar.b.x - bar.a.x, bar.b.y - bar.a.y, bar.b.z - bar.a.z);
    const len = dir.length();
    q.setFromUnitVectors(UP, dir.divideScalar(len));
    m.compose(V((bar.a.x + bar.b.x) / 2, (bar.a.y + bar.b.y) / 2, (bar.a.z + bar.b.z) / 2), q, V(bar.t, len, bar.t));
    inst.setMatrixAt(i, m);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.frustumCulled = false;
  return inst;
}

export function buildCrane(materials, glowTex) {
  const crane = new THREE.Group();
  const H = 12.5;
  const S = 1.1;
  const h0 = 0.9;
  const mast = [];
  const bar = (list, a, b, t) => list.push({ a, b, t });
  const corners = [[-S / 2, -S / 2], [S / 2, -S / 2], [S / 2, S / 2], [-S / 2, S / 2]];
  corners.forEach(([x, z]) => bar(mast, V(x, h0, z), V(x, H, z), 0.11));
  const bays = 11;
  const bh = (H - h0) / bays;
  for (let j = 0; j < bays; j += 1) {
    const ya = h0 + j * bh;
    const yb = ya + bh;
    for (let k = 0; k < 4; k += 1) {
      const [x0, z0] = corners[k];
      const [x1, z1] = corners[(k + 1) % 4];
      bar(mast, V(x0, yb, z0), V(x1, yb, z1), 0.06);
      if (j % 2 === 0) bar(mast, V(x0, ya, z0), V(x1, yb, z1), 0.05);
      else bar(mast, V(x1, ya, z1), V(x0, yb, z0), 0.05);
    }
  }
  crane.add(latticeMesh(mast, materials.crane));
  const foot = new THREE.Mesh(new THREE.BoxGeometry(3.2, h0, 3.2), materials.concrete);
  foot.position.y = h0 / 2;
  foot.castShadow = true;
  foot.receiveShadow = true;
  crane.add(foot);

  const slew = new THREE.Group();
  slew.position.y = H;
  crane.add(slew);
  const top = [];
  const JL = 13.5;
  for (let x = 0.6; x < JL - 0.01; x += 1) {
    const xe = Math.min(x + 1, JL);
    bar(top, V(x, 0.2, -0.45), V(xe, 0.2, 0.45), 0.04);
    bar(top, V(x, 0.2, 0.45), V(xe, 1.15, 0), 0.045);
    bar(top, V(x, 0.2, -0.45), V(xe, 1.15, 0), 0.045);
  }
  bar(top, V(0.6, 0.2, -0.45), V(JL, 0.2, -0.45), 0.09);
  bar(top, V(0.6, 0.2, 0.45), V(JL, 0.2, 0.45), 0.09);
  bar(top, V(0.6, 1.15, 0), V(JL, 1.15, 0), 0.09);
  for (let x = -0.6; x > -5.6; x -= 1) {
    bar(top, V(x, 0.25, -0.5), V(x - 1, 0.25, 0.5), 0.05);
  }
  bar(top, V(-0.6, 0.25, -0.5), V(-5.6, 0.25, -0.5), 0.09);
  bar(top, V(-0.6, 0.25, 0.5), V(-5.6, 0.25, 0.5), 0.09);
  corners.forEach(([x, z]) => bar(top, V(x * 0.8, 0.4, z * 0.8), V(0, 3.4, 0), 0.08));
  slew.add(latticeMesh(top, materials.crane));
  const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.4, 24), materials.dark);
  turntable.position.y = 0.2;
  slew.add(turntable);
  const cab = new THREE.Mesh(new RoundedBox(1.1, 1.15, 1.0, 2, 0.08), materials.white);
  cab.position.set(0.3, 0.75, 0.95);
  const cabGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), materials.glass);
  cabGlass.position.set(0.86, 0.85, 0.95);
  cabGlass.rotation.y = Math.PI / 2;
  slew.add(cab, cabGlass);
  for (let k = 0; k < 3; k += 1) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 1.1), materials.concrete);
    block.position.set(-4.6 - k * 0.52, -0.3, 0);
    block.castShadow = true;
    slew.add(block);
  }
  const pendant = (a, b) => {
    const dir = V(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = dir.length();
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 5), materials.cable);
    line.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    line.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
    slew.add(line);
  };
  pendant(V(0, 3.4, 0), V(8.5, 1.15, 0));
  pendant(V(0, 3.4, 0), V(-5.4, 0.3, 0));

  const trolley = new THREE.Group();
  trolley.position.set(8, 0.08, 0);
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.95), materials.dark);
  trolley.add(carriage);
  const drop = 2.8;
  [-0.12, 0.12].forEach((z) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, drop, 4), materials.cable);
    c.position.set(0, -drop / 2, z);
    trolley.add(c);
  });
  const hook = new THREE.Group();
  hook.position.y = -drop;
  const block = new THREE.Mesh(new RoundedBox(0.34, 0.42, 0.22, 2, 0.04), materials.crane);
  const hookCurve = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 16, Math.PI * 1.4), materials.dark);
  hookCurve.position.y = -0.3;
  hook.add(block, hookCurve);
  const load = new THREE.Group();
  for (let i = 0; i < 9; i += 1) {
    const lumber = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.09, 0.14), materials.wood);
    lumber.position.set(0, -1.4 + Math.floor(i / 3) * 0.095, (i % 3) * 0.145 - 0.145);
    lumber.castShadow = true;
    load.add(lumber);
  }
  [-0.8, 0.8].forEach((x) => {
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.3, 4), materials.cable);
    strap.position.set(x * 0.5, -0.75, 0);
    strap.rotation.z = x > 0 ? -0.55 : 0.55;
    load.add(strap);
  });
  hook.add(load);
  trolley.add(hook);
  slew.add(trolley);

  const beaconMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xff3b30,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beacons = [V(0, 3.5, 0), V(JL, 1.3, 0)].map((p) => {
    const s = new THREE.Sprite(beaconMat);
    s.position.copy(p);
    s.scale.setScalar(0.9);
    slew.add(s);
    return s;
  });
  crane.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return {
    group: crane,
    load,
    update(t, motion, aimYaw) {
      slew.rotation.y = aimYaw + Math.sin(t * 0.07) * 0.55 * motion;
      trolley.position.x = 8 + Math.sin(t * 0.11 + 1) * 2.2 * motion;
      hook.rotation.y = Math.sin(t * 0.3) * 0.25 * motion;
      beaconMat.opacity = Math.sin(t * 3.4) > 0.2 ? 1 : 0.12;
    },
  };
}

// ---------------------------------------------------------------------------
// Site props: lumber pile, roll-off dumpster, gravel drive, the job sign
// ---------------------------------------------------------------------------
function drawSign(c, jobName, company) {
  const g = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  g.fillStyle = "#f3efe6";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#e8b64c";
  g.fillRect(0, 0, w, 170);
  g.fillStyle = "#1b1407";
  g.font = `800 96px ${FONT}`;
  g.textBaseline = "middle";
  g.fillText("SAMPLE JOB", 56, 88);
  const place = String(jobName || "").split(" - ").slice(1).join(" - ") || "Main Street";
  g.fillStyle = "#1d222b";
  g.font = `750 88px ${FONT}`;
  g.fillText(place, 56, 290);
  g.fillStyle = company ? "#3a404c" : "#8b919c";
  g.font = `600 50px ${FONT}`;
  g.fillText(company || "Company name not set", 56, 390);
  g.fillStyle = "#d9d3c4";
  g.fillRect(56, 462, w - 112, 4);
  g.fillStyle = "#e8b64c";
  roundRect(g, 56, 510, 74, 56, 8).fill();
  g.fillRect(56, 500, 34, 14);
  g.fillStyle = "#3a404c";
  g.font = `650 48px ${FONT}`;
  g.fillText("One folder for this job", 156, 540);
}

export function buildProps(materials, tex) {
  const g = new THREE.Group();
  g.rotation.y = HOUSE_TURN;

  const drive = tex.gravel.clone();
  drive.repeat.set(1.6, 7);
  drive.needsUpdate = true;
  const gravel = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 15),
    new THREE.MeshStandardMaterial({ map: drive, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.set(2.3, 0.02, 3.3 + 7.6);
  gravel.receiveShadow = true;
  g.add(gravel);

  const boards = [];
  for (let layer = 0; layer < 6; layer += 1) {
    for (let i = 0; i < 7; i += 1) boards.push({ x: 5.7 + i * 0.16, y: 0.16 + layer * 0.12, z: 1.6, sx: 0.14, sy: 0.04, sz: 3.6 });
    [0.2, 1.6, 3.0].forEach((z) => boards.push({ x: 6.18, y: 0.12 + layer * 0.12, z, sx: 1.15, sy: 0.03, sz: 0.06 }));
  }
  const pile = new THREE.InstancedMesh(UNIT_BOX, materials.wood, boards.length);
  const m = new THREE.Matrix4();
  boards.forEach((b, i) => {
    m.compose(V(b.x, b.y, b.z), new THREE.Quaternion(), V(b.sx, b.sy, b.sz));
    pile.setMatrixAt(i, m);
  });
  pile.castShadow = true;
  pile.receiveShadow = true;
  pile.frustumCulled = false;
  g.add(pile);

  const profile = new THREE.Shape();
  profile.moveTo(-2.4, 0.12);
  profile.lineTo(2.2, 0.12);
  profile.lineTo(2.8, 1.35);
  profile.lineTo(-2.4, 1.35);
  profile.closePath();
  const body = new THREE.ExtrudeGeometry(profile, { depth: 2.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  body.rotateY(Math.PI / 2);
  body.translate(-1.05, 0, 0);
  const dumpster = new THREE.Mesh(body, materials.dumpster);
  dumpster.position.set(5.7, 0, -4.6);
  dumpster.rotation.y = 0.12;
  dumpster.castShadow = true;
  dumpster.receiveShadow = true;
  const fill = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 4.9), new THREE.MeshStandardMaterial({ color: 0x3a2f25, roughness: 1 }));
  fill.position.set(0, 1.28, -0.1);
  dumpster.add(fill);
  [[0.4, 1.42, 0.6, 0.4], [-0.5, 1.45, -1.2, -0.3], [0.1, 1.5, -0.2, 0.9]].forEach(([x, y, z, r]) => {
    const scrap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 2.2), materials.wood);
    scrap.position.set(x, y, z);
    scrap.rotation.set(0.25, r, 0.1);
    scrap.castShadow = true;
    dumpster.add(scrap);
  });
  g.add(dumpster);

  const signCanvas = makeCanvas(1024, 640);
  drawSign(signCanvas, "SAMPLE Job - Main Street", "");
  const signTex = canvasTexture(signCanvas, { aniso: tex.aniso });
  const sign = new THREE.Group();
  const face = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.55 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.6 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.05), [edge, edge, edge, edge, face, edge]);
  board.position.y = 1.95;
  board.castShadow = true;
  [-1.0, 1.0].forEach((x) => {
    const postMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.7, 0.09), materials.wood);
    postMesh.position.set(x, 1.35, -0.05);
    postMesh.castShadow = true;
    sign.add(postMesh);
  });
  sign.add(board);
  sign.position.set(-1.7, 0, 3.3 + 2.5);
  sign.rotation.y = -0.32;
  g.add(sign);

  return {
    group: g,
    setSign(jobName, company) {
      drawSign(signCanvas, jobName, company);
      signTex.needsUpdate = true;
    },
  };
}
