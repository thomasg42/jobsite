/** One job, shared by Thomas's account, the backup, and the bookkeeper. */

export const FOLDERS = [
  { id: "photos", label: "Photos" },
  { id: "quote", label: "Quote" },
  { id: "changeOrders", label: "Change orders" },
  { id: "invoices", label: "Invoices" },
  { id: "receipts", label: "Receipts" },
];

const EMPTY = () => ({
  photos: [],
  quote: [],
  changeOrders: [],
  invoices: [],
  receipts: [],
});

function clone(value) {
  return structuredClone(value);
}

function file(id, name) {
  return { id, name };
}

export function seed() {
  return {
    version: 1,
    account: "Thomas",
    companyName: "",
    role: "owner",
    job: {
      id: "sample-main-street",
      name: "SAMPLE Job - Main Street",
      status: "active",
      folders: {
        photos: [file("site-photo", "Site photo")],
        quote: [file("quote", "Quote")],
        changeOrders: [],
        invoices: [],
        receipts: [file("receipt-scan", "Receipt scan")],
      },
    },
    deletedCopy: null,
    snapshots: [],
  };
}

export function visibleJob(state) {
  if (state.job.status === "deleted" && state.deletedCopy) {
    return { ...state.deletedCopy, status: "deleted" };
  }
  return state.job;
}

export function missingForBookkeeper(job) {
  if (!job || job.status === "deleted") return ["the job"];
  const missing = [];
  if (job.folders.receipts.length === 0) missing.push("a receipt");
  if (job.folders.invoices.length === 0) missing.push("an invoice");
  return missing;
}

export function addFile(state, folderId, name, id) {
  const clean = String(name || "").trim();
  if (!clean || state.job.status === "deleted") return state;
  if (!Object.prototype.hasOwnProperty.call(state.job.folders, folderId)) return state;
  const next = clone(state);
  const folder = next.job.folders[folderId];
  const fileId = id || `${folderId}-${folder.length + 1}`;
  if (folder.some((item) => item.id === fileId)) return state;
  folder.push(file(fileId, clean));
  return next;
}

export function removeFile(state, folderId, fileId) {
  if (state.job.status === "deleted") return state;
  if (!Object.prototype.hasOwnProperty.call(state.job.folders, folderId)) return state;
  const next = clone(state);
  next.job.folders[folderId] = next.job.folders[folderId].filter((item) => item.id !== fileId);
  return next;
}

export function deleteJob(state) {
  if (state.job.status === "deleted") return state;
  const next = clone(state);
  next.deletedCopy = clone(next.job);
  next.job = {
    ...next.job,
    status: "deleted",
    folders: EMPTY(),
  };
  return next;
}

export function restoreJob(state) {
  if (!state.deletedCopy) return state;
  const next = clone(state);
  next.job = { ...clone(next.deletedCopy), status: "active" };
  next.deletedCopy = null;
  return next;
}

export function takeSnapshot(state, id) {
  const source = visibleJob(state);
  if (source.status === "deleted") return state;
  const next = clone(state);
  next.snapshots.unshift({
    id: id || `snap-${next.snapshots.length + 1}`,
    name: source.name,
    folders: clone(source.folders),
  });
  return next;
}

export function restoreSnapshot(state, snapshotId) {
  const snap = state.snapshots.find((item) => item.id === snapshotId);
  if (!snap) return state;
  const next = clone(state);
  next.job = {
    ...next.job,
    name: snap.name,
    status: "active",
    folders: clone(snap.folders),
  };
  next.deletedCopy = null;
  return next;
}

export function setCompanyName(state, companyName) {
  const next = clone(state);
  next.companyName = String(companyName || "").trim();
  return next;
}

export function setRole(state, role) {
  if (role !== "owner" && role !== "bookkeeper") return state;
  const next = clone(state);
  next.role = role;
  return next;
}

export function sameFiles(state) {
  const job = visibleJob(state);
  return FOLDERS.map((folder) => ({
    id: folder.id,
    label: folder.label,
    files: job.folders[folder.id].map((item) => item.name),
  }));
}
