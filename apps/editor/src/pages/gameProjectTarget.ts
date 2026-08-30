/**
 * Persist a target folder for 99HerosOnline (or any game) prefab/atlas export.
 * Uses File System Access API when available; falls back to download.
 */

const PATH_HINT_KEY = 'gameui.gameProject.prefabPathHint';
const ATLAS_HINT_KEY = 'gameui.gameProject.atlasPathHint';
const IDB_NAME = 'gameui-project-targets';
const IDB_STORE = 'handles';
const PREFAB_HANDLE_KEY = 'prefabDir';
const ATLAS_HANDLE_KEY = 'atlasDir';

export const DEFAULT_PREFAB_PATH_HINT =
  'D:\\MyProjects\\WebProject\\99HerosOnline\\public\\ui\\prefabs';
export const DEFAULT_ATLAS_PATH_HINT =
  'D:\\MyProjects\\WebProject\\99HerosOnline\\public\\assets\\UIAtlas';

export function getPrefabPathHint(): string {
  try {
    return localStorage.getItem(PATH_HINT_KEY) || DEFAULT_PREFAB_PATH_HINT;
  } catch {
    return DEFAULT_PREFAB_PATH_HINT;
  }
}

export function setPrefabPathHint(path: string): void {
  localStorage.setItem(PATH_HINT_KEY, path.trim() || DEFAULT_PREFAB_PATH_HINT);
}

export function getAtlasPathHint(): string {
  try {
    return localStorage.getItem(ATLAS_HINT_KEY) || DEFAULT_ATLAS_PATH_HINT;
  } catch {
    return DEFAULT_ATLAS_PATH_HINT;
  }
}

export function setAtlasPathHint(path: string): void {
  localStorage.setItem(ATLAS_HINT_KEY, path.trim() || DEFAULT_ATLAS_PATH_HINT);
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const opts = { mode };
  let perm = await handle.queryPermission?.(opts);
  if (perm === 'granted') return true;
  perm = await handle.requestPermission?.(opts);
  return perm === 'granted';
}

export async function pickPrefabDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirectoryPicker()) return null;
  const handle = await window.showDirectoryPicker({
    id: 'gameui-prefabs',
    mode: 'readwrite',
  });
  await idbSet(PREFAB_HANDLE_KEY, handle);
  setPrefabPathHint(handle.name);
  return handle;
}

export async function pickAtlasDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirectoryPicker()) return null;
  const handle = await window.showDirectoryPicker({
    id: 'gameui-atlas',
    mode: 'readwrite',
  });
  await idbSet(ATLAS_HANDLE_KEY, handle);
  setAtlasPathHint(handle.name);
  return handle;
}

export async function getStoredPrefabDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await idbGet(PREFAB_HANDLE_KEY);
    if (!handle) return null;
    // Prefer readwrite (save); fall back to read for import-only.
    if (await ensurePermission(handle, 'readwrite')) return handle;
    if (await ensurePermission(handle, 'read')) return handle;
    return null;
  } catch {
    return null;
  }
}

export async function getStoredAtlasDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await idbGet(ATLAS_HANDLE_KEY);
    if (!handle) return null;
    if (!(await ensurePermission(handle))) return null;
    return handle;
  } catch {
    return null;
  }
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
  text: string
): Promise<void> {
  const file = await dir.getFileHandle(filename, { create: true });
  const writable = await file.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function writeBlobFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob
): Promise<void> {
  const file = await dir.getFileHandle(filename, { create: true });
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
}

export type SavePrefabResult =
  | { ok: true; method: 'directory' | 'download'; filename: string }
  | { ok: false; error: string };

/**
 * Save prefab JSON into the configured game prefabs folder (or download).
 */
export async function savePrefabJsonToGameProject(
  filename: string,
  jsonText: string
): Promise<SavePrefabResult> {
  let dir = await getStoredPrefabDirectory();
  if (!dir && supportsDirectoryPicker()) {
    dir = await pickPrefabDirectory();
  }
  if (dir) {
    await writeTextFile(dir, filename, jsonText);
    return { ok: true, method: 'directory', filename };
  }
  downloadBlob(filename, new Blob([jsonText], { type: 'application/json' }));
  return { ok: true, method: 'download', filename };
}

export async function saveAtlasToGameProject(
  pngBlob: Blob,
  jsonText: string,
  pngName = 'UIAtlas.png',
  jsonName = 'UIAtlas.json'
): Promise<SavePrefabResult> {
  let dir = await getStoredAtlasDirectory();
  if (!dir && supportsDirectoryPicker()) {
    dir = await pickAtlasDirectory();
  }
  if (dir) {
    await writeBlobFile(dir, pngName, pngBlob);
    await writeTextFile(dir, jsonName, jsonText);
    return { ok: true, method: 'directory', filename: pngName };
  }
  downloadBlob(pngName, pngBlob);
  downloadBlob(jsonName, new Blob([jsonText], { type: 'application/json' }));
  return { ok: true, method: 'download', filename: pngName };
}

export type PrefabDirEntry = {
  filename: string;
  text: string;
};

export type ReadPrefabsFromGameResult =
  | { ok: true; dirName: string; files: PrefabDirEntry[] }
  | { ok: false; error: string };

function looksLikePrefabFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.prefab.gameui.json') ||
    (lower.endsWith('.json') && lower.includes('prefab'))
  );
}

/**
 * Resolve game prefab folder (stored binding or directory picker), then read
 * every Prefab JSON file in that folder (non-recursive).
 */
export async function readAllPrefabsFromGameProject(options?: {
  /** Force showDirectoryPicker even if a binding exists. */
  forcePick?: boolean;
}): Promise<ReadPrefabsFromGameResult> {
  if (!supportsDirectoryPicker()) {
    return {
      ok: false,
      error:
        '当前浏览器不支持打开文件夹。请用 Chrome/Edge，或改用「导入 Prefab」逐个选文件。',
    };
  }

  let dir: FileSystemDirectoryHandle | null = null;
  if (!options?.forcePick) {
    dir = await getStoredPrefabDirectory();
  }
  if (!dir) {
    try {
      dir = await pickPrefabDirectory();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: '已取消选择文件夹' };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
  if (!dir) {
    return { ok: false, error: '未选择 Prefab 文件夹' };
  }

  const candidates: { filename: string; handle: FileSystemFileHandle }[] = [];
  try {
    for await (const entry of dir.values()) {
      if (entry.kind !== 'file') continue;
      if (!looksLikePrefabFilename(entry.name)) continue;
      candidates.push({
        filename: entry.name,
        handle: entry as FileSystemFileHandle,
      });
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '读取文件夹失败',
    };
  }

  // Also pick up plain .json that might be prefabs (content-checked later by caller)
  if (candidates.length === 0) {
    try {
      for await (const entry of dir.values()) {
        if (entry.kind !== 'file') continue;
        if (!entry.name.toLowerCase().endsWith('.json')) continue;
        candidates.push({
          filename: entry.name,
          handle: entry as FileSystemFileHandle,
        });
      }
    } catch {
      /* ignore second pass */
    }
  }

  candidates.sort((a, b) =>
    a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' })
  );

  const files: PrefabDirEntry[] = [];
  for (const c of candidates) {
    try {
      const file = await c.handle.getFile();
      const text = await file.text();
      files.push({ filename: c.filename, text });
    } catch {
      /* skip unreadable */
    }
  }

  return { ok: true, dirName: dir.name, files };
}
