import type { OfflineItem } from "./offline-items";
import { assertOfflineCryptoSupported } from "./offline-crypto";
import { removeExpiredOfflineItems } from "./offline-items";
import { buildAccountStorageKey, normalizeAccountScope } from "./account-scope";

const DB_NAME = "audio-novel-br-audio-cache";
const STORE_NAME = "audios";
const OFFLINE_ITEMS_STORE_NAME = "offlineItems";
const KEY_NAME = "audio-novel-br-audio-cache-key";
const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

export type AudioCacheMode = "temporary" | "offline";

type AudioCacheOptions = {
  accountScope?: string;
  mode?: AudioCacheMode;
  expiresAt?: string | number;
  onProgress?: (progress: { loadedBytes: number; totalBytes: number | null; percent: number | null }) => void;
};

type DownloadAudioBufferOptions = Pick<AudioCacheOptions, "onProgress"> & {
  fetcher?: typeof fetch;
  maxAttempts?: number;
  onResponse?: (response: Response) => void;
};

type AudioRecord = {
  id: string;
  data: ArrayBuffer;
  iv: ArrayBuffer;
  mimeType: string;
  expiresAt: number;
};

type ScopedOfflineItem = OfflineItem & {
  storageId: string;
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
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = (event) => {
      if (event.oldVersion > 0 && event.oldVersion < 3) {
        if (request.result.objectStoreNames.contains(STORE_NAME)) request.result.deleteObjectStore(STORE_NAME);
        if (request.result.objectStoreNames.contains(OFFLINE_ITEMS_STORE_NAME)) request.result.deleteObjectStore(OFFLINE_ITEMS_STORE_NAME);
      }
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(OFFLINE_ITEMS_STORE_NAME)) {
        request.result.createObjectStore(OFFLINE_ITEMS_STORE_NAME, { keyPath: "storageId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCryptoKey(accountScope: string) {
  assertOfflineCryptoSupported();
  const cryptoApi = globalThis.crypto;
  const scopedKeyName = buildAccountStorageKey(accountScope, KEY_NAME);
  const existing = localStorage.getItem(scopedKeyName);
  if (existing) {
    return cryptoApi.subtle.importKey("raw", base64ToArrayBuffer(existing), "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  const raw = cryptoApi.getRandomValues(new Uint8Array(32));
  localStorage.setItem(scopedKeyName, arrayBufferToBase64(raw.buffer));
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

async function readAllOfflineItems(accountScope: string) {
  const db = await openAudioDb();
  return new Promise<OfflineItem[]>((resolve, reject) => {
    const request = db.transaction(OFFLINE_ITEMS_STORE_NAME, "readonly").objectStore(OFFLINE_ITEMS_STORE_NAME).getAll();
    request.onsuccess = () => {
      const prefix = buildAccountStorageKey(accountScope, "");
      const records = (request.result as ScopedOfflineItem[])
        .filter((item) => item.storageId.startsWith(prefix))
        .map(({ storageId, ...item }) => {
          void storageId;
          return item;
        });
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function writeOfflineItem(accountScope: string, item: OfflineItem) {
  const db = await openAudioDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(OFFLINE_ITEMS_STORE_NAME, "readwrite").objectStore(OFFLINE_ITEMS_STORE_NAME).put({
      ...item,
      storageId: buildAccountStorageKey(accountScope, `offline-item:${item.chapterId}`),
    } satisfies ScopedOfflineItem);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function deleteOfflineItem(accountScope: string, chapterId: string) {
  const db = await openAudioDb();
  return new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(OFFLINE_ITEMS_STORE_NAME, "readwrite")
      .objectStore(OFFLINE_ITEMS_STORE_NAME)
      .delete(buildAccountStorageKey(accountScope, `offline-item:${chapterId}`));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export function getAudioCacheId(accountScope: string, chapterId: string, mode: AudioCacheMode) {
  return buildAccountStorageKey(accountScope, `${mode}:chapter:${chapterId}`);
}

export function getReusableAudioCacheModes(mode: AudioCacheMode): AudioCacheMode[] {
  return mode === "offline" ? ["offline", "temporary"] : ["temporary"];
}

function getCacheTtl(mode: AudioCacheMode) {
  return mode === "offline" ? SEVEN_DAYS_MS : TWO_DAYS_MS;
}

export function getAudioCacheExpiry(
  mode: AudioCacheMode,
  now = Date.now(),
  expiresAt?: string | number,
) {
  const defaultExpiry = now + getCacheTtl(mode);
  if (expiresAt === undefined) return defaultExpiry;

  const requestedExpiry =
    typeof expiresAt === "number" ? expiresAt : new Date(expiresAt).getTime();
  return Number.isFinite(requestedExpiry)
    ? Math.min(defaultExpiry, requestedExpiry)
    : defaultExpiry;
}

function parseContentRange(value: string | null) {
  const match = value?.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/i);
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === "*" ? null : Number(match[3]),
  };
}

function emitDownloadProgress(
  onProgress: AudioCacheOptions["onProgress"],
  loadedBytes: number,
  totalBytes: number | null,
) {
  onProgress?.({
    loadedBytes,
    totalBytes,
    percent: totalBytes ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : null,
  });
}

export async function downloadAudioBuffer(sourceUrl: string, options: DownloadAudioBufferOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  let totalBytes: number | null = null;
  let lastError: unknown = new Error("Nao foi possivel baixar o audio.");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const headers = new Headers();
      if (loadedBytes > 0) headers.set("Range", `bytes=${loadedBytes}-`);

      const response = await fetcher(sourceUrl, {
        credentials: "include",
        headers,
      });
      if (!response.ok) throw new Error("Nao foi possivel baixar o audio.");

      const contentRange = parseContentRange(response.headers.get("content-range"));
      if (loadedBytes > 0 && response.status !== 206) {
        chunks.length = 0;
        loadedBytes = 0;
      } else if (loadedBytes > 0 && contentRange?.start !== loadedBytes) {
        throw new Error("O servidor retornou uma faixa de audio inesperada.");
      }

      const contentLength = Number(response.headers.get("content-length"));
      totalBytes =
        contentRange?.total ??
        (Number.isFinite(contentLength) && contentLength > 0
          ? loadedBytes + contentLength
          : totalBytes);
      options.onResponse?.(response);
      emitDownloadProgress(options.onProgress, loadedBytes, totalBytes);

      if (!response.body) {
        const value = new Uint8Array(await response.arrayBuffer());
        chunks.push(value);
        loadedBytes += value.byteLength;
      } else {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          chunks.push(value);
          loadedBytes += value.byteLength;
          emitDownloadProgress(options.onProgress, loadedBytes, totalBytes);
        }
      }

      if (totalBytes !== null && loadedBytes < totalBytes) {
        throw new Error("A transferencia de audio terminou antes do esperado.");
      }

      const buffer = new Uint8Array(loadedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }

      emitDownloadProgress(options.onProgress, loadedBytes, totalBytes);
      return buffer.buffer;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
    }
  }

  throw lastError;
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

export async function cleanupExpiredOfflineItems(accountScope: string) {
  const items = await readAllOfflineItems(accountScope);
  const validItems = removeExpiredOfflineItems(items);
  const validChapterIds = new Set(validItems.map((item) => item.chapterId));
  const expiredItems = items.filter((item) => !validChapterIds.has(item.chapterId));

  await Promise.all(
    expiredItems.map(async (item) => {
      await deleteOfflineItem(accountScope, item.chapterId);
      await deleteRecord(getAudioCacheId(accountScope, item.chapterId, "offline"));
    }),
  );
}

export async function hasValidEncryptedAudio(accountScope: string, chapterId: string, mode: AudioCacheMode = "offline") {
  await cleanupExpiredAudioCache();
  const cacheId = getAudioCacheId(accountScope, chapterId, mode);
  const cached = await readRecord(cacheId);

  if (!cached) return false;
  if (cached.expiresAt > Date.now()) return true;

  await deleteRecord(cacheId);
  return false;
}

async function getValidCachedRecord(accountScope: string, chapterId: string, mode: AudioCacheMode) {
  const cacheId = getAudioCacheId(accountScope, chapterId, mode);
  const cached = await readRecord(cacheId);

  if (!cached) return null;
  if (cached.expiresAt > Date.now()) return cached;

  await deleteRecord(cacheId);
  return null;
}

async function saveRecordForMode(
  accountScope: string,
  chapterId: string,
  mode: AudioCacheMode,
  record: AudioRecord,
  expiresAt?: string | number,
) {
  await writeRecord({
    ...record,
    id: getAudioCacheId(accountScope, chapterId, mode),
    expiresAt: getAudioCacheExpiry(
      mode,
      Date.now(),
      Math.min(
        record.expiresAt,
        expiresAt === undefined
          ? Number.POSITIVE_INFINITY
          : typeof expiresAt === "number"
            ? expiresAt
            : new Date(expiresAt).getTime(),
      ),
    ),
  });
}

async function createObjectUrlFromRecord(record: AudioRecord, key: CryptoKey) {
  const decrypted = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv }, key, record.data);
  return URL.createObjectURL(new Blob([decrypted], { type: record.mimeType }));
}

export async function saveOfflineItem(accountScope: string, item: OfflineItem) {
  await cleanupExpiredAudioCache();
  await cleanupExpiredOfflineItems(accountScope);
  await writeOfflineItem(accountScope, item);
}

export async function getSavedOfflineItems(accountScope: string) {
  await cleanupExpiredAudioCache();
  await cleanupExpiredOfflineItems(accountScope);
  const items = removeExpiredOfflineItems(await readAllOfflineItems(accountScope));
  const validItems = await Promise.all(
    items.map(async (item) => {
      const cachedAudio = await getValidCachedRecord(accountScope, item.chapterId, "offline");
      if (cachedAudio) return item;
      await deleteOfflineItem(accountScope, item.chapterId);
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
  const accountScope = normalizeAccountScope(options.accountScope);
  const key = await getCryptoKey(accountScope);

  for (const cachedMode of getReusableAudioCacheModes(mode)) {
    const cached = await getValidCachedRecord(accountScope, chapterId, cachedMode);
    if (!cached) continue;

    if (cachedMode !== mode) {
      await saveRecordForMode(accountScope, chapterId, mode, cached, options.expiresAt);
    }

    return createObjectUrlFromRecord(cached, key);
  }

  let mimeType = "audio/mpeg";
  const buffer = await downloadAudioBuffer(sourceUrl, {
    onProgress: options.onProgress,
    onResponse(response) {
      mimeType = response.headers.get("content-type") ?? mimeType;
    },
  });
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const encrypted = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer);

  await writeRecord({
    id: getAudioCacheId(accountScope, chapterId, mode),
    data: encrypted,
    iv: iv.buffer,
    mimeType,
    expiresAt: getAudioCacheExpiry(mode, Date.now(), options.expiresAt),
  });

  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}
