import assert from "node:assert/strict";
import test from "node:test";
import { prepareOfflinePage } from "./pwa-offline";

test("prepareOfflinePage espera o worker ativo e normaliza o escopo", async () => {
  const messages: unknown[] = [];
  let readyWasRead = false;
  const activeWorker = {
    postMessage(message: unknown, transfer: Transferable[]) {
      messages.push(message);
      const replyPort = transfer[0] as MessagePort;
      replyPort.postMessage({ ok: true });
    },
  };
  const serviceWorker = {
    controller: null,
    get ready() {
      readyWasRead = true;
      return Promise.resolve({ active: activeWorker });
    },
  };

  await prepareOfflinePage(" user-1 ", serviceWorker);

  assert.equal(readyWasRead, true);
  assert.deepEqual(messages, [
    { type: "SET_ACCOUNT_SCOPE", scope: "user-1" },
    { type: "PREPARE_OFFLINE_PAGE", scope: "user-1" },
  ]);
});

test("prepareOfflinePage propaga a mensagem de erro retornada pelo worker", async () => {
  const controller = {
    postMessage(message: unknown, transfer: Transferable[]) {
      const replyPort = transfer[0] as MessagePort;
      replyPort.postMessage(
        (message as { type?: string }).type === "SET_ACCOUNT_SCOPE"
          ? { ok: true }
          : { ok: false, error: "Pagina offline indisponivel." },
      );
    },
  };

  await assert.rejects(
    prepareOfflinePage("user-1", {
      controller,
      ready: Promise.resolve({ active: controller }),
    }),
    /Pagina offline indisponivel/,
  );
});

test("prepareOfflinePage aplica o timeout enquanto aguarda o worker ficar pronto", async () => {
  const neverReady = new Promise<{ active: null }>(() => undefined);

  await Promise.race([
    assert.rejects(
      prepareOfflinePage(
        "user-1",
        {
          controller: null,
          ready: neverReady,
        },
        10,
      ),
      /Tempo esgotado/,
    ),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("prepareOfflinePage ficou aguardando ready sem limite.")), 50);
    }),
  ]);
});
