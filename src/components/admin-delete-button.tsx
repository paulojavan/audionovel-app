"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function deleteItem() {
    setMessage("");

    startTransition(async () => {
      const response = await fetch(endpoint, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel excluir.");
        return;
      }

      setConfirmOpen(false);
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
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMessage("");
          setConfirmOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-2 text-xs font-black text-white hover:bg-red-500 disabled:opacity-60"
      >
        <Trash2 size={14} />
        {pending ? "Excluindo..." : label}
      </button>
      {message ? <span className="max-w-48 text-right text-xs text-red-300">{message}</span> : null}
      {confirmOpen ? (
        <span
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <span className="w-full max-w-md overflow-hidden rounded-lg border border-red-400/30 bg-[#061f23] text-left shadow-2xl shadow-black/50">
            <span className="flex items-start gap-3 border-b border-white/10 bg-red-500/10 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-200">
                <AlertTriangle size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-black text-white">Confirmar exclusao</span>
                <span className="mt-1 block text-sm leading-6 text-zinc-300">{confirmMessage}</span>
              </span>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Fechar confirmacao"
              >
                <X size={18} />
              </button>
            </span>
            <span className="block p-4">
              <span className="block rounded-md border border-red-400/20 bg-red-500/10 p-3 text-sm font-bold leading-6 text-red-100">
                Esta acao e definitiva e tambem remove os dados relacionados pelo banco.
              </span>
              <span className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/10 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={deleteItem}
                  className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60"
                >
                  <Trash2 size={16} />
                  {pending ? "Excluindo..." : "Excluir definitivamente"}
                </button>
              </span>
            </span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
