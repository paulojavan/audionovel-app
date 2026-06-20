"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTransition } from "react";

type BillingButtonProps = {
  planId: string;
  label?: string;
  className?: string;
};

export function BillingButton({ planId, label = "Assinar premium", className = "rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] disabled:opacity-60" }: BillingButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setMessage("");
            const response = await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ planId }),
            });
            const payload = (await response.json().catch(() => ({}))) as { url?: string; activated?: boolean; error?: string; warning?: string };

            if (payload.url) {
              window.location.href = payload.url;
              return;
            }

            if (payload.activated) {
              setMessage(payload.warning ?? "Assinatura de teste ativada.");
              router.refresh();
              return;
            }

            setMessage(payload.error ?? "Nao foi possivel iniciar a assinatura.");
          });
        }}
        className={className}
      >
        {pending ? "Abrindo pagamento..." : label}
      </button>
      {message ? <p className="max-w-md text-sm text-zinc-300">{message}</p> : null}
    </div>
  );
}
