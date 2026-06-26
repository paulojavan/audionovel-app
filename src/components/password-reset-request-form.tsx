"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

export function PasswordResetRequestForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");

    startTransition(() => {
      setError("");
      setMessage("");
      setDevResetUrl(null);

      void fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string; resetUrl?: string | null; deliveryError?: string | null };
          if (!response.ok) throw new Error(data.error ?? "Nao foi possivel solicitar a recuperacao.");

          setMessage(data.message ?? "Se existir uma conta com este e-mail, enviaremos um link de recuperacao.");
          if (data.deliveryError) setError(data.deliveryError);
          setDevResetUrl(data.resetUrl ?? null);
          if (!data.deliveryError) form.reset();
        })
        .catch((requestError: Error) => {
          setError(requestError.message);
        });
    });
  }

  return (
    <form onSubmit={submitRequest} className="mt-6 grid gap-4">
      {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p> : null}
      {devResetUrl ? (
        <p className="rounded-md border border-[#18b7bd]/30 bg-[#18b7bd]/10 p-3 text-sm text-[#8ff7ff]">
          Link de teste local:{" "}
          <Link href={devResetUrl} className="font-bold underline">
            redefinir senha
          </Link>
        </p>
      ) : null}
      <label className="grid gap-2 text-sm font-bold text-zinc-200">
        E-mail da conta
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Enviar link de recuperacao"}
      </button>
    </form>
  );
}
