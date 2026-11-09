/**
 * 3D jobsite scene. Same contract as the old galaxy.js:
 *   createGalaxy(canvas, { onSelect, bottomReserve }) -> { resize, setView, destroy }
 * The job is a house under construction in the middle. The five folders,
 * the backup vault and the bookkeeper ledger orbit it. Data streams run
 * from every folder into the job. Deleting shatters the house; restoring
 * flies every piece back to where it was.
 */
import * as THREE from "./vendor/three.module.js";

const GOLD = 0xe8b64c;
const GOLD_SOFT = 0xf6d68a;
const STEEL = 0x8fa3b8;
const ALERT = 0xff5a4e;
const SKY = 0x05070d;

const ORBIT = [
  { id: "photos", angle: 0 },
  { id: "quote", angle: 1 },
  { id: "changeOrders", angle: 2 },
  { id: "invoices", angle: 3 },
  { id: "receipts", angle: 4 },
];

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createGalaxy(canvas, { onSelect, bottomReserve }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.FogExp2(SKY, 0.028);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const camPos = new THREE.Vector3(0, 7.5, 17);
  const camLook = new THREE.Vector3(0, 1.4, 0);
  const camPosGoal = camPos.clone();
  const camLookGoal = camLook.clone();
  camera.position.copy(camPos);

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight(0x9ab8ff, 0x1a1208, 0.55));
  const sun = new THREE.DirectionalLight(0xffe2a8, 2.2);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  scene.add(sun);
  const rim = new THREE.PointLight(0x4f8cff, 30, 30);
  rim.position.set(-8, 5, -6);
  scene.add(rim);
  const core = new THREE.PointLight(GOLD, 18, 14);
  core.position.set(0, 2.5, 0);
  scene.add(core);

  // ---------- ground: blueprint grid + glowing pad ----------
  const grid = new THREE.GridHelper(80, 80, 0x2a4a7a, 0x12203a);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshStandardMaterial({ color: 0x070b14, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  const ringMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85 });
  const pad = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.22, 96), ringMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  scene.add(pad);
  const orbitRing = new THREE.Mesh(
    new THREE.RingGeometry(6.48, 6.52, 160),
    new THREE.MeshBasicMaterial({ color: GOLD_SOFT, transparent: true, opacity: 0.25 }),
  );
  orbitRing.rotation.x = -Math.PI / 2;
  orbitRing.position.y = 0.03;
  scene.add(orbitRing);

  // ---------- the job: a framed house under construction ----------
  const house = new THREE.Group();
  scene.add(house);
  const pieces = [];
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd9a35a, roughness: 0.7 });
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.9 });
  const steelMat = new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.8, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7fc4ff, emissive: 0x1d5fa8, emissiveIntensity: 0.6, transparent: true, opacity: 0.45,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.6, roughness: 0.3, emissive: 0x3a2400 });

  function piece(geo, mat, x, y, z, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(0, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    house.add(m);
    pieces.push({ mesh: m, home: m.position.clone(), homeRot: m.rotation.clone(), fly: new THREE.Vector3(), spin: new THREE.Vector3() });
    return m;
  }

  piece(new THREE.BoxGeometry(5, 0.3, 3.6), slabMat, 0, 0.15, 0);
  const stud = new THREE.BoxGeometry(0.12, 2.2, 0.12);
  for (let i = 0; i <= 8; i += 1) {
    const x = -2.3 + i * 0.575;
    piece(stud, woodMat, x, 1.4, 1.65);
    piece(stud, woodMat, x, 1.4, -1.65);
  }
  for (let i = 1; i < 6; i += 1) {
    const z = -1.65 + i * 0.55;
    piece(stud, woodMat, 2.3, 1.4, z);
    piece(stud, woodMat, -2.3, 1.4, z);
  }
  const plate = new THREE.BoxGeometry(4.8, 0.14, 0.16);
  piece(plate, woodMat, 0, 2.55, 1.65);
  piece(plate, woodMat, 0, 2.55, -1.65);
  const sidePlate = new THREE.BoxGeometry(0.16, 0.14, 3.4);
  piece(sidePlate, woodMat, 2.3, 2.55, 0);
  piece(sidePlate, woodMat, -2.3, 2.55, 0);
  // trusses
  const rafter = new THREE.BoxGeometry(0.1, 2.15, 0.1);
  for (let i = 0; i <= 6; i += 1) {
    const x = -2.3 + i * (4.6 / 6);
    piece(rafter, woodMat, x, 3.3, 0.85, 0, 0).rotation.x = -0.95;
    piece(rafter, woodMat, x, 3.3, -0.85, 0, 0).rotation.x = 0.95;
  }
  piece(new THREE.BoxGeometry(4.9, 0.12, 0.12), steelMat, 0, 4.15, 0);
  // half the roof is sheathed (gold), the rest still open framing
  const sheet = piece(new THREE.BoxGeometry(2.5, 0.06, 2.2), roofMat, -1.2, 3.35, 0.88);
  sheet.rotation.x = -0.62;
  // windows
  piece(new THREE.BoxGeometry(1.0, 0.8, 0.04), glassMat, -1.1, 1.6, 1.7);
  piece(new THREE.BoxGeometry(1.0, 0.8, 0.04), glassMat, 1.1, 1.6, 1.7);
  piece(new THREE.BoxGeometry(0.04, 0.8, 1.0), glassMat, 2.34, 1.6, 0);
  pieces.forEach((p, i) => {
    const r = rng(9000 + i);
    p.fly.set((r() - 0.5) * 16, 3 + r() * 9, (r() - 0.5) * 16);
    p.spin.set((r() - 0.5) * 6, (r() - 0.5) * 6, (r() - 0.5) * 6);
    p.delay = i / pieces.length;
  });

  // tower crane beside the house
  const crane = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.25, 7, 0.25), steelMat);
  mast.position.y = 3.5;
  crane.add(mast);
  const jib = new THREE.Group();
  jib.position.y = 7;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.5, roughness: 0.4 }));
  arm.position.x = 1.6;
  jib.add(arm);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3), steelMat);
  cable.position.set(3.8, -1.5, 0);
  jib.add(cable);
  const load = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.3), woodMat);
  load.position.set(3.8, -3.1, 0);
  jib.add(load);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09), new THREE.MeshBasicMaterial({ color: ALERT }));
  beacon.position.set(-1.3, 0.2, 0);
  jib.add(beacon);
  crane.add(jib);
  crane.position.set(-4.2, 0, -3);
  crane.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(crane);

  // ---------- orbiting nodes ----------
  const nodes = new Map();
  const pickables = [];

  function glow(color, size) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.scale.setScalar(size);
    return s;
  }

  function folderMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color: GOLD, metalness: 0.85, roughness: 0.22, clearcoat: 1, emissive: 0x2a1800,
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 0.08), mat);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), mat);
    tab.position.set(-0.38, 0.56, 0);
    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.85, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 }),
    );
    paper.position.set(0, 0.08, 0.07);
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.78, 0.06),
      new THREE.MeshPhysicalMaterial({ color: GOLD_SOFT, metalness: 0.6, roughness: 0.15, transparent: true, opacity: 0.88, clearcoat: 1 }),
    );
    front.position.set(0, -0.11, 0.12);
    front.rotation.x = -0.12;
    g.add(back, tab, paper, front);
    return g;
  }

  function vaultMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.32, 48),
      new THREE.MeshStandardMaterial({ color: 0x9fb4c9, metalness: 0.95, roughness: 0.2 }),
    );
    body.rotation.x = Math.PI / 2;
    const dial = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.07, 16, 48),
      new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.9, roughness: 0.2, emissive: 0x3a2400 }),
    );
    dial.position.z = 0.2;
    g.add(body, dial);
    for (let i = 0; i < 4; i += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.06), dial.material);
      spoke.rotation.z = (i * Math.PI) / 4;
      spoke.position.z = 0.22;
      g.add(spoke);
    }
    g.userData.dial = dial;
    return g;
  }

  function ledgerMesh() {
    const g = new THREE.Group();
    const cover = new THREE.MeshStandardMaterial({ color: 0x1f3a5f, roughness: 0.5, metalness: 0.2 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.95), cover);
    const right = left.clone();
    left.position.x = -0.36;
    right.position.x = 0.36;
    left.rotation.z = 0.18;
    right.rotation.z = -0.18;
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.1, 0.88),
      new THREE.MeshStandardMaterial({ color: 0xf4f1ea }),
    );
    pages.position.y = 0.06;
    g.add(left, right, pages);
    g.rotation.x = 0.9;
    return g;
  }

  function addNode(id, mesh, pos, color) {
    const holder = new THREE.Group();
    holder.position.copy(pos);
    holder.add(mesh);
    const halo = glow(color, 2.6);
    holder.add(halo);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.id = id;
    holder.add(hit);
    pickables.push(hit);
    scene.add(holder);
    // beam from node to job
    const pts = [];
    const mid = pos.clone().multiplyScalar(0.5).setY(pos.y + 2.2);
    const curve = new THREE.QuadraticBezierCurve3(pos.clone(), mid, new THREE.Vector3(0, 2.2, 0));
    for (let i = 0; i <= 40; i += 1) pts.push(curve.getPoint(i / 40));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }),
    );
    scene.add(line);
    const pulses = [0, 0.33, 0.66].map((offset) => {
      const dot = glow(color, 0.45);
      scene.add(dot);
      return { dot, offset };
    });
    nodes.set(id, { id, holder, mesh, halo, line, curve, pulses, color, base: pos.clone(), phase: Math.random() * 6 });
  }

  ORBIT.forEach((o) => {
    const a = -Math.PI / 2 + (o.angle * Math.PI * 2) / 5;
    addNode(o.id, folderMesh(), new THREE.Vector3(Math.cos(a) * 6.5, 2.2, Math.sin(a) * 6.5), GOLD);
  });
  addNode("backup", vaultMesh(), new THREE.Vector3(9.2, 3.6, -4.5), 0x6fb6ff);
  addNode("bookkeeper", ledgerMesh(), new THREE.Vector3(-9.2, 3.2, 4), 0x7dffc4);

  // job pick target
  const jobHit = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.6, 4.2), new THREE.MeshBasicMaterial({ visible: false }));
  jobHit.position.y = 2.2;
  jobHit.userData.id = "job";
  scene.add(jobHit);
  pickables.push(jobHit);

  // ---------- star dust ----------
  const r = rng(20261109);
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i += 1) {
    const rad = 20 + r() * 60;
    const th = r() * Math.PI * 2;
    const ph = Math.acos(r() * 0.9);
    starPos.set([rad * Math.sin(ph) * Math.cos(th), rad * Math.cos(ph) - 2, rad * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd9ff, size: 0.12, transparent: true, opacity: 0.8 }));
  scene.add(stars);

  // ---------- state ----------
  let view = { nodes: [], selectedId: "job" };
  let build = reduce ? 1 : 0; // 0 = scattered, 1 = built
  let buildGoal = 1;
  let introT = reduce ? 1 : 0;
  let yaw = 0;
  let yawVel = 0;
  let dragging = false;
  let lastX = 0;
  let downX = 0;
  let downY = 0;
  let running = true;
  const clock = new THREE.Clock();

  function focus(id) {
    if (id === "job") {
      camPosGoal.set(0, 7.5, 17);
      camLookGoal.set(0, 1.6, 0);
      return;
    }
    const n = nodes.get(id);
    if (!n) return;
    const p = n.base.clone();
    const dir = p.clone().setY(0).normalize();
    camPosGoal.copy(p).add(dir.multiplyScalar(5.5)).add(new THREE.Vector3(0, 2.4, 0));
    camLookGoal.copy(p).lerp(new THREE.Vector3(0, 1.6, 0), 0.25);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const reserve = Math.min(bottomReserve(), h * 0.6);
    const side = w >= 980 ? 200 : 0; // desktop dock sits on the right
    if (reserve > 0 || side > 0) camera.setViewOffset(w, h, side, reserve / 2, w, h);
    else camera.clearViewOffset();
    camera.fov = w < 600 ? 58 : 42;
    camera.updateProjectionMatrix();
  }

  // ---------- input ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = downX = e.clientX;
    downY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (dragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      yawVel = dx * 0.004;
      yaw += yawVel;
    } else {
      ndc.set((e.offsetX / canvas.clientWidth) * 2 - 1, -(e.offsetY / canvas.clientHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      canvas.style.cursor = ray.intersectObjects(pickables).length ? "pointer" : "grab";
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    ndc.set((e.offsetX / canvas.clientWidth) * 2 - 1, -(e.offsetY / canvas.clientHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables)[0];
    if (hit) onSelect(hit.object.userData.id);
  });

  // ---------- frame ----------
  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const motion = reduce ? 0 : 1;

    introT = Math.min(1, introT + dt / 3.2);
    build += (buildGoal - build) * Math.min(1, dt * (buildGoal > build ? 1.4 : 2.2));
    const b = Math.min(build, ease(introT));

    pieces.forEach((p) => {
      const local = THREE.MathUtils.clamp((b - p.delay * 0.55) / 0.45, 0, 1);
      const k = ease(local);
      p.mesh.position.lerpVectors(p.home.clone().add(p.fly), p.home, k);
      p.mesh.rotation.set(
        p.homeRot.x + p.spin.x * (1 - k),
        p.homeRot.y + p.spin.y * (1 - k),
        p.homeRot.z + p.spin.z * (1 - k),
      );
      p.mesh.visible = k > 0.02;
    });

    if (!dragging) {
      yawVel *= 0.94;
      if (view.selectedId === "job") {
        yaw += yawVel + dt * 0.05 * motion;
      } else {
        const home = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;
        yaw += (home - yaw) * Math.min(1, dt * 2.5);
      }
    }
    scene.rotation.y = yaw;
    jib.rotation.y = Math.sin(t * 0.25) * 0.9 * motion + 0.4;
    beacon.material.color.setHex(Math.sin(t * 4) > 0 ? ALERT : 0x330000);
    pad.material.opacity = 0.55 + Math.sin(t * 2) * 0.25;
    core.intensity = 12 + Math.sin(t * 1.7) * 5;
    stars.rotation.y = t * 0.004;

    const sel = view.selectedId;
    const meta = new Map(view.nodes.map((n) => [n.id, n]));
    nodes.forEach((n) => {
      const m = meta.get(n.id) || {};
      const active = n.id === sel;
      const bob = Math.sin(t * 1.3 + n.phase) * 0.18 * motion;
      n.holder.position.set(n.base.x, n.base.y + bob, n.base.z);
      n.mesh.rotation.y = -yaw + Math.sin(t * 0.6 + n.phase) * 0.3 + (active ? t * 0.8 * motion : 0);
      const target = active ? 1.45 : 1;
      const s = n.mesh.scale.x + (target - n.mesh.scale.x) * 0.12;
      n.mesh.scale.setScalar(s);
      if (n.mesh.userData.dial) n.mesh.userData.dial.rotation.z = t * 0.8;
      const color = m.alert ? ALERT : n.color;
      n.halo.material.color.setHex(color);
      n.halo.material.opacity = (m.dim ? 0.15 : active ? 1 : 0.55) * (m.alert ? 0.6 + Math.sin(t * 6) * 0.4 : 1);
      n.halo.scale.setScalar(active ? 3.6 : 2.4);
      n.line.material.color.setHex(color);
      n.line.material.opacity = m.dim ? 0.05 : active ? 0.9 : 0.3;
      n.pulses.forEach((p) => {
        const u = (t * 0.35 + p.offset) % 1;
        const pt = n.curve.getPoint(u);
        p.dot.position.copy(pt).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
        p.dot.material.color.setHex(color);
        p.dot.material.opacity = m.dim ? 0 : Math.sin(u * Math.PI);
      });
    });

    camPos.lerp(camPosGoal, Math.min(1, dt * 2.2));
    camLook.lerp(camLookGoal, Math.min(1, dt * 2.6));
    const introLift = (1 - ease(introT)) * 10;
    camera.position.set(camPos.x, camPos.y + introLift, camPos.z + introLift * 1.2);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  resize();
  requestAnimationFrame(tick);

  return {
    resize,
    setView(next) {
      const was = view.selectedId;
      view = next;
      const jobNode = next.nodes.find((n) => n.id === "job");
      buildGoal = jobNode && jobNode.dim ? 0 : 1;
      if (was !== next.selectedId || !camPosGoal.lengthSq()) focus(next.selectedId);
    },
    destroy() {
      running = false;
      renderer.dispose();
    },
  };
}
