// Fila local de progresso de escuta: salvamentos que falham (offline, rede
// instavel, erro temporario) ficam enfileirados por conta e sao reenviados na
// proxima oportunidade. Apenas o registro mais recente de cada capitulo e
// mantido, incluindo o estado de conclusao.
export type ProgressOutboxEntry = {
  chapterId: string;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  updatedAt: number;
};

const OUTBOX_KEY_PREFIX = "audio-novel-progress-outbox-v1:";
const MAX_ENTRIES = 50;
const MAX_ENTRY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function outboxKey(accountScope: string) {
  return `${OUTBOX_KEY_PREFIX}${accountScope}`;
}

function isValidEntry(value: unknown): value is ProgressOutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.chapterId === "string" && entry.chapterId.length > 0 &&
    typeof entry.positionSec === "number" && Number.isFinite(entry.positionSec) && entry.positionSec >= 0 &&
    typeof entry.durationSec === "number" && Number.isFinite(entry.durationSec) && entry.durationSec >= 0 &&
    typeof entry.completed === "boolean" &&
    typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
  );
}

export function readProgressOutbox(accountScope: string, now = Date.now()): ProgressOutboxEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(outboxKey(accountScope));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ProgressOutboxEntry =>
      isValidEntry(entry) && now - entry.updatedAt <= MAX_ENTRY_AGE_MS,
    );
  } catch {
    return [];
  }
}

function writeProgressOutbox(accountScope: string, entries: ProgressOutboxEntry[]) {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (entries.length === 0) storage.removeItem(outboxKey(accountScope));
    else storage.setItem(outboxKey(accountScope), JSON.stringify(entries));
  } catch {
    // Sem armazenamento disponivel: o progresso em sessao continua sendo salvo.
  }
}

export function getQueuedProgress(accountScope: string, chapterId: string) {
  return readProgressOutbox(accountScope).find((entry) => entry.chapterId === chapterId) ?? null;
}

export function queueProgress(accountScope: string, entry: ProgressOutboxEntry) {
  const entries = readProgressOutbox(accountScope);
  const index = entries.findIndex((item) => item.chapterId === entry.chapterId);
  if (index >= 0) entries.splice(index, 1);
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
  writeProgressOutbox(accountScope, entries);
}

// Remove o item somente se nao houver uma versao mais nova que maxUpdatedAt,
// para nao apagar um salvamento enfileirado depois da confirmacao.
export function removeQueuedProgress(accountScope: string, chapterId: string, maxUpdatedAt?: number) {
  const entries = readProgressOutbox(accountScope);
  const next = entries.filter((entry) =>
    entry.chapterId !== chapterId ||
    (maxUpdatedAt !== undefined && entry.updatedAt > maxUpdatedAt),
  );
  if (next.length !== entries.length) writeProgressOutbox(accountScope, next);
}

const inFlightFlushes = new Map<string, Promise<void>>();

export function flushProgressOutbox(accountScope: string): Promise<void> {
  const existing = inFlightFlushes.get(accountScope);
  if (existing) return existing;
  const flush = doFlushProgressOutbox(accountScope).finally(() => {
    if (inFlightFlushes.get(accountScope) === flush) inFlightFlushes.delete(accountScope);
  });
  inFlightFlushes.set(accountScope, flush);
  return flush;
}

async function doFlushProgressOutbox(accountScope: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  for (const entry of readProgressOutbox(accountScope)) {
    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: entry.chapterId,
          positionSec: entry.positionSec,
          durationSec: entry.durationSec,
          completed: entry.completed,
        }),
      });
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        // Confirmado ou rejeitado definitivamente (ex.: sessao expirada):
        // descarta o item. Erros temporarios (429/5xx) mantem a fila e
        // interrompem o envio para tentar novamente no proximo gatilho.
        removeQueuedProgress(accountScope, entry.chapterId, entry.updatedAt);
        continue;
      }
      return;
    } catch {
      return;
    }
  }
}
