import { createGalaxy } from "./scene3d.js";
import {
  FOLDERS,
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
} from "./model.js";

const STORAGE_KEY = "fg-scott-job-galaxy-v1";
const dock = document.querySelector("#dock");
const caption = document.querySelector("#caption");
const companyLine = document.querySelector("#companyLine");
const roleOwner = document.querySelector("#roleOwner");
const roleBook = document.querySelector("#roleBook");
const canvas = document.querySelector("#sky");

let state = load();
let selected = "job";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.version === 1 && saved.job && saved.job.folders) return saved;
  } catch {
    /* a bad save falls back to the sample */
  }
  return seed();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function commit(next) {
  state = next;
  save();
  paint();
}

function companyText() {
  return state.companyName
    ? `Sample for Scott · ${state.companyName}`
    : "Sample for Scott. Company name not set.";
}

function nodeView() {
  const job = visibleJob(state);
  const missing = missingForBookkeeper(job);
  const dim = job.status === "deleted";
  const nodes = [
    { id: "job", label: "SAMPLE Job", dim, alert: false },
    ...FOLDERS.map((folder) => ({
      id: folder.id,
      label: `${folder.label} · ${job.folders[folder.id].length}`,
      dim,
      alert: false,
    })),
    {
      id: "backup",
      label: dim ? "Recently Deleted" : "Backup",
      dim: false,
      alert: false,
    },
    {
      id: "bookkeeper",
      label: missing.length ? "Bookkeeper" : "Bookkeeper",
      dim,
      alert: missing.length > 0,
    },
  ];
  return { nodes, selectedId: selected };
}

function chips() {
  const job = visibleJob(state);
  const missing = missingForBookkeeper(job);
  const items = [
    ["job", "Job"],
    ...FOLDERS.map((folder) => [folder.id, folder.label]),
    ["backup", job.status === "deleted" ? "Recently Deleted" : "Backup"],
    ["bookkeeper", "Bookkeeper"],
  ];
  return `<div class="chips">${items
    .map(([id, label]) => {
      const warn = id === "bookkeeper" && missing.length ? " warn" : "";
      const current = id === selected ? ' aria-current="true"' : "";
      return `<button type="button" data-select="${id}" class="${warn}"${current}>${label}</button>`;
    })
    .join("")}</div>`;
}

function fileList(folderId, files) {
  if (!files.length) return `<p class="missing">Nothing in here yet.</p>`;
  const owner = state.role === "owner" && state.job.status === "active";
  return `<ul class="files">${files
    .map((item) => {
      const remove = owner
        ? `<button type="button" class="quiet-action" data-remove="${folderId}:${item.id}">Remove</button>`
        : "";
      return `<li><span>${escapeHtml(item.name)}</span>${remove}</li>`;
    })
    .join("")}</ul>`;
}

function addRow(folderId) {
  if (state.role !== "owner" || state.job.status !== "active") return "";
  return `<form class="add" data-add="${folderId}">
    <input name="fileName" aria-label="File name" placeholder="File name" />
    <button type="submit">Add</button>
  </form>`;
}

function jobPanel() {
  const job = visibleJob(state);
  const missing = missingForBookkeeper(job);
  const held = job.status === "deleted"
    ? `<p class="missing">The job is in Recently Deleted. Bring it back from Backup.</p>`
    : `<p>One folder. Photos, quote, change orders, invoices, and receipts stay on this job.</p>`;
  const flag = missing.length && job.status === "active"
    ? `<p class="missing">The bookkeeper is missing ${missing.join(" and ")}.</p>`
    : "";
  const company = state.role === "owner"
    ? `<label class="company">Company name
        <input id="companyName" value="${escapeAttr(state.companyName)}" placeholder="Not set" />
      </label>`
    : "";
  const actions = state.role === "owner"
    ? `<div class="stack">
        ${job.status === "deleted"
          ? `<button type="button" data-restore>Bring it back</button>`
          : `<button type="button" class="quiet-action" data-delete>Delete the sample job</button>
             <button type="button" data-snapshot>Take a second copy</button>`}
      </div>`
    : "";
  return `${chips()}<h2>${job.name}</h2>${held}${flag}${company}${actions}`;
}

function folderPanel(folderId) {
  const folder = FOLDERS.find((item) => item.id === folderId);
  const job = visibleJob(state);
  const files = job.folders[folderId];
  const held = job.status === "deleted" ? `<p class="missing">Held in Recently Deleted.</p>` : `<p>These files are the ones the bookkeeper opens.</p>`;
  return `${chips()}<h2>${folder.label}</h2>${held}${fileList(folderId, files)}${addRow(folderId)}`;
}

function backupPanel() {
  const job = visibleJob(state);
  const copies = state.snapshots.length
    ? `<ul class="files">${state.snapshots
        .map((snap) => `<li><span>Second copy</span>${
          state.role === "owner"
            ? `<button type="button" data-snap="${snap.id}">Bring this copy back</button>`
            : ""
        }</li>`)
        .join("")}</ul>`
    : `<p>No second copy yet.</p>`;
  const primary = state.role !== "owner"
    ? ""
    : job.status === "deleted"
      ? `<button type="button" data-restore>Bring the deleted job back</button>`
      : `<button type="button" data-snapshot>Take a second copy</button>`;
  const note = job.status === "deleted"
    ? `<p class="missing">The working copy is in Recently Deleted. The receipt is still inside it.</p>`
    : `<p>The working copy is this account. A second copy survives the delete.</p>`;
  return `${chips()}<h2>${job.status === "deleted" ? "Recently Deleted" : "Backup"}</h2>${note}<div class="stack">${primary}</div>${copies}`;
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
  return `${chips()}<h2>Bookkeeper</h2><p>Same job, same files, on Thomas's account.</p>${flag}<ul class="files">${lists}</ul>`;
}

function paint() {
  companyLine.textContent = companyText();
  roleOwner.setAttribute("aria-pressed", String(state.role === "owner"));
  roleBook.setAttribute("aria-pressed", String(state.role === "bookkeeper"));
  const body = selected === "job"
    ? jobPanel()
    : selected === "backup"
      ? backupPanel()
      : selected === "bookkeeper"
        ? bookkeeperPanel()
        : folderPanel(selected);
  dock.innerHTML = body;
  const selectedNode = nodeView().nodes.find((node) => node.id === selected);
  caption.textContent = selectedNode ? selectedNode.label : "";
  galaxy.setView(nodeView());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

const galaxy = createGalaxy(canvas, {
  onSelect(id) {
    selected = id;
    paint();
  },
  reducedMotion: false,
  bottomReserve() {
    if (window.innerWidth >= 980) return 0;
    return dock.getBoundingClientRect().height + 24;
  },
});

dock.addEventListener("click", (event) => {
  const select = event.target.closest("[data-select]");
  if (select) {
    selected = select.dataset.select;
    paint();
    return;
  }
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
document.querySelector("#reset").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = seed();
  selected = "job";
  paint();
});

window.addEventListener("resize", () => galaxy.resize());
new ResizeObserver(() => galaxy.resize()).observe(dock);
paint();
