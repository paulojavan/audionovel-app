"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  getEncryptedAudioUrl,
  getRecoverableOfflineItems,
  updateOfflineItemsBatch,
} from "@/lib/audio-cache";
import { ensureClientDeviceToken } from "@/lib/client-device";
import { waitForOfflineCatalogReady } from "@/lib/offline-catalog-readiness";
import { enqueueOfflineDownload } from "@/lib/offline-download-queue";
import {
  reconcileOfflineEntitlement,
  type RenewedOfflineItem,
} from "@/lib/offline-entitlement-sync";
import {
  getOfflineSyncNextAttemptAt,
  shouldStartOfflineSync,
  type OfflineSyncOutcome,
} from "@/lib/offline-sync-policy";
import { prepareOfflinePage } from "@/lib/pwa-offline";

const RENEW_TIMEOUT_MS = 15_000;
const inFlightSyncs = new Map<string, Promise<void>>();

export function OfflineEntitlementSync({ accountScope }: { accountScope: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const storageKey = `audio-novel-offline-sync:${accountScope}`;
    const renewalCursorKey = `audio-novel-offline-renew-cursor:${accountScope}`;
    let disposed = false;
    let retryTimer: number | null = null;

    const clearRetryTimer = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
    };

    const scheduleAt = (nextAttemptAt: number) => {
      if (disposed) return;
      clearRetryTimer();
      retryTimer = window.setTimeout(
        () => void startSync(),
        Math.max(0, nextAttemptAt - Date.now()),
      );
    };

    const recordOutcome = (outcome: OfflineSyncOutcome) => {
      const nextAttemptAt = getOfflineSyncNextAttemptAt(outcome);
      try {
        sessionStorage.setItem(storageKey, String(nextAttemptAt));
      } catch {
        // O timer em memoria ainda limita repeticoes nesta montagem.
      }
      scheduleAt(nextAttemptAt);
    };

    const scheduleStoredAttempt = () => {
      if (disposed || !navigator.onLine) return;
      try {
        const storedValue = sessionStorage.getItem(storageKey);
        const nextAttemptAt = Number(storedValue);
        if (Number.isFinite(nextAttemptAt) && nextAttemptAt > Date.now()) {
          scheduleAt(nextAttemptAt);
          return;
        }
      } catch {
        // Sem storage, uma nova tentativa imediata continua segura.
      }
      void startSync();
    };

    async function reconcile() {
      if (pathname === "/offline") {
        await waitForOfflineCatalogReady(accountScope);
      }
      let renewalCursor: string | null = null;
      try {
        renewalCursor = localStorage.getItem(renewalCursorKey);
      } catch {
        // A ordenacao deterministica ainda permite renovar o primeiro lote.
      }

      return reconcileOfflineEntitlement(accountScope, {
        ensureDeviceToken: ensureClientDeviceToken,
        getRecoverableItems: getRecoverableOfflineItems,
        renewItems: async (chapterIds) => {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(
            () => controller.abort(),
            RENEW_TIMEOUT_MS,
          );
          try {
            const response = await fetch("/api/offline/renew", {
              method: "POST",
              credentials: "same-origin",
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chapterIds }),
              signal: controller.signal,
            });
            const payload = await response.json().catch(() => ({})) as {
              items?: RenewedOfflineItem[];
            };
            if (!response.ok || !Array.isArray(payload.items)) {
              throw new Error("Nao foi possivel atualizar o acesso offline.");
            }
            return payload.items;
          } finally {
            window.clearTimeout(timeoutId);
          }
        },
        refreshAudio: (scope, item) => enqueueOfflineDownload(async () => {
          const objectUrl = await getEncryptedAudioUrl(
            item.chapterId,
            item.audioUrl,
            {
              accountScope: scope,
              mode: "offline",
              expiresAt: item.expiresAt,
              audioRevision: item.audioRevision,
            },
          );
          URL.revokeObjectURL(objectUrl);
        }),
        updateItemsBatch: updateOfflineItemsBatch,
        preparePage: prepareOfflinePage,
      }, renewalCursor);
    }

    function startSync(force = false) {
      if (disposed || !navigator.onLine) return;
      clearRetryTimer();
      try {
        const storedValue = sessionStorage.getItem(storageKey);
        if (!force && !shouldStartOfflineSync(storedValue)) {
          const nextAttemptAt = Number(storedValue);
          if (Number.isFinite(nextAttemptAt)) scheduleAt(nextAttemptAt);
          return;
        }
      } catch {
        // A sincronizacao continua mesmo sem sessionStorage.
      }

      const existing = inFlightSyncs.get(accountScope);
      if (existing) {
        void existing.finally(scheduleStoredAttempt);
        return;
      }

      const sync = reconcile()
        .then((result) => {
          if (result.failed > 0) {
            throw new Error("Nao foi possivel atualizar todos os audios offline.");
          }
          try {
            if (result.nextCursor) {
              localStorage.setItem(renewalCursorKey, result.nextCursor);
            } else {
              localStorage.removeItem(renewalCursorKey);
            }
          } catch {
            // A renovacao continua valida sem o cursor persistido.
          }
          recordOutcome("success");
        })
        .catch(() => {
          recordOutcome("failure");
        })
        .finally(() => {
          if (inFlightSyncs.get(accountScope) === sync) {
            inFlightSyncs.delete(accountScope);
          }
        });
      inFlightSyncs.set(accountScope, sync);
    }

    const handleOnline = () => startSync(true);
    window.addEventListener("online", handleOnline);
    scheduleStoredAttempt();

    return () => {
      disposed = true;
      clearRetryTimer();
      window.removeEventListener("online", handleOnline);
    };
  }, [accountScope, pathname]);

  return null;
}
