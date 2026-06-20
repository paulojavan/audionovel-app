"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type AdminUserDetailActionsProps = {
  userId: string;
  isBlocked: boolean;
  adminNotes: string;
  premiumUntil: string;
};

export function AdminUserDetailActions({ userId, isBlocked, adminNotes, premiumUntil }: AdminUserDetailActionsProps) {
  return (
    <div className="grid gap-4">
      <BlockToggle userId={userId} isBlocked={isBlocked} />
      <PremiumForm userId={userId} premiumUntil={premiumUntil} />
      <NotesForm userId={userId} adminNotes={adminNotes} />
    </div>
  );
}

function BlockToggle({ userId, isBlocked }: { userId: string; isBlocked: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-lg bg-[#06272b] p-4">
      <h2 className="text-xl font-bold">Conta</h2>
      <p className="mt-1 text-sm text-zinc-400">{isBlocked ? "Usuario bloqueado no momento." : "Usuario ativo no momento."}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setMessage("");
            const response = await fetch(`/api/admin/users/${userId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isBlocked: !isBlocked }),
            });
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
              setMessage(payload.error ?? "Nao foi possivel atualizar a conta.");
              return;
            }
            router.refresh();
          });
        }}
        className={`mt-4 rounded-full px-5 py-3 font-black disabled:opacity-60 ${isBlocked ? "bg-[#18b7bd] text-[#021114]" : "bg-red-500 text-white"}`}
      >
        {pending ? "Salvando..." : isBlocked ? "Desbloquear usuario" : "Bloquear usuario"}
      </button>
      {message ? <p className="mt-2 text-sm text-red-300">{message}</p> : null}
    </section>
  );
}

function PremiumForm({ userId, premiumUntil }: { userId: string; premiumUntil: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("premiumUntil") ?? "");
    await savePremium(date || null);
  }

  function savePremium(date: string | null) {
    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premiumUntil: date }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel atualizar o premium.");
        return;
      }
      setMessage(date ? "Premium atualizado." : "Premium removido.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg bg-[#06272b] p-4">
      <h2 className="text-xl font-bold">Premium manual</h2>
      <p className="mt-1 text-sm text-zinc-400">Defina ou altere a data final do Premium deste usuario.</p>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <input
          name="premiumUntil"
          type="date"
          defaultValue={premiumUntil}
          className="rounded-md border border-white/10 bg-black px-4 py-3 outline-none focus:border-[#18b7bd]"
        />
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] disabled:opacity-60">
            {pending ? "Salvando..." : "Salvar Premium"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => savePremium(null)}
            className="rounded-full border border-white/10 px-5 py-3 font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
          >
            Remover Premium
          </button>
        </div>
      </form>
      {message ? <p className="mt-2 text-sm text-zinc-300">{message}</p> : null}
    </section>
  );
}

function NotesForm({ userId, adminNotes }: { userId: string; adminNotes: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-lg bg-[#06272b] p-4">
      <h2 className="text-xl font-bold">Observacao interna</h2>
      <p className="mt-1 text-sm text-zinc-400">Visivel apenas para administradores.</p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            setMessage("");
            const response = await fetch(`/api/admin/users/${userId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ adminNotes: form.get("adminNotes") }),
            });
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) {
              setMessage(payload.error ?? "Nao foi possivel salvar a observacao.");
              return;
            }
            setMessage("Observacao salva.");
            router.refresh();
          });
        }}
      >
        <textarea
          name="adminNotes"
          defaultValue={adminNotes}
          rows={6}
          maxLength={4000}
          className="resize-y rounded-md border border-white/10 bg-black px-4 py-3 outline-none focus:border-[#18b7bd]"
          placeholder="Anotacoes internas sobre o usuario..."
        />
        <button disabled={pending} className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc] disabled:opacity-60">
          {pending ? "Salvando..." : "Salvar observacao"}
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-zinc-300">{message}</p> : null}
    </section>
  );
}
