"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { OfflineLicense } from "@/lib/offline-license";
import {
  type OfflineAccessState,
  verifyOfflineLicenseForClient,
} from "@/lib/offline-access";

const ACCESS_CHECK_INTERVAL_MS = 5_000;

export function OfflinePremiumGate({
  accountScope,
  deviceId,
  sessionId,
  license,
  children,
}: {
  accountScope: string;
  deviceId?: string;
  sessionId?: string;
  license: OfflineLicense;
  children: ReactNode;
}) {
  const [accessState, setAccessState] = useState<OfflineAccessState | "checking">("checking");

  useEffect(() => {
    let active = true;
    const storageKey = `audio-novel-offline-clock:${accountScope}`;

    async function checkAccess() {
      const now = Date.now();
      const storedValue = Number(localStorage.getItem(storageKey));
      const lastObservedAt = Number.isFinite(storedValue) && storedValue > 0
        ? storedValue
        : null;
      const result = await verifyOfflineLicenseForClient({
        token: license.token,
        publicKey: license.publicKey,
        userId: accountScope,
        deviceId,
        sessionId,
        now,
        lastObservedAt,
      });

      if (!active) return;
      if (result.state === "allowed") {
        localStorage.setItem(
          storageKey,
          String(Math.max(now, lastObservedAt ?? 0)),
        );
      }
      setAccessState(result.state);
    }

    void checkAccess();
    const intervalId = window.setInterval(() => void checkAccess(), ACCESS_CHECK_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkAccess();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accountScope, deviceId, license.publicKey, license.token, sessionId]);

  if (accessState === "checking") {
    return (
      <p className="rounded-md bg-[#06272b] p-4 text-zinc-400">
        Verificando sua licenca Premium offline...
      </p>
    );
  }

  if (accessState !== "allowed") {
    const premiumExpired = accessState === "expired";
    return (
      <section className="rounded-lg bg-[#06272b] p-5">
        <h2 className="text-2xl font-black">
          {premiumExpired ? "Seu Premium venceu" : "Acesso offline precisa ser atualizado"}
        </h2>
        <p className="mt-2 max-w-2xl text-zinc-400">
          {premiumExpired
            ? "O acesso aos capitulos salvos foi bloqueado. Conecte-se a internet e renove o Premium para preparar uma nova licenca offline."
            : "Nao foi possivel validar o acesso offline. Conecte-se a internet para atualizar sua licenca sem baixar novamente os audios que ainda estiverem salvos."}
        </p>
        {accessState === "clock-rollback" ? (
          <p className="mt-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-200">
            A data do dispositivo esta anterior a ultima verificacao confiavel. Corrija a data e conecte-se novamente.
          </p>
        ) : null}
        <Link
          href={premiumExpired ? "/assinaturas" : "/offline"}
          className="mt-4 inline-flex rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc]"
        >
          {premiumExpired ? "Ver planos Premium" : "Atualizar acesso"}
        </Link>
      </section>
    );
  }

  return children;
}
