import type { OfflineItem } from "./offline-items";
import { assertOfflineCryptoSupported } from "./offline-crypto";
import { removeExpiredOfflineItems } from "./offline-items";

const DB_NAME = "audio-novel-br-audio-cache";
const STORE_NAME = "audios";
const OFFLINE_ITEMS_STORE_NAME = "offlineItems";
const KEY_NAME = "audio-novel-br-audio-cache-key";
const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

type AudioCacheMode = "temporary" | "offline";

type AudioCacheOptions = {
  mode?: AudioCacheMode;
  onProgress?: (progress: { loadedBytes: number; totalBytes: number | null; percent: number | null }) => void;
};

type AudioRecord = {
  id: string;
  data: ArrayBuffer;
  iv: ArrayBuffer;
  mimeType: string;
  expiresAt: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function openAudioDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains(OFFLINE_ITEMS_STORE_NAME)) {
        request.result.createObjectStore(OFFLINE_ITEMS_STORE_NAME, { keyPath: "chapterId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCryptoKey() {
  assertOfflineCryptoSupported();
  const cryptoApi = globalThis.crypto;
  const existing = localStorage.getItem(KEY_NAME);
  if (existing) {
    return cryptoApi.subtle.importKey("raw", base64ToArrayBuffer(existing), "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  const raw = cryptoApi.getRandomValues(new Uint8Array(32));
  localStorage.setItem(KEY_NAME, arrayBufferToBase64(raw.buffer));
  return cryptoApi.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function readRecord(id: string) {
  const db = await openAudioDb();
  return new Promise<AudioRecord | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as AudioRecord | undefined);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function writeRecord(record: AudioRecord) {
  const db = await openAudioDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function deleteRecord(id: string) {
  const db = await openAudioDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function readAllOfflineItems() {
  const db = await openAudioDb();
  return new Promise<OfflineItem[]>((resolve, reject) => {
    const request = db.transaction(OFFLINE_ITEMS_STORE_NAME, "readonly").objectStore(OFFLINE_ITEMS_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as OfflineItem[]);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function writeOfflineItem(item: OfflineItem) {
  const db = await openAudioDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(OFFLINE_ITEMS_STORE_NAME, "readwrite").objectStore(OFFLINE_ITEMS_STORE_NAME).put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function deleteOfflineItem(chapterId: string) {
  const db = await openAudioDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(OFFLINE_ITEMS_STORE_NAME, "readwrite").objectStore(OFFLINE_ITEMS_STORE_NAME).delete(chapterId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

function getCacheId(chapterId: string, mode: AudioCacheMode) {
  return `${mode}:chapter:${chapterId}`;
}

function getCacheTtl(mode: AudioCacheMode) {
  return mode === "offline" ? SEVEN_DAYS_MS : TWO_DAYS_MS;
}

async function readResponseBuffer(response: Response, onProgress?: AudioCacheOptions["onProgress"]) {
  const totalBytes = Number(response.headers.get("content-length"));
  const total = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : null;

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress?.({ loadedBytes: buffer.byteLength, totalBytes: total, percent: total ? 100 : null });
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  onProgress?.({ loadedBytes: 0, totalBytes: total, percent: total ? 0 : null });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loadedBytes += value.byteLength;
    onProgress?.({
      loadedBytes,
      totalBytes: total,
      percent: total ? Math.min(100, Math.round((loadedBytes / total) * 100)) : null,
    });
  }

  const buffer = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  onProgress?.({ loadedBytes, totalBytes: total, percent: total ? 100 : null });
  return buffer.buffer;
}

export async function cleanupExpiredAudioCache() {
  const db = await openAudioDb();
  const now = Date.now();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value as AudioRecord;
      if (record.expiresAt <= now) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}

export async function cleanupExpiredOfflineItems() {
  const items = await readAllOfflineItems();
  const validItems = removeExpiredOfflineItems(items);
  const validChapterIds = new Set(validItems.map((item) => item.chapterId));
  const expiredItems = items.filter((item) => !validChapterIds.has(item.chapterId));

  await Promise.all(
    expiredItems.map(async (item) => {
      await deleteOfflineItem(item.chapterId);
      await deleteRecord(getCacheId(item.chapterId, "offline"));
    }),
  );
}

export async function hasValidEncryptedAudio(chapterId: string, mode: AudioCacheMode = "offline") {
  await cleanupExpiredAudioCache();
  const cacheId = getCacheId(chapterId, mode);
  const cached = await readRecord(cacheId);

  if (!cached) return false;
  if (cached.expiresAt > Date.now()) return true;

  await deleteRecord(cacheId);
  return false;
}

export async function saveOfflineItem(item: OfflineItem) {
  await cleanupExpiredAudioCache();
  await cleanupExpiredOfflineItems();
  await writeOfflineItem(item);
}

export async function getSavedOfflineItems() {
  await cleanupExpiredAudioCache();
  await cleanupExpiredOfflineItems();
  const items = removeExpiredOfflineItems(await readAllOfflineItems());
  const validItems = await Promise.all(
    items.map(async (item) => {
      const hasAudio = await hasValidEncryptedAudio(item.chapterId, "offline");
      if (hasAudio) return item;
      await deleteOfflineItem(item.chapterId);
      return null;
    }),
  );

  return validItems.filter((item): item is OfflineItem => Boolean(item));
}

export async function getEncryptedAudioUrl(chapterId: string, sourceUrl: string, options: AudioCacheOptions = {}) {
  assertOfflineCryptoSupported();
  const cryptoApi = globalThis.crypto;
  await cleanupExpiredAudioCache();
  const mode = options.mode ?? "temporary";
  const cacheId = getCacheId(chapterId, mode);
  const key = await getCryptoKey();
  const cached = await readRecord(cacheId);

  if (cached && cached.expiresAt > Date.now()) {
    const decrypted = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv: cached.iv }, key, cached.data);
    return URL.createObjectURL(new Blob([decrypted], { type: cached.mimeType }));
  }

  if (cached) await deleteRecord(cacheId);

  const response = await fetch(sourceUrl, { credentials: "include" });
  if (!response.ok) throw new Error("Nao foi possivel baixar o audio.");

  const mimeType = response.headers.get("content-type") ?? "audio/mpeg";
  const buffer = await readResponseBuffer(response, options.onProgress);
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const encrypted = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer);

  await writeRecord({
    id: cacheId,
    data: encrypted,
    iv: iv.buffer,
    mimeType,
    expiresAt: Date.now() + getCacheTtl(mode),
  });

  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}
