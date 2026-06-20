"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition, type FormEvent } from "react";
import { getClientDeviceId, getClientDeviceName } from "@/lib/client-device";

export function RegisterForm() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("A confirmacao de senha nao confere.");
      return;
    }

    startTransition(() => {
      setError("");
      void fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? "Nao foi possivel criar a conta.");
          }

          return signIn("credentials", {
            email,
            password,
            deviceId: getClientDeviceId(),
            deviceName: getClientDeviceName(),
            redirect: false,
          });
        })
        .then((result) => {
          if (result?.ok) {
            window.location.href = "/";
            return;
          }

          setError("Conta criada, mas nao foi possivel entrar automaticamente. Tente fazer login.");
        })
        .catch((requestError: Error) => {
          setError(requestError.message);
        });
    });
  }

  return (
    <form onSubmit={submitRegister} className="mt-6 grid gap-4">
      {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
      <label className="grid gap-2 text-sm font-bold text-zinc-200">
        Nome de usuario
        <input
          name="name"
          type="text"
          autoComplete="name"
          minLength={2}
          required
          className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-zinc-200">
        E-mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2"
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-zinc-200">
        Senha
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
        Confirmar senha
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
        disabled={pending}
        className="min-h-12 rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Criando conta..." : "Criar conta"}
      </button>
    </form>
  );
}
