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

const folderLabel = (id) => FOLDERS.find((folder) => folder.id === id).label;

/**
 * How one job moves, in order. Each step sits under one of Scott's four words.
 * The 3D stations, the step rail and the walkthrough all read this list.
 */
export const WORKFLOW = [
  {
    id: "job",
    n: 1,
    pillarNo: "01",
    pillar: "Organized",
    title: "Job",
    line: "Every job starts as one folder. The same five folders sit inside it, every time.",
  },
  {
    id: "photos",
    n: 2,
    pillarNo: "02",
    pillar: "Stored in one place",
    title: folderLabel("photos"),
    line: "Site photos from the phone go here, not to the camera roll.",
  },
  {
    id: "quote",
    n: 3,
    pillarNo: "02",
    pillar: "Stored in one place",
    title: folderLabel("quote"),
    line: "The quote the customer said yes to stays on the job.",
  },
  {
    id: "changeOrders",
    n: 4,
    pillarNo: "02",
    pillar: "Stored in one place",
    title: folderLabel("changeOrders"),
    line: "When the work changes, the change order goes here, on the same job.",
  },
  {
    id: "invoices",
    n: 5,
    pillarNo: "02",
    pillar: "Stored in one place",
    title: folderLabel("invoices"),
    line: "Every invoice or draw you send goes here.",
  },
  {
    id: "receipts",
    n: 6,
    pillarNo: "02",
    pillar: "Stored in one place",
    title: folderLabel("receipts"),
    line: "Snap a receipt at the supply counter. It lands in Receipts.",
  },
  {
    id: "backup",
    n: 7,
    pillarNo: "03",
    pillar: "Backed up",
    title: "Backup",
    line: "A second copy is kept. Delete the job and bring it back.",
  },
  {
    id: "bookkeeper",
    n: 8,
    pillarNo: "04",
    pillar: "Bookkeeper in the loop",
    title: "Bookkeeper",
    line: "The bookkeeper opens this same folder. You only hear about it when a receipt or invoice is missing.",
  },
];

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/** What each workflow station holds right now, for the 3D labels and the rail. */
export function stationStatus(state) {
  const job = visibleJob(state);
  const deleted = job.status === "deleted";
  const missing = missingForBookkeeper(job);
  const total = FOLDERS.reduce((sum, folder) => sum + job.folders[folder.id].length, 0);
  const out = {
    job: {
      count: total,
      files: [],
      missing: false,
      alert: false,
      dim: deleted,
      short: deleted ? "In Recently Deleted" : plural(total, "file", "files"),
    },
  };
  FOLDERS.forEach((folder) => {
    const files = job.folders[folder.id].map((item) => item.name);
    const need = !deleted && files.length === 0 && (folder.id === "receipts" || folder.id === "invoices");
    out[folder.id] = {
      count: files.length,
      files,
      missing: need,
      alert: false,
      dim: deleted,
      short: need ? "Missing" : files.length === 0 ? "Empty" : plural(files.length, "file", "files"),
    };
  });
  const copies = state.snapshots.length;
  out.backup = {
    count: copies,
    files: [],
    missing: false,
    alert: false,
    dim: false,
    short: deleted ? "Holding the job" : copies ? plural(copies, "second copy", "second copies") : "No second copy yet",
  };
  out.bookkeeper = {
    count: 0,
    files: [],
    missing: false,
    alert: missing.length > 0,
    dim: deleted,
    short: deleted ? "Job deleted" : missing.length ? `Missing ${missing.length}` : "All here",
  };
  return out;
}
