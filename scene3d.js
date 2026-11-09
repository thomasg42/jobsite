/**
 * Jobsite 3D scene for the Scott sample.
 *
 *   createJobsite(canvas, { steps, onSelect, onFrame, onUserCamera, insets })
 *     -> { setView, focus, overview, zoom, pulse, replay, resize, advance, destroy }
 *
 * app.js owns the data. This file draws it: the house under construction is
 * the job (step 1). Around it, in workflow order, float the five job folders,
 * the backup safe and the bookkeeper's laptop (steps 2 to 8), joined by a
 * numbered path on the ground. Streams carry files into the job and out to
 * the backup and the bookkeeper.
 */
import * as THREE from "./vendor/three.module.js";
import {
  FONT,
  HOUSE_TOP,
  HOUSE_TURN,
  RoundedBox,
  SKY_COLORS,
  buildCrane,
  buildEnvironment,
  buildGround,
  buildHouse,
  buildMountains,
  buildProps,
  buildSky,
  buildStars,
  buildTrees,
  canvasTexture,
  clamp01,
  easeInOut,
  easeOut,
  makeCanvas,
  makeMaterials,
  makeTextures,
  roundRect,
} from "./world3d.js?v=20261109b";

const GOLD = 0xe8b64c;
const ALERT = 0xff5a4e;
const STREAM = { folder: 0xf0c060, vault: 0x7cc0ff, laptop: 0x7dffc4 };
const RING = 11.5;
const ARC = (112 * Math.PI) / 180;
const STATION_Y = 3.3;
const BASE_SCALE = 1.4;
const HEART = new THREE.Vector3(0, 4.3, 0);
const KIND = {
  photos: "folder",
  quote: "folder",
  changeOrders: "folder",
  invoices: "folder",
  receipts: "folder",
  backup: "vault",
  bookkeeper: "laptop",
};
const TABS = [0.14, 0.64, 1.14, 0.14, 0.64];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function lerpAngle(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(r, 0);
  s.lineTo(w - r, 0);
  s.quadraticCurveTo(w, 0, w, r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(r, h);
  s.quadraticCurveTo(0, h, 0, h - r);
  s.lineTo(0, r);
  s.quadraticCurveTo(0, 0, r, 0);
  return s;
}

function folderShape(w, h, t0, tabW, tabH, r) {
  const s = new THREE.Shape();
  const sl = 0.07;
  const rt = 0.05;
  const t1 = t0 + tabW;
  s.moveTo(r, 0);
  s.lineTo(w - r, 0);
  s.quadraticCurveTo(w, 0, w, r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(t1 + sl, h);
  s.lineTo(t1 + sl * 0.25, h + tabH - rt);
  s.quadraticCurveTo(t1, h + tabH, t1 - rt, h + tabH);
  s.lineTo(t0 + rt, h + tabH);
  s.quadraticCurveTo(t0, h + tabH, t0 - sl * 0.25, h + tabH - rt);
  s.lineTo(t0 - sl, h);
  s.lineTo(r, h);
  s.quadraticCurveTo(0, h, 0, h - r);
  s.lineTo(0, r);
  s.quadraticCurveTo(0, 0, r, 0);
  return s;
}

function roundedPlane(w, h, r) {
  const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 6);
  geo.translate(-w / 2, -h / 2, 0);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return geo;
}

const EXTRUDE = { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 };

// ---------------------------------------------------------------------------
// Printed things: file labels, papers, the laptop screen, ground numbers
// ---------------------------------------------------------------------------
function fitText(g, text, weight, max, width) {
  let size = max;
  g.font = `${weight} ${size}px ${FONT}`;
  while (g.measureText(text).width > width && size > 18) {
    size -= 4;
    g.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

function drawFolderLabel(c, n, title) {
  const g = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = "#fbfaf5";
  roundRect(g, 6, 6, w - 12, h - 12, 44).fill();
  g.strokeStyle = "rgba(60,48,20,0.18)";
  g.lineWidth = 5;
  roundRect(g, 6, 6, w - 12, h - 12, 44).stroke();
  const cx = 150;
  const cy = h / 2;
  const grad = g.createLinearGradient(cx, cy - 96, cx, cy + 96);
  grad.addColorStop(0, "#f8dc93");
  grad.addColorStop(1, "#d9a33c");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 96, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1c1408";
  g.font = `800 128px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), cx, cy + 6);
  g.textAlign = "left";
  g.fillStyle = "#1c2129";
  fitText(g, title, 800, 150, w - 330);
  g.fillText(title, 290, cy + 8);
}

function drawTab(c, title) {
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "#fbfaf5";
  roundRect(g, 4, 4, c.width - 8, c.height - 8, 20).fill();
  g.fillStyle = "#2a2f38";
  g.textAlign = "center";
  g.textBaseline = "middle";
  fitText(g, title.toUpperCase(), 750, 64, c.width - 40);
  g.fillText(title.toUpperCase(), c.width / 2, c.height / 2 + 3);
}

function drawSticker(c, text, color, ink) {
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = color;
  roundRect(g, 4, 4, c.width - 8, c.height - 8, 30).fill();
  g.fillStyle = ink;
  g.textAlign = "center";
  g.textBaseline = "middle";
  fitText(g, text, 800, 74, c.width - 40);
  g.fillText(text, c.width / 2, c.height / 2 + 4);
}

function bars(g, x, y, widths, gap, height, color) {
  g.fillStyle = color;
  widths.forEach((bw, i) => roundRect(g, x, y + i * gap, bw, height, height / 2).fill());
}

function drawPaper(c, kind, name, jobName) {
  const g = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  g.fillStyle = "#f8f6f0";
  g.fillRect(0, 0, w, h);
  const ink = "#252a33";
  g.textBaseline = "alphabetic";
  if (kind === "photos") {
    const ix = 26;
    const iy = 26;
    const iw = w - 52;
    const ih = h - 118;
    const sky = g.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, "#22304f");
    sky.addColorStop(0.6, "#d78f5d");
    sky.addColorStop(0.61, "#5a4532");
    sky.addColorStop(1, "#3a2c21");
    g.fillStyle = sky;
    g.fillRect(ix, iy, iw, ih);
    g.strokeStyle = "rgba(244,210,150,0.95)";
    g.lineWidth = 3;
    const bx = ix + iw * 0.25;
    const by = iy + ih * 0.61;
    const bw = iw * 0.46;
    const bh = ih * 0.4;
    for (let i = 0; i <= 14; i += 1) {
      const x = bx + (i * bw) / 14;
      g.beginPath();
      g.moveTo(x, by);
      g.lineTo(x, by - bh);
      g.stroke();
    }
    [0, 0.5, 1].forEach((f) => {
      g.beginPath();
      g.moveTo(bx, by - bh * f);
      g.lineTo(bx + bw, by - bh * f);
      g.stroke();
    });
    g.beginPath();
    g.moveTo(bx - 10, by - bh);
    g.lineTo(bx + bw / 2, by - bh - bh * 0.42);
    g.lineTo(bx + bw + 10, by - bh);
    g.stroke();
    g.strokeStyle = "rgba(232,182,76,0.95)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(ix + iw * 0.86, by);
    g.lineTo(ix + iw * 0.86, iy + ih * 0.1);
    g.lineTo(ix + iw * 0.4, iy + ih * 0.1);
    g.stroke();
    g.fillStyle = ink;
    g.font = `650 34px ${FONT}`;
    g.fillText(name, 30, h - 42);
    g.fillStyle = "#8a909b";
    g.font = `500 22px ${FONT}`;
    g.fillText(jobName, w - 30 - g.measureText(jobName).width, h - 44);
    return;
  }
  if (kind === "receipts") {
    g.fillStyle = "#3b4049";
    g.fillRect(26, 26, w - 52, h - 118);
    const rx = w / 2 - 125;
    const ry = 46;
    const rw = 250;
    const rh = h - 170;
    g.fillStyle = "#fdfcf8";
    g.beginPath();
    g.moveTo(rx, ry);
    g.lineTo(rx + rw, ry);
    g.lineTo(rx + rw, ry + rh);
    for (let x = rx + rw; x > rx; x -= 14) g.lineTo(x - 7, ry + rh + (((x - rx) / 14) % 2 ? 8 : -2));
    g.closePath();
    g.fill();
    g.fillStyle = ink;
    g.font = `800 24px ${FONT}`;
    g.textAlign = "center";
    g.fillText("RECEIPT", rx + rw / 2, ry + 42);
    g.textAlign = "left";
    bars(g, rx + 26, ry + 70, [170, 120, 150, 100, 160, 130], 30, 9, "#c9ccd2");
    bars(g, rx + rw - 76, ry + 70, [50, 44, 50, 40, 50, 46], 30, 9, "#c9ccd2");
    g.fillStyle = "#e3e5e9";
    g.fillRect(rx + 22, ry + rh - 70, rw - 44, 3);
    bars(g, rx + 26, ry + rh - 52, [90], 0, 12, "#9aa0aa");
    g.fillStyle = ink;
    g.font = `650 34px ${FONT}`;
    g.fillText(name, 30, h - 42);
    return;
  }
  const titles = { quote: "QUOTE", changeOrders: "CHANGE ORDER", invoices: "INVOICE" };
  g.fillStyle = "#e8b64c";
  g.fillRect(0, 0, w, 16);
  g.fillStyle = ink;
  g.font = `850 46px ${FONT}`;
  g.fillText(titles[kind] || "DOCUMENT", 44, 92);
  g.fillStyle = "#3d4450";
  g.font = `650 32px ${FONT}`;
  g.fillText(name, 44, 140);
  g.fillStyle = "#8a909b";
  g.font = `500 24px ${FONT}`;
  g.fillText(jobName, 44, 178);
  bars(g, 44, 214, [520, 470, 560, 300], 26, 10, "#cfd2d8");
  g.strokeStyle = "#dfe2e6";
  g.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    g.beginPath();
    g.moveTo(44, 340 + i * 38);
    g.lineTo(w - 44, 340 + i * 38);
    g.stroke();
  }
  bars(g, 44, 354, [360, 300, 400], 38, 10, "#d4d7dc");
  bars(g, w - 190, 354, [120, 100, 130], 38, 10, "#d4d7dc");
  g.fillStyle = "#f2e4c0";
  roundRect(g, w - 300, h - 96, 256, 56, 12).fill();
  bars(g, w - 280, h - 74, [150], 0, 12, "#c8a457");
}

function drawScreen(c, v) {
  const g = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#121b2e");
  bg.addColorStop(1, "#0a0f1a");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#19243b";
  g.fillRect(0, 0, w, 62);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(34 + i * 30, 31, 9, 0, Math.PI * 2);
    g.fill();
  });
  g.textBaseline = "middle";
  g.fillStyle = "#c9d3e6";
  g.font = `650 26px ${FONT}`;
  g.fillText("Bookkeeper view", 140, 32);
  g.fillStyle = "#f3f5fa";
  fitText(g, v.jobName || "SAMPLE Job", 800, 42, w - 88);
  g.fillText(v.jobName || "SAMPLE Job", 44, 112);
  g.fillStyle = "#8f9bb3";
  g.font = `500 24px ${FONT}`;
  g.fillText(v.companyName || "Company name not set", 44, 152);
  const rows = v.rows || [];
  rows.forEach((row, i) => {
    const y = 196 + i * 72;
    g.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
    roundRect(g, 30, y, w - 60, 62, 12).fill();
    g.fillStyle = "#e8b64c";
    roundRect(g, 52, y + 18, 46, 32, 5).fill();
    g.fillRect(52, y + 13, 20, 8);
    g.fillStyle = "#e9edf5";
    g.font = `650 28px ${FONT}`;
    g.fillText(row.label, 118, y + 32);
    const status = row.missing ? "Missing" : row.count === 0 ? "Empty" : `${row.count} ${row.count === 1 ? "file" : "files"}`;
    g.font = `700 24px ${FONT}`;
    const sw = g.measureText(status).width + 36;
    g.fillStyle = row.missing ? "rgba(255,90,78,0.2)" : row.count ? "rgba(125,255,196,0.14)" : "rgba(255,255,255,0.06)";
    roundRect(g, w - 52 - sw, y + 14, sw, 36, 18).fill();
    g.fillStyle = row.missing ? "#ff8a80" : row.count ? "#7dffc4" : "#8f9bb3";
    g.fillText(status, w - 52 - sw + 18, y + 33);
  });
  g.fillStyle = "#7f8aa3";
  g.font = `500 24px ${FONT}`;
  g.fillText("Same job. Same files.", 44, h - 36);
  if (v.deleted) {
    g.fillStyle = "rgba(10,12,20,0.82)";
    g.fillRect(0, 62, w, h - 62);
    g.textAlign = "center";
    g.fillStyle = "#ff8a80";
    g.font = `800 40px ${FONT}`;
    g.fillText("This job is in Recently Deleted", w / 2, h / 2 - 10);
    g.fillStyle = "#c9d3e6";
    g.font = `550 28px ${FONT}`;
    g.fillText("Bring it back from Backup", w / 2, h / 2 + 42);
    g.textAlign = "left";
  }
}

function drawKeyboard(c) {
  const g = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  g.fillStyle = "#1a1c21";
  g.fillRect(0, 0, w, h);
  const rows = 5;
  const kh = (h - 40) / rows;
  for (let r = 0; r < rows; r += 1) {
    const keys = r === 4 ? 0 : 14 - (r % 2);
    const kw = (w - 40) / 14;
    for (let k = 0; k < keys; k += 1) {
      g.fillStyle = "#2c2f36";
      roundRect(g, 20 + k * kw + (r % 2) * kw * 0.5 + 3, 20 + r * kh + 3, kw - 6, kh - 6, 8).fill();
    }
    if (r === 4) {
      g.fillStyle = "#2c2f36";
      roundRect(g, w * 0.3, 20 + r * kh + 3, w * 0.4, kh - 6, 8).fill();
      roundRect(g, 23, 20 + r * kh + 3, w * 0.25, kh - 6, 8).fill();
      roundRect(g, w * 0.72, 20 + r * kh + 3, w * 0.25, kh - 6, 8).fill();
    }
  }
}

function drawNumber(c, n) {
  const g = c.getContext("2d");
  const s = c.width;
  g.clearRect(0, 0, s, s);
  g.fillStyle = "rgba(8,10,16,0.85)";
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#e8b64c";
  g.lineWidth = 12;
  g.stroke();
  g.fillStyle = "#f6d68a";
  g.font = `800 ${s * 0.5}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), s / 2, s / 2 + s * 0.03);
}

function drawChevron(c) {
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(246,214,138,0.95)";
  g.lineWidth = 9;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(c.width * 0.38, 12);
  g.lineTo(c.width * 0.62, c.height / 2);
  g.lineTo(c.width * 0.38, c.height - 12);
  g.stroke();
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------
export function createJobsite(canvas, { steps, onSelect, onFrame, onUserCamera, insets }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(SKY_COLORS.fog, 0.0085);
  const tex = makeTextures(renderer.capabilities.getMaxAnisotropy());
  const mats = makeMaterials(tex);
  const sunDir = V(-0.638, 0.352, 0.685).normalize();
  buildSky(scene, sunDir);
  scene.environment = buildEnvironment(renderer, sunDir);
  buildStars(scene);
  buildMountains(scene);
  buildTrees(scene);
  buildGround(scene, tex);

  // ---------- light: low dusk sun, cool rim, sky fill ----------
  scene.add(new THREE.HemisphereLight(0xa9bbe8, 0x4a3826, 0.8));
  const sun = new THREE.DirectionalLight(0xffd3a1, 2.8);
  sun.position.copy(sunDir).multiplyScalar(48);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 2048 : 4096, coarse ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 5, far: 110 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x86a2ff, 0.6);
  rim.position.set(30, 18, -34);
  scene.add(rim);

  // ---------- the job: house, crane, props ----------
  const house = buildHouse(mats, tex);
  scene.add(house.group);
  const crane = buildCrane(mats, tex.glow);
  const craneAngle = -2.53;
  crane.group.position.set(Math.sin(craneAngle) * 10.5, 0, Math.cos(craneAngle) * 10.5);
  const craneAim = Math.atan2(crane.group.position.z, -crane.group.position.x);
  scene.add(crane.group);
  const props = buildProps(mats, tex);
  scene.add(props.group);
  const houseHit = new THREE.Mesh(new THREE.BoxGeometry(9, 8.2, 7.4), new THREE.MeshBasicMaterial({ visible: false }));
  houseHit.position.y = 4.1;
  houseHit.rotation.y = HOUSE_TURN;
  houseHit.userData.id = "job";
  scene.add(houseHit);
  const pickables = [houseHit];

  // ---------- shared bits ----------
  const glowMat = (color, opacity) =>
    new THREE.SpriteMaterial({
      map: tex.glow,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  const paperGeo = roundedPlane(1.72, 1.2, 0.025);
  const paperCache = new Map();
  function paperMaterial(kind, name, jobName) {
    const key = `${kind}|${name}|${jobName}`;
    if (!paperCache.has(key)) {
      const c = makeCanvas(768, 540);
      drawPaper(c, kind, name, jobName);
      paperCache.set(
        key,
        new THREE.MeshStandardMaterial({
          map: canvasTexture(c, { aniso: tex.aniso }),
          roughness: 0.82,
          side: THREE.DoubleSide,
        }),
      );
    }
    return paperCache.get(key);
  }
  const stickerMaterial = (c, basic = false) => {
    const opts = {
      map: canvasTexture(c, { aniso: tex.aniso }),
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    };
    return basic ? new THREE.MeshBasicMaterial({ ...opts, toneMapped: false }) : new THREE.MeshStandardMaterial({ ...opts, roughness: 0.5 });
  };

  // ---------- stations ----------
  const flow = steps.filter((step) => step.id !== "job");
  const stations = new Map();

  function makeFolder(step, slot) {
    const FW = 1.9;
    const FH = 1.36;
    const FLAP = 1.12;
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const manila = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.paper,
      roughness: 0.58,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xfff0c8),
      sheenRoughness: 0.5,
      clearcoat: 0.08,
    });
    const baseColor = new THREE.Color(0xffffff);
    const dimColor = new THREE.Color(0x6d665a);
    const backGeo = new THREE.ExtrudeGeometry(folderShape(FW, FH, TABS[slot], 0.62, 0.2, 0.07), EXTRUDE);
    backGeo.translate(-FW / 2, -FH / 2, -0.004);
    const back = new THREE.Mesh(backGeo, manila);
    back.castShadow = true;
    body.add(back);
    const papers = new THREE.Group();
    body.add(papers);
    const hinge = new THREE.Group();
    hinge.position.set(0, -FH / 2 + 0.006, 0.034);
    body.add(hinge);
    const flapGeo = new THREE.ExtrudeGeometry(roundedRectShape(FW, FLAP, 0.07), EXTRUDE);
    flapGeo.translate(-FW / 2, 0, -0.004);
    const flap = new THREE.Mesh(flapGeo, manila);
    flap.castShadow = true;
    hinge.add(flap);
    const labelCanvas = makeCanvas(1024, 320);
    drawFolderLabel(labelCanvas, step.n, step.title);
    const label = new THREE.Mesh(roundedPlane(1.5, 0.47, 0.06), stickerMaterial(labelCanvas));
    label.position.set(-0.12, FLAP - 0.34, 0.016);
    hinge.add(label);
    const missingCanvas = makeCanvas(512, 160);
    drawSticker(missingCanvas, "MISSING", "#e5483d", "#ffffff");
    const missing = new THREE.Mesh(roundedPlane(0.6, 0.19, 0.05), stickerMaterial(missingCanvas, true));
    missing.position.set(0.48, 0.26, 0.017);
    missing.rotation.z = -0.08;
    missing.visible = false;
    hinge.add(missing);
    const tabCanvas = makeCanvas(512, 128);
    drawTab(tabCanvas, step.title);
    const tab = new THREE.Mesh(roundedPlane(0.54, 0.135, 0.03), stickerMaterial(tabCanvas));
    tab.position.set(-FW / 2 + TABS[slot] + 0.31, FH / 2 + 0.1, 0.016);
    body.add(tab);
    const halo = new THREE.Sprite(glowMat(GOLD, 0.3));
    halo.scale.set(4.6, 3.8, 1);
    halo.position.z = -0.5;
    body.add(halo);
    const st = { open: 0, peek: 0, key: "", dim: 0 };
    return {
      root,
      body,
      halo,
      anchorY: 1.12,
      setData(d, v) {
        const names = d.files || [];
        const key = `${names.join("\u0001")}|${v.jobName}`;
        if (key !== st.key) {
          st.key = key;
          papers.clear();
          names.slice(0, 4).forEach((name, i) => {
            const paper = new THREE.Mesh(paperGeo, paperMaterial(step.id, name, v.jobName || ""));
            paper.userData.i = i;
            paper.castShadow = true;
            papers.add(paper);
          });
        }
        missing.visible = !!d.missing;
        st.missing = !!d.missing;
        st.dimGoal = d.dim ? 1 : 0;
      },
      peek(seconds = 1.6) {
        st.peek = Math.max(st.peek, seconds);
      },
      tick(dt, selected) {
        st.peek = Math.max(0, st.peek - dt);
        const goal = (selected && papers.children.length > 0) || st.peek > 0 ? 1 : 0;
        st.open += (goal - st.open) * (1 - Math.exp(-dt * 5));
        st.dim += ((st.dimGoal || 0) - st.dim) * (1 - Math.exp(-dt * 4));
        manila.color.copy(baseColor).lerp(dimColor, st.dim);
        hinge.rotation.x = 0.07 + easeOut(st.open) * 0.92;
        const n = papers.children.length;
        papers.children.forEach((paper, i) => {
          const o = easeInOut(st.open);
          const spread = i - (n - 1) / 2;
          paper.position.set(spread * 0.2 * o, -0.04 + i * 0.012 + o * (0.46 + i * 0.07), 0.012 + i * 0.003 + o * (0.08 + i * 0.035));
          paper.rotation.set(-0.12 * o, 0, spread * 0.1 * o + (i % 2 ? 0.012 : -0.01));
        });
        return st;
      },
    };
  }

  function miniFolder(material) {
    const g = new THREE.Group();
    const backGeo = new THREE.ExtrudeGeometry(folderShape(1.9, 1.36, 0.14, 0.62, 0.2, 0.07), EXTRUDE);
    backGeo.translate(-0.95, -0.68, 0);
    const flapGeo = new THREE.ExtrudeGeometry(roundedRectShape(1.9, 1.12, 0.07), EXTRUDE);
    flapGeo.translate(-0.95, -0.68, 0.04);
    g.add(new THREE.Mesh(backGeo, material), new THREE.Mesh(flapGeo, material));
    return g;
  }

  function makeVault() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a95a3, metalness: 0.72, roughness: 0.34 });
    const steelDoor = new THREE.MeshStandardMaterial({ color: 0x9aa5b2, metalness: 0.74, roughness: 0.28 });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.2, emissive: 0x2a1a00 });
    const shell = new THREE.Mesh(new RoundedBox(1.5, 1.62, 1.25, 4, 0.12), steel);
    shell.castShadow = true;
    body.add(shell);
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.32), new THREE.MeshStandardMaterial({ color: 0x06080c, roughness: 0.95 }));
    inside.position.z = 0.627;
    body.add(inside);
    const copyMat = new THREE.MeshStandardMaterial({ color: 0xf2c25e, metalness: 0.75, roughness: 0.3, emissive: 0x3a2400, emissiveIntensity: 0.4 });
    const copy = miniFolder(copyMat);
    copy.scale.setScalar(0.44);
    copy.position.set(0, -0.06, 0.64);
    body.add(copy);
    const inner = new THREE.Sprite(glowMat(0xffc970, 0));
    inner.scale.set(1.6, 1.6, 1);
    inner.position.set(0, 0, 0.75);
    body.add(inner);
    const hinge = new THREE.Group();
    hinge.position.set(-0.66, 0, 0.64);
    body.add(hinge);
    const door = new THREE.Mesh(new RoundedBox(1.32, 1.42, 0.1, 3, 0.05), steelDoor);
    door.position.set(0.66, 0, 0.05);
    door.castShadow = true;
    hinge.add(door);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 40), gold);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0.98, 0.22, 0.13);
    const dialRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 12, 48), steel);
    dialRing.position.set(0.98, 0.22, 0.12);
    const wheel = new THREE.Group();
    wheel.position.set(0.98, -0.3, 0.13);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 20), gold);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    for (let k = 0; k < 3; k += 1) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10), gold);
      spoke.rotation.z = (k * Math.PI) / 3;
      spoke.position.z = 0.02;
      wheel.add(spoke);
    }
    [0.45, -0.45].forEach((y) => {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 16), steel);
      pin.position.set(-0.01, y, 0.06);
      hinge.add(pin);
    });
    const plateCanvas = makeCanvas(512, 120);
    const pg = plateCanvas.getContext("2d");
    pg.fillStyle = "#1d222a";
    roundRect(pg, 4, 4, 504, 112, 18).fill();
    pg.fillStyle = "#f2cc76";
    pg.font = `800 50px ${FONT}`;
    pg.textAlign = "center";
    pg.textBaseline = "middle";
    pg.fillText("SECOND COPY", 256, 62);
    const plate = new THREE.Mesh(roundedPlane(0.66, 0.155, 0.03), stickerMaterial(plateCanvas));
    plate.position.set(0.62, 0.53, 0.106);
    hinge.add(dial, dialRing, wheel, plate);
    [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.45], [0.55, 0.45]].forEach(([x, z]) => {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 16), mats.dark);
      foot.position.set(x, -0.86, z);
      body.add(foot);
    });
    const halo = new THREE.Sprite(glowMat(0x6fb6ff, 0.3));
    halo.scale.set(4.2, 4.2, 1);
    halo.position.z = -0.7;
    body.add(halo);
    const st = { open: 0, peek: 0, holding: false };
    return {
      root,
      body,
      halo,
      anchorY: 1.12,
      setData(d, v) {
        st.holding = !!v.deleted;
      },
      peek(seconds = 2.4) {
        st.peek = Math.max(st.peek, seconds);
      },
      tick(dt, selected, t) {
        st.peek = Math.max(0, st.peek - dt);
        const goal = selected || st.peek > 0 || st.holding ? 1 : 0;
        st.open += (goal - st.open) * (1 - Math.exp(-dt * 3.2));
        hinge.rotation.y = -easeInOut(st.open) * 1.8;
        dial.rotation.y = t * 0.7;
        wheel.rotation.z = Math.sin(t * 0.8) * 0.4;
        const lit = st.holding ? 1 : st.open;
        copyMat.emissiveIntensity = 0.3 + lit * 1.6;
        inner.material.opacity = lit * (st.holding ? 0.85 : 0.5);
        return st;
      },
    };
  }

  function makeLaptop() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const alu = new THREE.MeshStandardMaterial({ color: 0xaab2bd, metalness: 0.9, roughness: 0.26 });
    const base = new THREE.Mesh(new RoundedBox(1.8, 0.06, 1.24, 3, 0.03), alu);
    base.position.y = -0.03;
    base.castShadow = true;
    body.add(base);
    const kbCanvas = makeCanvas(1024, 400);
    drawKeyboard(kbCanvas);
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.6), new THREE.MeshStandardMaterial({ map: canvasTexture(kbCanvas, { aniso: tex.aniso }), roughness: 0.75 }));
    keys.rotation.x = -Math.PI / 2;
    keys.position.set(0, 0.002, -0.14);
    body.add(keys);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.8, roughness: 0.35 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.002, 0.38);
    body.add(pad);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0, -0.6);
    hinge.rotation.x = -0.3;
    body.add(hinge);
    const lid = new THREE.Mesh(new RoundedBox(1.8, 1.18, 0.04, 3, 0.02), alu);
    lid.position.set(0, 0.59, -0.02);
    lid.castShadow = true;
    hinge.add(lid);
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(1.74, 1.12), new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.15, metalness: 0.2 }));
    bezel.position.set(0, 0.59, 0.001);
    hinge.add(bezel);
    const screenCanvas = makeCanvas(1024, 640);
    const screenTex = canvasTexture(screenCanvas, { aniso: tex.aniso });
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 1.025), screenMat);
    screen.position.set(0, 0.6, 0.002);
    hinge.add(screen);
    const shine = new THREE.Sprite(glowMat(0x9fd8ff, 0.18));
    shine.scale.set(2.6, 1.8, 1);
    shine.position.set(0, 0.62, 0.35);
    hinge.add(shine);
    const halo = new THREE.Sprite(glowMat(0x7dffc4, 0.28));
    halo.scale.set(4.2, 3.6, 1);
    halo.position.set(0, 0.4, -0.9);
    body.add(halo);
    const st = { key: "", flash: 0 };
    return {
      root,
      body,
      halo,
      anchorY: 1.32,
      setData(d, v) {
        const key = JSON.stringify([v.jobName, v.companyName, v.deleted, v.rows]);
        if (key === st.key) return;
        st.key = key;
        drawScreen(screenCanvas, v);
        screenTex.needsUpdate = true;
      },
      peek() {
        st.flash = 1;
      },
      tick(dt) {
        st.flash = Math.max(0, st.flash - dt * 0.8);
        shine.material.opacity = 0.16 + st.flash * 0.5;
        screenMat.color.setScalar(1 + st.flash * 0.25);
        return st;
      },
    };
  }

  let folderSlot = 0;
  flow.forEach((step, i) => {
    const angle = -ARC + (i * 2 * ARC) / (flow.length - 1);
    const base = V(Math.sin(angle) * RING, STATION_Y, Math.cos(angle) * RING);
    const kind = KIND[step.id] || "folder";
    const s = kind === "vault" ? makeVault() : kind === "laptop" ? makeLaptop() : makeFolder(step, folderSlot++);
    s.id = step.id;
    s.kind = kind;
    s.step = step;
    s.base = base;
    s.angle = angle;
    s.phase = i * 1.3;
    s.root.position.copy(base);
    s.root.scale.setScalar(BASE_SCALE);
    s.body.rotation.y = angle;
    scene.add(s.root);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.id = step.id;
    s.root.add(hit);
    pickables.push(hit);
    stations.set(step.id, s);
  });

  // ---------- streams: files flow into the job, copies flow out ----------
  stations.forEach((s) => {
    const outward = s.kind !== "folder";
    const toHouse = HEART.clone().sub(s.base).setY(0).normalize();
    const behind = s.base.clone().addScaledVector(toHouse, 1.5).setY(STATION_Y + 0.6);
    const from = outward ? HEART.clone() : behind;
    const to = outward ? behind : HEART.clone();
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 3.2;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const color = STREAM[s.kind];
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.022, 6, false),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    scene.add(tube);
    const pulses = [0, 0.5].map((offset) => {
      const dot = new THREE.Sprite(glowMat(color, 0.8));
      dot.scale.setScalar(0.55);
      scene.add(dot);
      return { dot, offset };
    });
    s.stream = { curve, tube, pulses, color };
  });

  // ---------- the numbered path on the ground ----------
  const signSpot = V(2.25, 0, 6.6);
  const markerSpots = [signSpot, ...flow.map((step) => stations.get(step.id).base.clone().setY(0))];
  const pathCurve = new THREE.CatmullRomCurve3(
    [
      markerSpots[0],
      V(-3.6, 0, 7.6),
      ...markerSpots.slice(1),
    ].map((p) => p.clone().setY(0.035)),
    false,
    "catmullrom",
    0.4,
  );
  const SAMPLES = 420;
  const ribbon = [];
  const ribbonUv = [];
  const ribbonIdx = [];
  let lengthSoFar = 0;
  let prev = pathCurve.getPoint(0);
  for (let i = 0; i <= SAMPLES; i += 1) {
    const u = i / SAMPLES;
    const p = pathCurve.getPoint(u);
    const tangent = pathCurve.getTangent(u);
    const side = V(tangent.z, 0, -tangent.x).normalize().multiplyScalar(0.13);
    lengthSoFar += p.distanceTo(prev);
    prev = p;
    ribbon.push(p.x + side.x, p.y, p.z + side.z, p.x - side.x, p.y, p.z - side.z);
    ribbonUv.push(lengthSoFar / 0.7, 1, lengthSoFar / 0.7, 0);
    if (i < SAMPLES) {
      const a = i * 2;
      ribbonIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(ribbon, 3));
  ribbonGeo.setAttribute("uv", new THREE.Float32BufferAttribute(ribbonUv, 2));
  ribbonGeo.setIndex(ribbonIdx);
  const chevronCanvas = makeCanvas(128, 64);
  drawChevron(chevronCanvas);
  const chevronTex = canvasTexture(chevronCanvas, { aniso: tex.aniso });
  chevronTex.wrapT = THREE.ClampToEdgeWrapping;
  const pathMat = new THREE.MeshBasicMaterial({
    map: chevronTex,
    color: GOLD,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const path = new THREE.Mesh(ribbonGeo, pathMat);
  path.renderOrder = 2;
  scene.add(path);
  const markers = steps.map((step, i) => {
    const c = makeCanvas(256, 256);
    drawNumber(c, step.n);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 48),
      new THREE.MeshBasicMaterial({ map: canvasTexture(c, { aniso: tex.aniso }), transparent: true, depthWrite: false, toneMapped: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.copy(markerSpots[i]).setY(0.05);
    disc.renderOrder = 3;
    scene.add(disc);
    let beam = null;
    if (i > 0) {
      beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, STATION_Y - 0.9, 6),
        new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
      );
      beam.position.copy(markerSpots[i]).setY((STATION_Y - 0.9) / 2);
      scene.add(beam);
    }
    return { id: step.id, disc, beam };
  });

  // ---------- camera and controls ----------
  const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 1400);
  const orbit = { target: V(0, 3.1, 0), r: 40, theta: -0.9, phi: 0.5 };
  const goal = { target: V(0, 3.1, 0), r: 32, theta: 0, phi: 1.1 };
  const size = { w: 1, h: 1 };
  let rate = 1.1;
  let overviewMode = true;
  let idle = 0;
  let sway = 0;
  const LIMITS = { rMin: 3.2, rMax: 85, phiMin: 0.28, phiMax: 1.45 };

  function visible() {
    const ins = insets ? insets() : { left: 0, right: 0, top: 0, bottom: 0 };
    return {
      ins,
      w: Math.max(160, size.w - ins.left - ins.right),
      h: Math.max(160, size.h - ins.top - ins.bottom),
    };
  }

  function fitDistance(radius) {
    const vis = visible();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanY = tanV * (vis.h / size.h);
    const tanX = tanV * (size.w / size.h) * (vis.w / size.w);
    return (radius / Math.sin(Math.atan(Math.min(tanX, tanY)))) * 1.03;
  }

  const small = () => visible().w < 560;

  function overview(fast = false) {
    overviewMode = true;
    goal.target.set(0, small() ? 2.4 : 3.1, 0);
    goal.r = fitDistance(small() ? 12.6 : 13.6);
    goal.theta = orbit.theta + Math.atan2(Math.sin(0 - orbit.theta), Math.cos(0 - orbit.theta));
    goal.phi = small() ? 0.86 : 0.98;
    rate = fast ? 6 : 2.2;
  }

  function focus(id) {
    overviewMode = false;
    rate = 2.4;
    if (id === "job") {
      goal.target.set(0, 3.7, 0);
      goal.r = fitDistance(small() ? 5.6 : 6.6);
      const want = -0.42;
      goal.theta = orbit.theta + Math.atan2(Math.sin(want - orbit.theta), Math.cos(want - orbit.theta));
      goal.phi = 1.13;
      return;
    }
    const s = stations.get(id);
    if (!s) return;
    goal.target.copy(s.base).lerp(HEART, 0.1);
    goal.target.y = s.base.y + (s.kind === "laptop" ? 0.55 : 0.3);
    goal.r = fitDistance(small() ? 3.4 : 4.1);
    goal.theta = orbit.theta + Math.atan2(Math.sin(s.angle - orbit.theta), Math.cos(s.angle - orbit.theta));
    goal.phi = s.kind === "laptop" ? 1.08 : 1.2;
  }

  function zoom(factor) {
    goal.r = THREE.MathUtils.clamp(goal.r * factor, LIMITS.rMin, LIMITS.rMax);
    rate = Math.max(rate, 6);
    touched();
  }

  function touched() {
    idle = 0;
    if (onUserCamera) onUserCamera();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    size.w = Math.max(1, rect.width);
    size.h = Math.max(1, rect.height);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.fov = size.w < 700 ? 46 : 40;
    const ins = visible().ins;
    const dx = (ins.right - ins.left) / 2;
    const dy = (ins.bottom - ins.top) / 2;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) camera.setViewOffset(size.w, size.h, dx, dy, size.w, size.h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // pointer input: one finger or mouse turns, two fingers or the wheel zoom, right-drag pans
  const pointers = new Map();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag = null;
  let pinch = null;

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.id : null;
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now(), pan: e.button === 2 || e.shiftKey, moved: 0 };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      drag = null;
    }
    touched();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === "mouse") canvas.style.cursor = pick(e.clientX, e.clientY) ? "pointer" : "grab";
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 10 && pinch.d > 10) {
        goal.r = THREE.MathUtils.clamp(goal.r * (pinch.d / d), LIMITS.rMin, LIMITS.rMax);
        orbit.r = goal.r;
      }
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      panBy(mx - pinch.mx, my - pinch.my);
      pinch = { d, mx, my };
      overviewMode = false;
      touched();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
    if (drag.moved < 4) return;
    canvas.style.cursor = "grabbing";
    if (drag.pan) panBy(dx, dy);
    else {
      goal.theta -= dx * 0.0062;
      goal.phi = THREE.MathUtils.clamp(goal.phi - dy * 0.005, LIMITS.phiMin, LIMITS.phiMax);
      orbit.theta = goal.theta;
      orbit.phi = goal.phi;
    }
    overviewMode = false;
    rate = 10;
    touched();
  });
  const release = (e) => {
    const wasTap = drag && drag.moved < 6 && performance.now() - drag.at < 600 && pointers.size === 1;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (wasTap) {
      const id = pick(e.clientX, e.clientY);
      if (id && onSelect) onSelect(id);
    }
    if (pointers.size === 0) {
      drag = null;
      canvas.style.cursor = "grab";
    }
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const k = e.ctrlKey ? 0.012 : 0.0016;
      const factor = Math.exp(THREE.MathUtils.clamp(e.deltaY, -120, 120) * k);
      goal.r = THREE.MathUtils.clamp(goal.r * factor, LIMITS.rMin, LIMITS.rMax);
      rate = Math.max(rate, 7);
      overviewMode = false;
      touched();
    },
    { passive: false },
  );

  const _right = V(0, 0, 0);
  const _fwd = V(0, 0, 0);
  function panBy(dx, dy) {
    const scale = (orbit.r * 0.0016 * 900) / Math.max(400, size.h);
    _right.set(Math.cos(orbit.theta), 0, -Math.sin(orbit.theta));
    _fwd.set(-Math.sin(orbit.theta), 0, -Math.cos(orbit.theta));
    goal.target.addScaledVector(_right, -dx * scale).addScaledVector(_fwd, dy * scale);
    const flat = Math.hypot(goal.target.x, goal.target.z);
    if (flat > 16) goal.target.multiplyScalar(16 / flat);
    orbit.target.copy(goal.target);
  }

  // ---------- effects (the walkthrough moves) ----------
  const effects = [];
  const packetGeo = roundedPlane(0.62, 0.44, 0.02);

  function fly(object, from, to, lift, seconds, onDone) {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += lift;
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
    let t = 0;
    scene.add(object);
    effects.push((dt) => {
      t += dt / seconds;
      const k = easeInOut(clamp01(t));
      object.position.copy(curve.getPoint(k));
      if (t >= 1) {
        scene.remove(object);
        if (onDone) onDone();
        return false;
      }
      return true;
    });
  }

  function packetInto(id) {
    const s = stations.get(id);
    if (!s) return;
    const sheet = new THREE.Mesh(packetGeo, paperMaterial(id, "New", ""));
    sheet.castShadow = true;
    const glow = new THREE.Sprite(glowMat(0xffe2a0, 0.7));
    glow.scale.setScalar(1.4);
    sheet.add(glow);
    const away = V(camera.position.x - s.base.x, 0, camera.position.z - s.base.z).normalize();
    const from = s.base.clone().addScaledVector(away, 1.6).add(V(0, 2.6, 0));
    let spin = 0;
    effects.push((dt) => {
      spin += dt;
      sheet.rotation.set(-0.6 + spin * 0.4, spin * 2, 0);
      return sheet.parent !== null || spin < 0.05;
    });
    fly(sheet, from, s.base.clone().add(V(0, 0.15, 0)), 0.8, 1.15, () => {
      s.peek(1.4);
      flash(s, 1);
    });
  }

  function flash(s, amount) {
    s.flash = Math.max(s.flash || 0, amount);
  }

  function copyBetween(fromHouse) {
    const vault = stations.get("backup");
    if (!vault) return;
    const copy = miniFolder(new THREE.MeshStandardMaterial({ color: 0xf2c25e, metalness: 0.75, roughness: 0.3, emissive: 0x5a3a00, emissiveIntensity: 1 }));
    copy.scale.setScalar(0.5);
    const glow = new THREE.Sprite(glowMat(0xffd27a, 0.9));
    glow.scale.setScalar(2.2);
    copy.add(glow);
    const a = HEART.clone();
    const b = vault.base.clone();
    vault.peek(3.2);
    fly(copy, fromHouse ? a : b, fromHouse ? b : a, 4.2, 1.8, () => flash(vault, 1));
  }

  function wave() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.12, 120),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    scene.add(ring);
    let t = 0;
    effects.push((dt) => {
      t += dt / 2;
      const s = 4 + easeOut(clamp01(t)) * 8;
      ring.scale.setScalar(s);
      ring.material.opacity = 0.9 * (1 - clamp01(t));
      if (t >= 1) {
        scene.remove(ring);
        return false;
      }
      return true;
    });
  }

  function beamTo(id) {
    const s = stations.get(id);
    if (!s) return;
    const spark = new THREE.Sprite(glowMat(s.stream.color, 1));
    spark.scale.setScalar(1.3);
    let t = 0;
    scene.add(spark);
    effects.push((dt) => {
      t += dt / 1.3;
      spark.position.copy(s.stream.curve.getPoint(clamp01(easeInOut(t))));
      if (t >= 1) {
        scene.remove(spark);
        s.peek(2);
        flash(s, 1);
        return false;
      }
      return true;
    });
  }

  function pulse(id) {
    if (id === "job") {
      wave();
      return;
    }
    const s = stations.get(id);
    if (!s) return;
    if (s.kind === "folder") packetInto(id);
    else if (s.kind === "vault") copyBetween(true);
    else beamTo(id);
  }

  // ---------- data from the app ----------
  let view = null;
  let build = 0;
  let buildGoal = 1;
  let buildRate = 1 / 6;

  function setView(next) {
    const before = view;
    view = next;
    if (!before) {
      if (next.deleted) {
        house.assembly.setMode("scatter");
        build = 0;
        buildGoal = 0;
      } else {
        house.assembly.setMode("drop");
        build = reduce ? 1 : 0;
        buildGoal = 1;
        buildRate = 1 / 6;
      }
      house.assembly.apply(build);
    } else if (before.deleted !== next.deleted) {
      if (next.deleted) {
        house.assembly.setMode("scatter");
        buildGoal = 0;
        buildRate = 1 / 1.8;
        copyBetween(true);
      } else {
        house.assembly.setMode("scatter");
        buildGoal = 1;
        buildRate = 1 / 3.2;
        copyBetween(false);
      }
    }
    stations.forEach((s) => s.setData(next.stations[s.id] || {}, next));
    if (before && !next.deleted && !before.deleted) {
      stations.forEach((s) => {
        if (s.kind !== "folder") return;
        const was = (before.stations[s.id] || {}).count || 0;
        const now = (next.stations[s.id] || {}).count || 0;
        if (now > was) packetInto(s.id);
      });
      if ((next.stations.backup || {}).count > (before.stations.backup || {}).count) copyBetween(true);
    }
    if (!before || before.jobName !== next.jobName || before.companyName !== next.companyName) {
      props.setSign(next.jobName, next.companyName);
    }
  }

  function replay() {
    house.assembly.setMode("drop");
    build = 0;
    buildGoal = 1;
    buildRate = 1 / 6;
    house.assembly.apply(0);
    orbit.r = goal.r * 1.6;
    orbit.phi = 0.55;
    orbit.theta = goal.theta - 0.8;
    overview();
    rate = 1.1;
  }

  // ---------- frame ----------
  const clock = new THREE.Clock();
  let running = true;
  let elapsed = 0;
  const tmp = V(0, 0, 0);
  const labelList = [];
  const motion = reduce ? 0 : 1;

  function update(dt) {
    elapsed += dt;
    const t = elapsed;
    idle += dt;

    if (Math.abs(buildGoal - build) > 0.0005) {
      build += Math.sign(buildGoal - build) * Math.min(Math.abs(buildGoal - build), dt * buildRate);
      house.assembly.apply(build);
    }
    house.lampLight.intensity = 22 * clamp01((build - 0.86) / 0.14);

    const k = 1 - Math.exp(-dt * rate);
    orbit.r += (goal.r - orbit.r) * k;
    orbit.theta += (goal.theta - orbit.theta) * k;
    orbit.phi += (goal.phi - orbit.phi) * k;
    orbit.target.lerp(goal.target, k);
    const swayGoal = overviewMode && idle > 5 && motion ? 1 : 0;
    sway += (swayGoal - sway) * (1 - Math.exp(-dt * 0.6));
    const theta = orbit.theta + Math.sin(t * 0.09) * 0.2 * sway;
    const sp = Math.sin(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.r * sp * Math.sin(theta),
      orbit.target.y + orbit.r * Math.cos(orbit.phi),
      orbit.target.z + orbit.r * sp * Math.cos(theta),
    );
    if (camera.position.y < 0.5) camera.position.y = 0.5;
    camera.lookAt(orbit.target);

    const sel = view ? view.selectedId : "job";
    const deleted = view ? view.deleted : false;
    stations.forEach((s) => {
      const data = (view && view.stations[s.id]) || {};
      const active = s.id === sel;
      s.root.position.y = s.base.y + Math.sin(t * 1.1 + s.phase) * 0.1 * motion;
      const face = Math.atan2(camera.position.x - s.root.position.x, camera.position.z - s.root.position.z);
      s.body.rotation.y = lerpAngle(s.body.rotation.y, face, 1 - Math.exp(-dt * 6));
      s.body.rotation.z = Math.sin(t * 0.7 + s.phase) * 0.025 * motion;
      const scaleGoal = active ? BASE_SCALE * 1.15 : BASE_SCALE;
      s.root.scale.setScalar(s.root.scale.x + (scaleGoal - s.root.scale.x) * (1 - Math.exp(-dt * 6)));
      const inner = s.tick(dt, active, t);
      s.openAmount = s.kind === "folder" && inner ? inner.open : 0;
      s.flash = Math.max(0, (s.flash || 0) - dt * 1.4);
      const alert = data.alert || data.missing;
      const base = s.kind === "folder" ? GOLD : s.kind === "vault" ? 0x6fb6ff : 0x7dffc4;
      s.halo.material.color.setHex(alert ? ALERT : base);
      const throb = alert ? 0.65 + Math.sin(t * 5) * 0.35 : 1;
      s.halo.material.opacity = (data.dim ? 0.08 : active ? 0.8 : 0.32) * throb + s.flash * 0.7;
      const stream = s.stream;
      const live = !deleted;
      stream.tube.material.opacity = live ? (active ? 0.75 : 0.16) + s.flash * 0.5 : 0.03;
      stream.pulses.forEach((p) => {
        const u = (t * (active ? 0.42 : 0.24) + p.offset) % 1;
        p.dot.position.copy(stream.curve.getPoint(u));
        p.dot.material.opacity = live ? Math.sin(u * Math.PI) * (active ? 1 : 0.55) : 0;
      });
    });
    markers.forEach((m) => {
      const on = m.id === sel;
      m.disc.scale.setScalar(on ? 1.25 : 1);
      if (m.beam) m.beam.material.opacity = on ? 0.7 : 0.22;
    });
    chevronTex.offset.x -= dt * 0.9 * motion;
    pathMat.opacity = deleted ? 0.25 : 0.85;
    crane.update(t, motion, craneAim);

    for (let i = effects.length - 1; i >= 0; i -= 1) {
      if (!effects[i](dt)) effects.splice(i, 1);
    }

    renderer.render(scene, camera);

    if (onFrame) {
      labelList.length = 0;
      labelList.push(project("job", tmp.set(0, HOUSE_TOP + 1.0, 0)));
      stations.forEach((s) => {
        tmp.copy(s.root.position);
        tmp.y += (s.anchorY + easeOut(s.openAmount || 0) * 0.62) * s.root.scale.x;
        labelList.push(project(s.id, tmp, true));
      });
      onFrame(labelList, dt);
    }
  }

  const occRay = new THREE.Raycaster();
  const occDir = V(0, 0, 0);
  function project(id, point, checkHouse = false) {
    const d = point.distanceTo(camera.position);
    let behind = false;
    if (checkHouse) {
      occDir.copy(point).sub(camera.position).divideScalar(d);
      occRay.set(camera.position, occDir);
      occRay.far = Math.max(0.1, d - 0.4);
      behind = occRay.intersectObject(houseHit, false).length > 0;
    }
    const p = point.clone().project(camera);
    const visibleNow = p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
    return { id, x: ((p.x + 1) / 2) * size.w, y: ((1 - p.y) / 2) * size.h, visible: visibleNow, depth: d, behind };
  }

  function loop() {
    if (!running) return;
    update(Math.min(clock.getDelta(), 0.05));
    requestAnimationFrame(loop);
  }

  resize();
  overview(true);
  orbit.r = goal.r * (reduce ? 1 : 1.7);
  orbit.phi = reduce ? goal.phi : 0.5;
  orbit.theta = reduce ? 0 : -0.95;
  rate = reduce ? 6 : 1.05;
  requestAnimationFrame(loop);

  return {
    setView,
    focus,
    overview,
    zoom,
    pulse,
    replay,
    resize() {
      resize();
      if (overviewMode) overview(true);
    },
    /** Step the scene by hand (used when the tab is in the background). */
    advance(seconds = 1, fps = 30) {
      const n = Math.max(1, Math.round(seconds * fps));
      for (let i = 0; i < n; i += 1) update(1 / fps);
      return { build, r: orbit.r, theta: orbit.theta, phi: orbit.phi, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    destroy() {
      running = false;
      renderer.dispose();
    },
  };
}
