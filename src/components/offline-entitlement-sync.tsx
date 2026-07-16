"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  getRecoverableOfflineItems,
  updateOfflineItemsBatch,
} from "@/lib/audio-cache";
import { ensureClientDeviceToken } from "@/lib/client-device";
import { waitForOfflineCatalogReady } from "@/lib/offline-catalog-readiness";
import {
  reconcileOfflineEntitlement,
  type RenewedOfflineItem,
} from "@/lib/offline-entitlement-sync";
import {
  getOfflineSyncNextAttemptAt,
  shouldStartOfflineSync,
} from "@/lib/offline-sync-policy";
import { prepareOfflinePage } from "@/lib/pwa-offline";

const RENEW_TIMEOUT_MS = 15_000;
const inFlightSyncs = new Map<string, Promise<unknown>>();

export function OfflineEntitlementSync({ accountScope }: { accountScope: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!navigator.onLine) return;
    const storageKey = `audio-novel-offline-sync:${accountScope}`;
    const renewalCursorKey = `audio-novel-offline-renew-cursor:${accountScope}`;
    try {
      if (!shouldStartOfflineSync(sessionStorage.getItem(storageKey))) return;
    } catch {
      // A sincronizacao continua mesmo sem sessionStorage.
    }

    const existing = inFlightSyncs.get(accountScope);
    if (existing) return;
    const sync = (async () => {
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
        updateItemsBatch: updateOfflineItemsBatch,
        preparePage: prepareOfflinePage,
      }, renewalCursor);
    })()
      .then((result) => {
        try {
          sessionStorage.setItem(
            storageKey,
            String(getOfflineSyncNextAttemptAt("success")),
          );
          if (result.nextCursor) {
            localStorage.setItem(renewalCursorKey, result.nextCursor);
          } else {
            localStorage.removeItem(renewalCursorKey);
          }
        } catch {
          // O resultado continua valido sem o marcador de intervalo.
        }
      })
      .catch(() => {
        try {
          sessionStorage.setItem(
            storageKey,
            String(getOfflineSyncNextAttemptAt("failure")),
          );
        } catch {
          // Uma falha de storage nao deve repetir a sincronizacao atual.
        }
      })
      .finally(() => inFlightSyncs.delete(accountScope));
    inFlightSyncs.set(accountScope, sync);
  }, [accountScope, pathname]);

  return null;
}
