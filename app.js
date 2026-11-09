import { createJobsite } from "./scene3d.js?v=20261109b";
import {
  FOLDERS,
  WORKFLOW,
  seed,
  addFile,
  removeFile,
  deleteJob,
  restoreJob,
  takeSnapshot,
  restoreSnapshot,
  missingForBookkeeper,
  visibleJob,
  setCompanyName,
  setRole,
  stationStatus,
} from "./model.js?v=20261109b";

const STORAGE_KEY = "fg-scott-job-galaxy-v1";
const STEP_MS = 7000;
const $ = (selector) => document.querySelector(selector);
const stage = $("#stage");
const canvas = $("#sky");
const dock = $("#dock");
const flow = $("#flow");
const flowList = $("#flowList");
const tagLayer = $("#tags");
const companyLine = $("#companyLine");
const roleOwner = $("#roleOwner");
const roleBook = $("#roleBook");
const tourBar = $("#tourBar");
const phone = window.matchMedia("(max-width: 979px)");

let state = load();
let selected = "job";
let sheetOpen = false;
const tour = { on: false, playing: false, done: false, index: 0, elapsed: 0 };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.version === 1 && saved.job && saved.job.folders) return saved;
  } catch {
    /* a bad or blocked save falls back to the sample */
  }
  return seed();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private windows can refuse storage; the sample still works */
  }
}

function commit(next) {
  state = next;
  save();
  paint();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const stepOf = (id) => WORKFLOW.find((step) => step.id === id) || WORKFLOW[0];

function companyText() {
  return state.companyName ? `Sample for Scott · ${state.companyName}` : "Sample for Scott. Company name not set.";
}

function sceneView(status) {
  const job = visibleJob(state);
  return {
    selectedId: selected,
    deleted: job.status === "deleted",
    jobName: job.name,
    companyName: state.companyName,
    stations: status,
    rows: FOLDERS.map((folder) => ({
      label: folder.label,
      count: status[folder.id].count,
      missing: status[folder.id].missing,
    })),
  };
}

// ---------- the step rail (left on a computer, a strip on a phone) ----------
function keepFocus(container, render) {
  const active = document.activeElement;
  const id = active && container.contains(active) && active.dataset ? active.dataset.select : null;
  render();
  if (id) {
    const again = container.querySelector(`[data-select="${id}"]`);
    if (again) again.focus({ preventScroll: true });
  }
}

function renderFlow(status) {
  keepFocus(flowList, () => {
    let html = "";
    let pillar = "";
    WORKFLOW.forEach((step, i) => {
      if (step.pillar !== pillar) {
        pillar = step.pillar;
        html += `<li class="pillar" aria-hidden="true"><span>${step.pillarNo}</span>${escapeHtml(step.pillar)}</li>`;
      }
      const s = status[step.id];
      const cls = [
        "step",
        step.id === selected ? "on" : "",
        s.alert || s.missing ? "warn" : "",
        s.dim ? "dim" : "",
        tour.on && (i < tour.index || tour.done) ? "seen" : "",
      ]
        .filter(Boolean)
        .join(" ");
      html += `<li><button type="button" class="${cls}" data-select="${step.id}"${step.id === selected ? ' aria-current="step"' : ""}>
        <b>${step.n}</b><span class="t">${escapeHtml(step.title)}</span><span class="c">${escapeHtml(s.short)}</span>
        <small>${escapeHtml(step.line)}</small></button></li>`;
    });
    flowList.innerHTML = html;
  });
  if (phone.matches) {
    const on = flowList.querySelector(".step.on");
    if (on) {
      const box = flow.getBoundingClientRect();
      const item = on.getBoundingClientRect();
      if (item.left < box.left + 8 || item.right > box.right - 8) {
        flow.scrollBy({ left: item.left - box.left - box.width / 2 + item.width / 2, behavior: "smooth" });
      }
    }
  }
}

// ---------- name tags that float over the 3D objects ----------
const tags = new Map();
WORKFLOW.forEach((step) => {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "tag off";
  el.dataset.select = step.id;
  el.innerHTML = `<b>${step.n}</b><span class="t">${escapeHtml(step.title)}</span><span class="c"></span>`;
  tagLayer.append(el);
  tags.set(step.id, { el, x: NaN, y: NaN, z: NaN, shown: false, w: 0, h: 0 });
});

function measureTags() {
  tags.forEach((tag) => {
    tag.w = tag.el.offsetWidth;
    tag.h = tag.el.offsetHeight;
  });
}

function updateTags(status) {
  WORKFLOW.forEach((step) => {
    const tag = tags.get(step.id);
    const s = status[step.id];
    tag.el.querySelector(".c").textContent = s.short;
    tag.el.classList.toggle("on", step.id === selected);
    tag.el.classList.toggle("warn", Boolean(s.alert || s.missing));
    tag.el.classList.toggle("dim", Boolean(s.dim));
    tag.el.setAttribute("aria-label", `Step ${step.n}, ${step.title}: ${s.short}`);
  });
  measureTags();
}

const placed = [];
function placeTags(list) {
  // nearest and selected tags keep their spot; any tag that would cover one is lifted above it
  const order = list
    .filter((p) => p.visible && tags.has(p.id))
    .sort((a, b) => (a.id === selected ? -1 : b.id === selected ? 1 : a.depth - b.depth));
  placed.length = 0;
  for (const p of order) {
    const tag = tags.get(p.id);
    let y = p.y;
    for (let pass = 0; pass < 6; pass += 1) {
      const hit = placed.find((q) => Math.abs(q.x - p.x) < (q.w + tag.w) / 2 + 4 && y > q.y - q.h - 4 && y - tag.h < q.y + 4);
      if (!hit) break;
      y = hit.y - hit.h - 6;
    }
    p.y = y;
    placed.push({ x: p.x, y, w: tag.w, h: tag.h });
  }
  const edge = tagLayer.clientWidth;
  for (const p of list) {
    const tag = tags.get(p.id);
    if (!tag) continue;
    if (tag.w && edge) p.x = Math.min(Math.max(p.x, tag.w / 2 + 6), edge - tag.w / 2 - 6);
    if (p.visible !== tag.shown) {
      tag.el.classList.toggle("off", !p.visible);
      tag.shown = p.visible;
    }
    if (!p.visible) continue;
    const x = Math.round(p.x * 2) / 2;
    const y = Math.round(p.y * 2) / 2;
    if (x !== tag.x || y !== tag.y) {
      tag.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      tag.x = x;
      tag.y = y;
    }
    const behind = Boolean(p.behind) && p.id !== selected;
    if (behind !== tag.behind) {
      tag.el.classList.toggle("behind", behind);
      tag.behind = behind;
    }
    const z = p.id === selected ? 2000 : 1000 - Math.round(p.depth * 8) - (behind ? 500 : 0);
    if (z !== tag.z) {
      tag.el.style.zIndex = String(z);
      tag.z = z;
    }
  }
}

// ---------- the detail panel ----------
function fileList(folderId, files) {
  if (!files.length) return `<p class="missing">Nothing in here yet.</p>`;
  const owner = state.role === "owner" && state.job.status === "active";
  return `<ul class="files">${files
    .map((item) => {
      const remove = owner
        ? `<button type="button" class="quiet-action" data-remove="${folderId}:${escapeHtml(item.id)}">Remove</button>`
        : "";
      return `<li><span>${escapeHtml(item.name)}</span>${remove}</li>`;
    })
    .join("")}</ul>`;
}

function addRow(folderId) {
  if (state.role !== "owner" || state.job.status !== "active") return "";
  return `<form class="add" data-add="${folderId}">
    <input name="fileName" aria-label="File name" placeholder="File name" autocomplete="off" />
    <button type="submit">Add</button>
  </form>`;
}

function jobPanel() {
  const job = visibleJob(state);
  const missing = missingForBookkeeper(job);
  const held =
    job.status === "deleted"
      ? `<p class="missing">The job is in Recently Deleted. Bring it back from Backup.</p>`
      : `<p>Photos, quote, change orders, invoices, and receipts all stay on this job.</p>`;
  const flag =
    missing.length && job.status === "active"
      ? `<p class="missing">The bookkeeper is missing ${missing.join(" and ")}.</p>`
      : "";
  const company =
    state.role === "owner"
      ? `<label class="company">Company name
          <input id="companyName" value="${escapeHtml(state.companyName)}" placeholder="Not set" autocomplete="off" />
        </label>`
      : "";
  const actions =
    state.role === "owner"
      ? `<div class="stack">${
          job.status === "deleted"
            ? `<button type="button" data-restore>Bring it back</button>`
            : `<button type="button" class="quiet-action" data-delete>Delete the sample job</button>
               <button type="button" data-snapshot>Take a second copy</button>`
        }</div>`
      : "";
  return `${held}${flag}${company}${actions}`;
}

function folderPanel(folderId) {
  const job = visibleJob(state);
  const held =
    job.status === "deleted"
      ? `<p class="missing">Held in Recently Deleted.</p>`
      : `<p>These are the same files the bookkeeper opens.</p>`;
  return `${held}${fileList(folderId, job.folders[folderId])}${addRow(folderId)}`;
}

function backupPanel() {
  const job = visibleJob(state);
  const copies = state.snapshots.length
    ? `<ul class="files">${state.snapshots
        .map(
          (snap) =>
            `<li><span>Second copy</span>${
              state.role === "owner" ? `<button type="button" data-snap="${escapeHtml(snap.id)}">Bring this copy back</button>` : ""
            }</li>`,
        )
        .join("")}</ul>`
    : `<p>No second copy yet.</p>`;
  const primary =
    state.role !== "owner"
      ? ""
      : job.status === "deleted"
        ? `<button type="button" data-restore>Bring the deleted job back</button>`
        : `<button type="button" data-snapshot>Take a second copy</button>`;
  const note =
    job.status === "deleted"
      ? `<p class="missing">The working copy is in Recently Deleted. The receipt is still inside it.</p>`
      : `<p>The working copy is this account. A second copy survives the delete.</p>`;
  return `${note}<div class="stack">${primary}</div>${copies}`;
}

function bookkeeperPanel() {
  const job = visibleJob(state);
  const missing = missingForBookkeeper(job);
  const flag = missing.length
    ? `<p class="missing">Missing ${missing.join(" and ")}.</p>`
    : `<p>The receipt and the invoice are both here.</p>`;
  const lists = FOLDERS.map((folder) => {
    const names = job.folders[folder.id].map((item) => escapeHtml(item.name));
    return `<li><span>${folder.label}</span><span>${names.length ? names.join(", ") : "Empty"}</span></li>`;
  }).join("");
  return `<p>Same job, same files, on Thomas's account.</p>${flag}<ul class="files">${lists}</ul>`;
}

function stepNav(step) {
  const i = WORKFLOW.indexOf(step);
  const prev = WORKFLOW[i - 1];
  const next = WORKFLOW[i + 1];
  return `<nav class="step-nav" aria-label="Step by step">
    ${prev ? `<button type="button" class="ghost" data-select="${prev.id}">← ${escapeHtml(prev.title)}</button>` : "<span></span>"}
    ${
      next
        ? `<button type="button" class="ghost strong" data-select="${next.id}">Next: ${escapeHtml(next.title)} →</button>`
        : `<button type="button" class="ghost strong" data-overview>See the whole job</button>`
    }
  </nav>`;
}

function renderDock() {
  const step = stepOf(selected);
  const job = visibleJob(state);
  const title =
    step.id === "job" ? job.name : step.id === "backup" && job.status === "deleted" ? "Recently Deleted" : step.title;
  const body =
    step.id === "job"
      ? jobPanel()
      : step.id === "backup"
        ? backupPanel()
        : step.id === "bookkeeper"
          ? bookkeeperPanel()
          : folderPanel(step.id);
  dock.classList.toggle("open", sheetOpen);
  keepFocus(dock, () => {
    dock.innerHTML = `<div class="dock-head">
        <b class="num">${step.n}</b>
        <div class="dock-title"><p class="eyebrow">${step.pillarNo} · ${escapeHtml(step.pillar)}</p><h2>${escapeHtml(title)}</h2></div>
        <button type="button" class="sheet-toggle" data-sheet aria-expanded="${sheetOpen}">${sheetOpen ? "Less" : "Details"}</button>
      </div>
      <div class="dock-body"><p class="lead">${escapeHtml(step.line)}</p>${body}${stepNav(step)}</div>`;
  });
}

// ---------- the walkthrough ----------
function renderTour() {
  tourBar.hidden = !tour.on;
  stage.classList.toggle("touring", tour.on);
  if (!tour.on) return;
  if (tour.done) {
    $("#tourKicker").textContent = "That is the whole job";
    $("#tourTitle").textContent = "One job. One folder. Everyone sees it.";
    $("#tourLine").textContent =
      "Photos, quote, change orders, invoices and receipts live on the job. A second copy is kept. The bookkeeper opens the same folder.";
    $("#tourPause").textContent = "Play again";
  } else {
    const step = WORKFLOW[tour.index];
    $("#tourKicker").textContent = `Step ${step.n} of ${WORKFLOW.length} · ${step.pillar}`;
    $("#tourTitle").textContent = step.id === "job" ? "The job" : step.title;
    $("#tourLine").textContent = step.line;
    $("#tourPause").textContent = tour.playing ? "Pause" : "Play";
  }
  $("#tourPrev").disabled = tour.index === 0 && !tour.done;
  $("#tourNext").disabled = tour.done;
  renderMeter();
}

function renderMeter() {
  const part = tour.done ? 1 : (tour.index + Math.min(1, tour.elapsed / STEP_MS)) / WORKFLOW.length;
  $("#tourFill").style.transform = `scaleX(${part.toFixed(4)})`;
}

function goStep(i) {
  tour.index = Math.max(0, Math.min(WORKFLOW.length - 1, i));
  tour.elapsed = 0;
  tour.done = false;
  const step = WORKFLOW[tour.index];
  selected = step.id;
  paint();
  syncLayout();
  if (scene) {
    scene.focus(step.id);
    scene.pulse(step.id);
  }
}

function startTour() {
  tour.on = true;
  tour.playing = true;
  goStep(0);
}

function finishTour() {
  tour.done = true;
  tour.playing = false;
  selected = "job";
  paint();
  if (scene) scene.overview();
}

function stopTour() {
  tour.on = false;
  tour.playing = false;
  tour.done = false;
  paint();
  if (scene) scene.overview();
}

function pauseTour() {
  if (tour.on && tour.playing) {
    tour.playing = false;
    renderTour();
  }
}

function tickTour(dt) {
  if (!tour.on || !tour.playing || tour.done) return;
  tour.elapsed += dt * 1000;
  if (tour.elapsed >= STEP_MS) {
    if (tour.index < WORKFLOW.length - 1) goStep(tour.index + 1);
    else finishTour();
    return;
  }
  renderMeter();
}

// ---------- paint ----------
function paint() {
  const status = stationStatus(state);
  companyLine.textContent = companyText();
  roleOwner.setAttribute("aria-pressed", String(state.role === "owner"));
  roleBook.setAttribute("aria-pressed", String(state.role === "bookkeeper"));
  renderFlow(status);
  updateTags(status);
  renderDock();
  renderTour();
  if (scene) scene.setView(sceneView(status));
}

function select(id) {
  if (!WORKFLOW.some((step) => step.id === id)) return;
  selected = id;
  if (tour.on) {
    tour.index = WORKFLOW.findIndex((step) => step.id === id);
    tour.elapsed = 0;
    tour.done = false;
    tour.playing = false;
  }
  paint();
  if (scene) scene.focus(id);
}

// ---------- layout numbers the 3D view needs ----------
function insets() {
  const r = stage.getBoundingClientRect();
  const bar = tourBar.hidden ? null : tourBar.getBoundingClientRect();
  if (!phone.matches) {
    const f = flow.getBoundingClientRect();
    const d = dock.getBoundingClientRect();
    return {
      left: Math.max(0, f.right - r.left),
      right: Math.max(0, r.right - d.left),
      top: 0,
      bottom: bar ? Math.max(0, r.bottom - bar.top) : 0,
    };
  }
  const f = flow.getBoundingClientRect();
  const d = dock.getBoundingClientRect();
  return { left: 0, right: 0, top: Math.max(0, f.bottom - r.top), bottom: Math.max(0, r.bottom - (bar ? bar.top : d.top)) };
}

function syncLayout() {
  const r = stage.getBoundingClientRect();
  const d = dock.getBoundingClientRect();
  const f = flow.getBoundingClientRect();
  stage.style.setProperty("--dock-h", `${Math.max(0, Math.round(r.bottom - d.top))}px`);
  stage.style.setProperty("--flow-h", `${Math.max(0, Math.round(f.bottom - r.top))}px`);
  if (scene) scene.resize();
}

// ---------- start the 3D view ----------
let scene = null;
try {
  scene = createJobsite(canvas, {
    steps: WORKFLOW,
    insets,
    onSelect: (id) => select(id),
    onUserCamera: pauseTour,
    onFrame(list, dt) {
      placeTags(list);
      tickTour(dt);
    },
  });
  window.jobsite = scene;
} catch (error) {
  console.error(error);
  stage.classList.add("no-3d");
  const note = document.createElement("p");
  note.className = "no3d";
  note.textContent = "This device could not start the 3D view. Every folder still works in the panel.";
  stage.append(note);
  setInterval(() => tickTour(0.1), 100);
}

// ---------- events ----------
document.addEventListener("click", (event) => {
  const pick = event.target.closest("[data-select]");
  if (pick) {
    select(pick.dataset.select);
    return;
  }
  if (event.target.closest("[data-overview]")) {
    selected = "job";
    paint();
    if (scene) scene.overview();
    return;
  }
  if (event.target.closest("[data-sheet]")) {
    sheetOpen = !sheetOpen;
    paint();
    return;
  }
  if (!dock.contains(event.target)) return;
  if (event.target.closest("[data-delete]")) commit(deleteJob(state));
  if (event.target.closest("[data-restore]")) commit(restoreJob(state));
  if (event.target.closest("[data-snapshot]")) commit(takeSnapshot(state, `snap-${Date.now()}`));
  const snap = event.target.closest("[data-snap]");
  if (snap) commit(restoreSnapshot(state, snap.dataset.snap));
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    const [folderId, fileId] = remove.dataset.remove.split(":");
    commit(removeFile(state, folderId, fileId));
  }
});

dock.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-add]");
  if (!form) return;
  event.preventDefault();
  const name = new FormData(form).get("fileName");
  commit(addFile(state, form.dataset.add, name, `${form.dataset.add}-${Date.now()}`));
});

dock.addEventListener("change", (event) => {
  if (event.target.id !== "companyName") return;
  commit(setCompanyName(state, event.target.value));
});

roleOwner.addEventListener("click", () => commit(setRole(state, "owner")));
roleBook.addEventListener("click", () => commit(setRole(state, "bookkeeper")));
$("#reset").addEventListener("click", () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing saved to clear */
  }
  state = seed();
  selected = "job";
  tour.on = false;
  tour.playing = false;
  tour.done = false;
  paint();
  if (scene) scene.replay();
});

$("#tourBtn").addEventListener("click", startTour);
$("#tourPause").addEventListener("click", () => {
  if (tour.done) {
    startTour();
    return;
  }
  tour.playing = !tour.playing;
  renderTour();
});
$("#tourNext").addEventListener("click", () => {
  if (tour.index < WORKFLOW.length - 1) goStep(tour.index + 1);
  else finishTour();
});
$("#tourPrev").addEventListener("click", () => goStep(tour.done ? WORKFLOW.length - 1 : tour.index - 1));
$("#tourStop").addEventListener("click", stopTour);
$("#zoomIn").addEventListener("click", () => scene && scene.zoom(0.75));
$("#zoomOut").addEventListener("click", () => scene && scene.zoom(1.35));
$("#zoomAll").addEventListener("click", () => {
  pauseTour();
  if (scene) scene.overview();
});

document.addEventListener("keydown", (event) => {
  if (event.target.closest && event.target.closest("input, textarea, select")) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const i = WORKFLOW.findIndex((step) => step.id === selected);
  if (event.key === "ArrowRight" && i < WORKFLOW.length - 1) select(WORKFLOW[i + 1].id);
  else if (event.key === "ArrowLeft" && i > 0) select(WORKFLOW[i - 1].id);
  else if ((event.key === "+" || event.key === "=") && scene) scene.zoom(0.8);
  else if ((event.key === "-" || event.key === "_") && scene) scene.zoom(1.25);
  else if (event.key === "0" && scene) scene.overview();
  else if (event.key === "Escape" && tour.on) stopTour();
  else return;
  event.preventDefault();
});

window.addEventListener("resize", syncLayout);
phone.addEventListener("change", () => {
  paint();
  syncLayout();
});
new ResizeObserver(syncLayout).observe(dock);
new ResizeObserver(syncLayout).observe(flow);
new ResizeObserver(syncLayout).observe(tourBar);
paint();
syncLayout();
