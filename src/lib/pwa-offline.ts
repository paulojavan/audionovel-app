import { normalizeAccountScope } from "@/lib/account-scope";

type ServiceWorkerMessageTarget = {
  postMessage(message: unknown, transfer: Transferable[]): void;
};

type OfflinePageServiceWorker = {
  readonly controller: ServiceWorkerMessageTarget | null;
  readonly ready: PromiseLike<{ active: ServiceWorkerMessageTarget | null }>;
};

type OfflinePagePreparationReply = {
  ok?: boolean;
  error?: string;
};

const OFFLINE_PREPARATION_TIMEOUT_MESSAGE = "Tempo esgotado ao preparar a pagina offline.";

export async function prepareOfflinePage(
  accountScope: string,
  serviceWorker: OfflinePageServiceWorker = navigator.serviceWorker,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  const registration = await withTimeout(serviceWorker.ready, timeoutMs);
  const worker = serviceWorker.controller ?? registration.active;
  if (!worker) throw new Error("Service worker indisponivel.");
  const scope = normalizeAccountScope(accountScope);

  await postWorkerRequest(
    worker,
    { type: "SET_ACCOUNT_SCOPE", scope },
    Math.max(1, deadline - Date.now()),
  );
  await postWorkerRequest(
    worker,
    { type: "PREPARE_OFFLINE_PAGE", scope },
    Math.max(1, deadline - Date.now()),
  );
}

async function postWorkerRequest(
  worker: ServiceWorkerMessageTarget,
  message: { type: "SET_ACCOUNT_SCOPE" | "PREPARE_OFFLINE_PAGE"; scope: string },
  timeoutMs: number,
) {
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(
      () => finish(new Error(OFFLINE_PREPARATION_TIMEOUT_MESSAGE)),
      timeoutMs,
    );

    channel.port1.onmessage = (event: MessageEvent<OfflinePagePreparationReply>) => {
      const reply = event.data;
      finish(reply?.ok ? undefined : new Error(reply?.error ?? "Nao foi possivel preparar a pagina offline."));
    };

    try {
      worker.postMessage(message, [channel.port2]);
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Nao foi possivel contatar o service worker."));
    }
  });
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(OFFLINE_PREPARATION_TIMEOUT_MESSAGE)),
      timeoutMs,
    );

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
