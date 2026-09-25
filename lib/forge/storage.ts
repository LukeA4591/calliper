import { analysisSchema, type Analysis } from "./types";

type StoredProject = { analysis: Analysis; pdf?: Blob; step?: Blob };
const database = "forgecheck-local-v1";
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("projects", { keyPath: "analysis.id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error("Local project storage is unavailable in this browser."),
      );
  });
}
export async function loadProjects(): Promise<StoredProject[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("projects")
        .objectStore("projects")
        .getAll();
      request.onsuccess = () => {
        const projects: StoredProject[] = [];
        for (const record of request.result) {
          const parsed = analysisSchema.safeParse(record.analysis);
          if (parsed.success)
            projects.push({ ...record, analysis: parsed.data });
        }
        resolve(projects);
      };
      request.onerror = () =>
        reject(new Error("Could not read saved projects."));
    });
  } finally {
    db.close();
  }
}
export async function saveProject(
  analysis: Analysis,
  files?: { pdf?: Blob; step?: Blob },
) {
  analysisSchema.parse(analysis);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      const store = transaction.objectStore("projects");
      const existing = store.get(analysis.id);
      existing.onsuccess = () =>
        store.put({ ...existing.result, ...files, analysis });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          new Error("Could not save locally. Browser storage may be full."),
        );
      transaction.onabort = () =>
        reject(new Error("Local save was interrupted. Please try again."));
    });
  } finally {
    db.close();
  }
}
