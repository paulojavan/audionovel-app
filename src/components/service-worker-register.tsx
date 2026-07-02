"use client";

import { useEffect } from "react";
import { buildAccountScopeMessage, normalizeAccountScope, setBrowserAccountScope } from "@/lib/account-scope";

export function ServiceWorkerRegister({ accountScope }: { accountScope?: string | null }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    const normalizedScope = normalizeAccountScope(accountScope);

    async function registerSW() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        setBrowserAccountScope(normalizedScope);
        (registration.active ?? registration.waiting ?? registration.installing)?.postMessage(
          buildAccountScopeMessage(normalizedScope),
        );

        // Força checagem imediata de atualização
        registration.update().catch(() => undefined);

        // SW aguardando para ativar (atualização pendente ao carregar)
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent("pwa-update-available"));
        }

        // Listener para novas atualizações durante a sessão
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          let dispatched = false;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && !dispatched) {
              dispatched = true;
              // Só avisa de update se já há um SW controlando a página
              if (navigator.serviceWorker.controller) {
                window.dispatchEvent(new CustomEvent("pwa-update-available"));
              }
            }
          });
        });
      } catch {
        // Falha silenciosa - PWA continua funcional como app web
      }
    }

    registerSW();

    // Recarrega a página quando o SW ativo muda (após skipWaiting)
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [accountScope]);

  return null;
}
