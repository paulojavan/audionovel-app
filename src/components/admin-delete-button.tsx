"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AdminDeleteButtonProps = {
  endpoint: string;
  label: string;
  confirmMessage: string;
  redirectTo?: string;
};

export function AdminDeleteButton({ endpoint, label, confirmMessage, redirectTo }: AdminDeleteButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function deleteItem() {
    setMessage("");
    if (!window.confirm(confirmMessage)) return;

    startTransition(async () => {
      const response = await fetch(endpoint, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel excluir.");
        return;
      }

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      router.refresh();
    });
  }

  return (
    <span className="inline-grid justify-items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={deleteItem}
        className="inline-flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-2 text-xs font-black text-white hover:bg-red-500 disabled:opacity-60"
      >
        <Trash2 size={14} />
        {pending ? "Excluindo..." : label}
      </button>
      {message ? <span className="max-w-48 text-right text-xs text-red-300">{message}</span> : null}
    </span>
  );
}
