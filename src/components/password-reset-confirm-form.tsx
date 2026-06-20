"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

export function PasswordResetConfirmForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    startTransition(() => {
      setError("");
      setMessage("");

      void fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
          if (!response.ok) throw new Error(data.error ?? "Nao foi possivel redefinir a senha.");

          setMessage(data.message ?? "Senha redefinida com sucesso.");
          form.reset();
        })
        .catch((requestError: Error) => {
          setError(requestError.message);
        });
    });
  }

  if (!token) {
    return (
      <p className="mt-6 rounded-md bg-red-500/10 p-3 text-sm text-red-300">
        Link de recuperacao ausente ou invalido.{" "}
        <Link href="/recuperar-senha" className="font-bold underline">
          Solicite um novo link
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={submitReset} className="mt-6 grid gap-4">
      {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
      {message ? (
        <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {message}{" "}
          <Link href="/login" className="font-bold underline">
            Ir para login
          </Link>
        </p>
      ) : null}
      <label className="grid gap-2 text-sm font-bold text-zinc-200">
        Nova senha
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
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
          required
          className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending || Boolean(message)}
        className="min-h-12 rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Redefinir senha"}
      </button>
    </form>
  );
}
