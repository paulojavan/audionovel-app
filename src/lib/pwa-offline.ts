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

export async function prepareOfflinePage(
  accountScope: string,
  serviceWorker: OfflinePageServiceWorker = navigator.serviceWorker,
  timeoutMs = 15_000,
) {
  const registration = await serviceWorker.ready;
  const worker = serviceWorker.controller ?? registration.active;
  if (!worker) throw new Error("Service worker indisponivel.");

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
      () => finish(new Error("Tempo esgotado ao preparar a pagina offline.")),
      timeoutMs,
    );

    channel.port1.onmessage = (event: MessageEvent<OfflinePagePreparationReply>) => {
      const reply = event.data;
      finish(reply?.ok ? undefined : new Error(reply?.error ?? "Nao foi possivel preparar a pagina offline."));
    };

    try {
      worker.postMessage(
        {
          type: "PREPARE_OFFLINE_PAGE",
          scope: normalizeAccountScope(accountScope),
        },
        [channel.port2],
      );
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Nao foi possivel contatar o service worker."));
    }
  });
}
