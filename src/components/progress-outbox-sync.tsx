"use client";

import { useEffect } from "react";
import { flushProgressOutbox } from "@/lib/progress-outbox";

// Reenvia o progresso de escuta enfileirado enquanto o aparelho estava offline
// ou a rede falhou. Roda na montagem, ao reconectar e ao voltar para a aba.
export function ProgressOutboxSync({ accountScope }: { accountScope: string }) {
  useEffect(() => {
    function sync() {
      void flushProgressOutbox(accountScope);
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") sync();
    }

    sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [accountScope]);

  return null;
}
