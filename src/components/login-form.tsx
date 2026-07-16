"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, useTransition, type FormEvent } from "react";
import { ensureClientDeviceToken, getClientDeviceName } from "@/lib/client-device";

export function LoginForm({
  initialError = "",
  callbackUrl = "/",
}: {
  initialError?: string;
  callbackUrl?: string;
}) {
  const [error, setError] = useState(initialError);
  const [pending, startTransition] = useTransition();
  const safeCallbackUrl = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      setError("");
      try {
        const deviceToken = await ensureClientDeviceToken();
        const result = await signIn("credentials", {
          email,
          password,
          deviceToken,
          deviceName: getClientDeviceName(),
          redirect: false,
        });
        if (result?.ok) {
          window.location.href = safeCallbackUrl;
          return;
        }

        setError(
          result?.error === "RATE_LIMITED"
            ? "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
            : "E-mail ou senha invalidos.",
        );
      } catch {
        setError("Nao foi possivel preparar este dispositivo. Verifique a conexao e tente novamente.");
      }
    });
  }

  return (
    <form onSubmit={submitLogin} className="mt-6 grid gap-4">
      {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
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
          autoComplete="current-password"
          required
          className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2"
        />
      </label>
      <Link href="/recuperar-senha" className="justify-self-end text-sm font-bold text-[#8ff7ff] hover:text-white">
        Esqueci minha senha
      </Link>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
