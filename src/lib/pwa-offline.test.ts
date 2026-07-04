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
  assert.deepEqual(messages, [{ type: "PREPARE_OFFLINE_PAGE", scope: "user-1" }]);
});

test("prepareOfflinePage propaga a mensagem de erro retornada pelo worker", async () => {
  const controller = {
    postMessage(_message: unknown, transfer: Transferable[]) {
      const replyPort = transfer[0] as MessagePort;
      replyPort.postMessage({ ok: false, error: "Pagina offline indisponivel." });
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
