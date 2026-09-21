"use client";
export type FieldNoteDraft = { id: string; jobId: string; otherCustomer: boolean; customerName: string; note: string; files: File[]; locked: boolean };
let writes = Promise.resolve();
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("chillbros-field-note-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
export async function readFieldNoteDraft(key: string): Promise<FieldNoteDraft | null> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const request = db.transaction("drafts").objectStore("drafts").get(key); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); }
  finally { db.close(); }
}
export function saveFieldNoteDraft(key: string, draft: FieldNoteDraft | null) {
  const operation = writes.catch(() => {}).then(async () => {
    const db = await database();
    try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("drafts", "readwrite"); const store = tx.objectStore("drafts"); if (draft) store.put(draft, key); else store.delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
    finally { db.close(); }
  });
  writes = operation;
  return operation;
}
export async function prepareNotePhoto(file: File): Promise<File> {
  if (file.size > 30 * 1024 * 1024) throw new Error("Choose a photo smaller than 30 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode().catch(() => { throw new Error("This photo format cannot be opened. Take a new photo or export it as JPEG or PNG."); });
    const scale = Math.min(1, 3200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Could not prepare this photo.");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.85, 0.75]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 3 * 1024 * 1024) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    }
    throw new Error("This page is too large. Photograph each page separately and try again.");
  } finally { URL.revokeObjectURL(url); }
}
