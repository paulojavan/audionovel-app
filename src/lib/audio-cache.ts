import type { OfflineItem } from "./offline-items";
import { assertOfflineCryptoSupported } from "./offline-crypto";
import { removeExpiredOfflineItems } from "./offline-items";
import { buildAccountStorageKey, normalizeAccountScope } from "./account-scope";
import {
  selectAvailableOfflineItems,
  selectRecoverableOfflineItems,
} from "./offline-catalog";
import { notifyOfflineCatalogUpdated } from "./offline-catalog-events";

const DB_NAME = "audio-novel-br-audio-cache";
const STORE_NAME = "audios";
const OFFLINE_ITEMS_STORE_NAME = "offlineItems";
const KEY_NAME = "audio-novel-br-audio-cache-key";
const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;
const DEFAULT_AUDIO_DOWNLOAD_ERROR = "Nao foi possivel baixar o audio.";
const MAX_AUDIO_ERROR_BODY_BYTES = 1_024;
const MAX_AUDIO_ERROR_MESSAGE_LENGTH = 200;

export class AudioDownloadHttpError extends Error {
  constructor(
    readonly status: number,
    message = DEFAULT_AUDIO_DOWNLOAD_ERROR,
  ) {
    super(message);
    this.name = "AudioDownloadHttpError";
  }
}

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

type OfflineCatalogSnapshot = {
  items: OfflineItem[];
  audioRecordIds: IDBValidKey[];
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

function filterScopedOfflineItems(
  records: ScopedOfflineItem[],
  accountScope: string,
) {
  const prefix = buildAccountStorageKey(accountScope, "");
  return records
    .filter((item) => item.storageId.startsWith(prefix))
    .map(({ storageId, ...item }) => {
      void storageId;
      return item;
    });
}

export class OfflineAudioInvalidError extends Error {
  constructor(message = "Audio offline indisponivel.", options?: ErrorOptions) {
    super(message, options);
    this.name = "OfflineAudioInvalidError";
  }
}

async function readOfflineCatalogSnapshot(accountScope: string) {
  const db = await openAudioDb();
  return new Promise<OfflineCatalogSnapshot>((resolve, reject) => {
    const transaction = db.transaction(
      [OFFLINE_ITEMS_STORE_NAME, STORE_NAME],
      "readonly",
    );
    const itemRequest = transaction
      .objectStore(OFFLINE_ITEMS_STORE_NAME)
      .getAll();
    const keyRequest = transaction.objectStore(STORE_NAME).getAllKeys();
    transaction.oncomplete = () => resolve({
      items: filterScopedOfflineItems(
        itemRequest.result as ScopedOfflineItem[],
        accountScope,
      ),
      audioRecordIds: keyRequest.result,
    });
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => db.close());
}

async function readAllOfflineItems(accountScope: string) {
  const snapshot = await readOfflineCatalogSnapshot(accountScope);
  return snapshot.items;
}

async function cleanupOrphanedOfflineItems(
  accountScope: string,
  snapshot: OfflineCatalogSnapshot,
) {
  const audioRecordIds = new Set(snapshot.audioRecordIds.map(String));
  const orphanedItems = snapshot.items.filter((item) => (
    !audioRecordIds.has(getAudioCacheId(accountScope, item.chapterId, "offline"))
  ));
  if (!orphanedItems.length) return;

  const db = await openAudioDb();
  try {
    const transaction = db.transaction(OFFLINE_ITEMS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(OFFLINE_ITEMS_STORE_NAME);
    for (const item of orphanedItems) {
      store.delete(buildAccountStorageKey(
        accountScope,
        `offline-item:${item.chapterId}`,
      ));
    }
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
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

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
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
  if (mode === "offline" && Number.isFinite(requestedExpiry)) {
    return requestedExpiry;
  }
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

async function getAudioDownloadHttpErrorMessage(response: Response) {
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return DEFAULT_AUDIO_DOWNLOAD_ERROR;
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_ERROR_BODY_BYTES) {
    return DEFAULT_AUDIO_DOWNLOAD_ERROR;
  }

  const reader = response.body?.getReader();
  if (!reader) return DEFAULT_AUDIO_DOWNLOAD_ERROR;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_AUDIO_ERROR_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return DEFAULT_AUDIO_DOWNLOAD_ERROR;
      }
      chunks.push(value);
    }
  } catch {
    return DEFAULT_AUDIO_DOWNLOAD_ERROR;
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as { error?: unknown };
    const message = typeof parsed.error === "string" ? parsed.error.trim() : "";
    return message.length > 0 && message.length <= MAX_AUDIO_ERROR_MESSAGE_LENGTH
      ? message
      : DEFAULT_AUDIO_DOWNLOAD_ERROR;
  } catch {
    return DEFAULT_AUDIO_DOWNLOAD_ERROR;
  }
}

export async function downloadAudioBuffer(sourceUrl: string, options: DownloadAudioBufferOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  let totalBytes: number | null = null;
  let lastError: unknown = new Error(DEFAULT_AUDIO_DOWNLOAD_ERROR);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const headers = new Headers();
      if (loadedBytes > 0) headers.set("Range", `bytes=${loadedBytes}-`);

      const response = await fetcher(sourceUrl, {
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new AudioDownloadHttpError(
          response.status,
          await getAudioDownloadHttpErrorMessage(response),
        );
      }

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
      if (
        error instanceof AudioDownloadHttpError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        break;
      }
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

async function decryptAudioRecord(record: AudioRecord, key: CryptoKey) {
  return globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: record.iv },
    key,
    record.data,
  );
}

function createAudioObjectUrl(record: AudioRecord, decrypted: ArrayBuffer) {
  return URL.createObjectURL(new Blob([decrypted], { type: record.mimeType }));
}

async function createObjectUrlFromRecord(record: AudioRecord, key: CryptoKey) {
  return createAudioObjectUrl(record, await decryptAudioRecord(record, key));
}

export async function getSavedEncryptedAudioUrl(
  accountScope: string,
  chapterId: string,
) {
  assertOfflineCryptoSupported();
  const normalizedScope = normalizeAccountScope(accountScope);
  const record = await getValidCachedRecord(
    normalizedScope,
    chapterId,
    "offline",
  );
  if (!record) throw new OfflineAudioInvalidError();
  const key = await getCryptoKey(normalizedScope);
  let decrypted: ArrayBuffer;
  try {
    decrypted = await decryptAudioRecord(record, key);
  } catch (error) {
    if (error instanceof DOMException && error.name === "OperationError") {
      throw new OfflineAudioInvalidError(
        "Audio offline corrompido.",
        { cause: error },
      );
    }
    throw error;
  }
  return createAudioObjectUrl(record, decrypted);
}

export async function removeOfflineItem(
  accountScope: string,
  chapterId: string,
) {
  const db = await openAudioDb();
  try {
    const transaction = db.transaction(
      [OFFLINE_ITEMS_STORE_NAME, STORE_NAME],
      "readwrite",
    );
    transaction
      .objectStore(OFFLINE_ITEMS_STORE_NAME)
      .delete(buildAccountStorageKey(accountScope, `offline-item:${chapterId}`));
    transaction
      .objectStore(STORE_NAME)
      .delete(getAudioCacheId(accountScope, chapterId, "offline"));
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}

export async function saveOfflineItem(accountScope: string, item: OfflineItem) {
  await writeOfflineItem(accountScope, item);
}

export async function getSavedOfflineItems(accountScope: string) {
  const snapshot = await readOfflineCatalogSnapshot(accountScope);
  queueMicrotask(() => {
    void cleanupOrphanedOfflineItems(accountScope, snapshot).catch(() => undefined);
  });
  return selectAvailableOfflineItems(
    snapshot.items,
    snapshot.audioRecordIds,
    accountScope,
  );
}

export async function getRecoverableOfflineItems(accountScope: string) {
  const snapshot = await readOfflineCatalogSnapshot(accountScope);
  return selectRecoverableOfflineItems(
    snapshot.items,
    snapshot.audioRecordIds,
    accountScope,
  );
}

export async function extendOfflineAudioExpiry(
  accountScope: string,
  chapterId: string,
  expiresAt: string | number,
) {
  const nextExpiry = typeof expiresAt === "number"
    ? expiresAt
    : new Date(expiresAt).getTime();
  if (!Number.isFinite(nextExpiry) || nextExpiry <= Date.now()) return false;

  const cacheId = getAudioCacheId(accountScope, chapterId, "offline");
  const record = await readRecord(cacheId);
  if (!record) return false;
  await writeRecord({
    ...record,
    expiresAt: nextExpiry,
  });
  return true;
}

export async function updateOfflineItemsBatch(
  accountScope: string,
  items: OfflineItem[],
) {
  if (!items.length) return 0;

  const db = await openAudioDb();
  try {
    const transaction = db.transaction(
      [OFFLINE_ITEMS_STORE_NAME, STORE_NAME],
      "readwrite",
    );
    const completion = waitForTransaction(transaction);
    const audioStore = transaction.objectStore(STORE_NAME);
    const itemStore = transaction.objectStore(OFFLINE_ITEMS_STORE_NAME);
    let updated = 0;

    for (const item of items) {
      const expiresAt = new Date(item.expiresAt).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) continue;
      const request = audioStore.get(
        getAudioCacheId(accountScope, item.chapterId, "offline"),
      );
      request.onsuccess = () => {
        const record = request.result as AudioRecord | undefined;
        if (!record) return;
        audioStore.put({ ...record, expiresAt } satisfies AudioRecord);
        itemStore.put({
          ...item,
          storageId: buildAccountStorageKey(
            accountScope,
            `offline-item:${item.chapterId}`,
          ),
        } satisfies ScopedOfflineItem);
        updated += 1;
      };
    }

    await completion;
    if (updated > 0) notifyOfflineCatalogUpdated(accountScope);
    return updated;
  } finally {
    db.close();
  }
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
