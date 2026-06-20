"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type ProfileEditFormProps = {
  user: {
    name: string;
    email: string;
  };
};

export function ProfileEditForm({ user }: ProfileEditFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, startTransition] = useTransition();

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setSuccess("");
      setError("A confirmacao de senha nao confere.");
      return;
    }

    startTransition(() => {
      setError("");
      setSuccess("");
      void fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password, confirmPassword }),
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          if (!response.ok) throw new Error(body?.error ?? "Nao foi possivel atualizar o perfil.");

          form.reset();
          setSuccess("Perfil atualizado com sucesso.");
          router.refresh();
        })
        .catch((requestError: Error) => {
          setError(requestError.message);
        });
    });
  }

  return (
    <form onSubmit={submitProfile} className="grid gap-4 rounded-lg border border-white/10 bg-[#06272b] p-5">
      <div>
        <h2 className="text-2xl font-black">Editar perfil</h2>
        <p className="mt-1 text-sm text-zinc-400">O e-mail nao pode ser alterado.</p>
      </div>

      {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
      {success ? <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</p> : null}

      <label className="grid gap-2 text-sm font-bold text-zinc-200">
        E-mail
        <input
          type="email"
          value={user.email}
          disabled
          className="min-h-12 rounded-md border border-white/10 bg-black/30 px-4 py-3 text-zinc-400"
        />
      </label>

      <label className="grid gap-2 text-sm font-bold text-zinc-200">
        Nome de usuario
        <input
          name="name"
          type="text"
          autoComplete="name"
          minLength={2}
          defaultValue={user.name}
          required
          className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-zinc-200">
          Nova senha
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-zinc-200">
          Confirmar nova senha
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Salvar alteracoes"}
      </button>
    </form>
  );
}
