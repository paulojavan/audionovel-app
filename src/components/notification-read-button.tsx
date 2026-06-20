"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function NotificationReadButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setMessage("");
            const response = await fetch("/api/notifications/read", { method: "POST" });
            if (!response.ok) {
              setMessage("Nao foi possivel marcar como lidas.");
              return;
            }
            router.refresh();
          });
        }}
        className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Marcar todas como lidas"}
      </button>
      {message ? <p className="text-xs text-red-300">{message}</p> : null}
    </div>
  );
}
