import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  flushProgressOutbox,
  getQueuedProgress,
  queueProgress,
  readProgressOutbox,
  removeQueuedProgress,
} from "./progress-outbox";

const layoutSource = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
const syncComponent = readFileSync(
  join(process.cwd(), "src", "components", "progress-outbox-sync.tsx"),
  "utf8",
);

function installStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

function entry(chapterId: string, positionSec: number, overrides: Partial<{
  durationSec: number;
  completed: boolean;
  updatedAt: number;
}> = {}) {
  return {
    chapterId,
    positionSec,
    durationSec: overrides.durationSec ?? 600,
    completed: overrides.completed ?? false,
    updatedAt: overrides.updatedAt ?? Date.now(),
  };
}

async function withMockedFetch(
  implementation: (body: Record<string, unknown>) => Promise<Response>,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) =>
    implementation(JSON.parse(String(init?.body)))) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("fila mantem somente a posicao mais recente de cada capitulo", () => {
  installStorage();
  const base = Date.now();
  queueProgress("user-1", entry("cap-1", 100, { updatedAt: base }));
  queueProgress("user-1", entry("cap-1", 200, { updatedAt: base + 1_000 }));
  queueProgress("user-1", entry("cap-2", 50, { updatedAt: base + 2_000 }));

  assert.equal(readProgressOutbox("user-1").length, 2);
  assert.equal(getQueuedProgress("user-1", "cap-1")?.positionSec, 200);
  assert.equal(getQueuedProgress("user-1", "cap-2")?.positionSec, 50);
});

test("o registro mais recente de um capitulo prevalece por inteiro na fila", () => {
  installStorage();
  const base = Date.now();
  queueProgress("user-1", entry("cap-1", 600, { completed: true, updatedAt: base }));
  // Ao reouvir um capitulo concluido, o novo tempo (nao concluido) substitui.
  queueProgress("user-1", entry("cap-1", 120, { completed: false, updatedAt: base + 1_000 }));

  const queued = getQueuedProgress("user-1", "cap-1");
  assert.equal(queued?.completed, false);
  assert.equal(queued?.positionSec, 120);
});

test("fila descarta os capitulos mais antigos ao passar do limite", () => {
  installStorage();
  const base = Date.now();
  for (let index = 0; index < 60; index += 1) {
    queueProgress("user-1", entry(`cap-${index}`, index, { updatedAt: base + index }));
  }

  const entries = readProgressOutbox("user-1");
  assert.equal(entries.length, 50);
  assert.equal(getQueuedProgress("user-1", "cap-0"), null);
  assert.equal(getQueuedProgress("user-1", "cap-59")?.positionSec, 59);
});

test("fila de progresso e isolada por conta", () => {
  installStorage();
  queueProgress("user-1", entry("cap-1", 100));

  assert.equal(getQueuedProgress("user-2", "cap-1"), null);
  assert.equal(readProgressOutbox("user-2").length, 0);
});

test("remocao respeita o carimbo de tempo e nao apaga salvamentos mais novos", () => {
  installStorage();
  const base = Date.now();
  queueProgress("user-1", entry("cap-1", 100, { updatedAt: base }));

  removeQueuedProgress("user-1", "cap-1", base - 500);
  assert.notEqual(getQueuedProgress("user-1", "cap-1"), null);

  removeQueuedProgress("user-1", "cap-1", base);
  assert.equal(getQueuedProgress("user-1", "cap-1"), null);
});

test("leitura ignora dados corrompidos e itens muito antigos", () => {
  const storage = installStorage();
  storage.setItem("audio-novel-progress-outbox-v1:user-1", "{json invalido");
  assert.deepEqual(readProgressOutbox("user-1"), []);

  storage.setItem("audio-novel-progress-outbox-v1:user-1", JSON.stringify([
    entry("cap-velho", 10, { updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }),
    entry("cap-novo", 20, { updatedAt: Date.now() }),
    { chapterId: 42 },
  ]));
  const entries = readProgressOutbox("user-1");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].chapterId, "cap-novo");
});

test("sincronizacao reenvia a fila e limpa somente o que foi confirmado", async () => {
  installStorage();
  const base = Date.now();
  queueProgress("user-1", entry("cap-1", 100, { updatedAt: base }));
  queueProgress("user-1", entry("cap-2", 590, { completed: true, updatedAt: base + 1_000 }));
  const sent: Array<Record<string, unknown>> = [];

  await withMockedFetch(async (body) => {
    sent.push(body);
    return new Response("{}", { status: 200 });
  }, async () => {
    await flushProgressOutbox("user-1");
  });

  assert.equal(sent.length, 2);
  assert.equal(sent[0].chapterId, "cap-1");
  assert.equal(sent[1].chapterId, "cap-2");
  assert.equal(sent[1].completed, true);
  assert.equal(readProgressOutbox("user-1").length, 0);
});

test("sincronizacao descarta rejeicoes definitivas e preserva falhas temporarias", async () => {
  installStorage();
  const base = Date.now();
  queueProgress("user-1", entry("cap-401", 100, { updatedAt: base }));
  queueProgress("user-1", entry("cap-500", 200, { updatedAt: base + 1_000 }));
  queueProgress("user-1", entry("cap-300", 300, { updatedAt: base + 2_000 }));

  await withMockedFetch(async (body) => {
    if (body.chapterId === "cap-401") return new Response("{}", { status: 401 });
    return new Response("{}", { status: 500 });
  }, async () => {
    await flushProgressOutbox("user-1");
  });

  assert.equal(getQueuedProgress("user-1", "cap-401"), null);
  assert.notEqual(getQueuedProgress("user-1", "cap-500"), null);
  assert.notEqual(getQueuedProgress("user-1", "cap-300"), null);
});

test("sincronizacao preserva a fila quando a rede falha", async () => {
  installStorage();
  queueProgress("user-1", entry("cap-1", 100));

  await withMockedFetch(async () => {
    throw new TypeError("Failed to fetch");
  }, async () => {
    await flushProgressOutbox("user-1");
  });

  assert.notEqual(getQueuedProgress("user-1", "cap-1"), null);
});

test("sincronizacao nao apaga um item reenfileirado durante o envio", async () => {
  installStorage();
  const base = Date.now();
  queueProgress("user-1", entry("cap-1", 100, { updatedAt: base }));

  await withMockedFetch(async () => {
    // Enquanto o envio antigo esta em curso, uma posicao mais nova entra na fila.
    queueProgress("user-1", entry("cap-1", 150, { updatedAt: base + 1_000 }));
    return new Response("{}", { status: 200 });
  }, async () => {
    await flushProgressOutbox("user-1");
  });

  assert.equal(getQueuedProgress("user-1", "cap-1")?.positionSec, 150);
});

test("sincronizacoes simultaneas da mesma conta compartilham uma unica execucao", async () => {
  installStorage();
  queueProgress("user-1", entry("cap-1", 100));
  let calls = 0;

  await withMockedFetch(async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  }, async () => {
    const first = flushProgressOutbox("user-1");
    const second = flushProgressOutbox("user-1");
    assert.strictEqual(first, second);
    await first;
  });

  assert.equal(calls, 1);
});

test("layout sincroniza a fila de progresso ao montar e ao reconectar", () => {
  assert.match(syncComponent, /flushProgressOutbox\(accountScope\)/);
  assert.match(syncComponent, /addEventListener\("online", sync\)/);
  assert.match(syncComponent, /visibilitychange/);
  assert.match(layoutSource, /<ProgressOutboxSync accountScope=\{activeSession\.user\.id\} \/>/);
});
