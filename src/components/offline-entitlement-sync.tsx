"use client";

import { useEffect } from "react";
import {
  extendOfflineAudioExpiry,
  getRecoverableOfflineItems,
  saveOfflineItem,
} from "@/lib/audio-cache";
import { ensureClientDeviceToken } from "@/lib/client-device";
import {
  reconcileOfflineEntitlement,
  type RenewedOfflineItem,
} from "@/lib/offline-entitlement-sync";
import { prepareOfflinePage } from "@/lib/pwa-offline";

const SYNC_INTERVAL_MS = 5 * 60_000;
const inFlightSyncs = new Map<string, Promise<unknown>>();

export function OfflineEntitlementSync({ accountScope }: { accountScope: string }) {
  useEffect(() => {
    if (!navigator.onLine) return;
    const storageKey = `audio-novel-offline-sync:${accountScope}`;
    try {
      const lastSync = Number(sessionStorage.getItem(storageKey));
      if (Number.isFinite(lastSync) && Date.now() - lastSync < SYNC_INTERVAL_MS) {
        return;
      }
    } catch {
      // A sincronizacao continua mesmo sem sessionStorage.
    }

    const existing = inFlightSyncs.get(accountScope);
    if (existing) return;
    const sync = reconcileOfflineEntitlement(accountScope, {
      ensureDeviceToken: ensureClientDeviceToken,
      getRecoverableItems: getRecoverableOfflineItems,
      renewItems: async (chapterIds) => {
        const response = await fetch("/api/offline/renew", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterIds }),
        });
        const payload = await response.json().catch(() => ({})) as {
          items?: RenewedOfflineItem[];
        };
        if (!response.ok || !Array.isArray(payload.items)) {
          throw new Error("Nao foi possivel atualizar o acesso offline.");
        }
        return payload.items;
      },
      extendAudioExpiry: extendOfflineAudioExpiry,
      saveItem: saveOfflineItem,
      preparePage: prepareOfflinePage,
    })
      .then(() => {
        try {
          sessionStorage.setItem(storageKey, String(Date.now()));
        } catch {
          // O resultado continua valido sem o marcador de intervalo.
        }
      })
      .catch(() => undefined)
      .finally(() => inFlightSyncs.delete(accountScope));
    inFlightSyncs.set(accountScope, sync);
  }, [accountScope]);

  return null;
}
