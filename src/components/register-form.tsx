"use client";

import { signIn } from "next-auth/react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { setBrowserAccountScopeConfirmed } from "@/lib/account-scope";
import { ensureClientDeviceToken, getClientDeviceName } from "@/lib/client-device";

export function RegisterForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("A confirmação de senha não confere.");
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setError("");
    let keepPendingForNavigation = false;

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Não foi possível criar a conta.");
      }

      const deviceToken = await ensureClientDeviceToken();
      const result = await signIn("credentials", {
        email,
        password,
        deviceToken,
        deviceName: getClientDeviceName(),
        redirect: false,
      });
      if (result?.ok) {
        const accountScopeCleared = await setBrowserAccountScopeConfirmed(null);
        window.location.href = accountScopeCleared ? "/" : "/perfil";
        keepPendingForNavigation = true;
        return;
      }

      setError("Conta criada, mas não foi possível entrar automaticamente. Tente fazer login.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível criar a conta.");
    } finally {
      if (!keepPendingForNavigation) {
        submittingRef.current = false;
        setPending(false);
      }
    }
  }

  const inputClassName =
    "min-h-13 w-full rounded-xl border border-white/10 bg-[#020b0d]/75 py-3 pl-11 pr-4 text-white outline-none transition placeholder:text-[#526b6f] hover:border-white/20 focus:border-[#22d3dc]/50 focus:ring-4 focus:ring-[#18b7bd]/10 disabled:cursor-not-allowed disabled:opacity-60";
  const iconClassName =
    "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5d7c80]";

  return (
    <form onSubmit={submitRegister} aria-busy={pending} className="mt-7 grid gap-4">
      {error ? (
        <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/8 p-3.5 text-sm leading-6 text-red-200">
          {error}
        </p>
      ) : null}

      <label className="grid gap-2 text-sm font-bold text-[#d6e5e7]">
        Nome de usuário
        <span className="relative">
          <UserRound size={18} aria-hidden="true" className={iconClassName} />
          <input
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Como quer ser chamado?"
            minLength={2}
            required
            disabled={pending}
            className={inputClassName}
          />
        </span>
      </label>

      <label className="grid gap-2 text-sm font-bold text-[#d6e5e7]">
        E-mail
        <span className="relative">
          <Mail size={18} aria-hidden="true" className={iconClassName} />
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
            disabled={pending}
            className={inputClassName}
          />
        </span>
      </label>

      <label className="grid gap-2 text-sm font-bold text-[#d6e5e7]">
        Senha
        <span className="relative">
          <LockKeyhole size={18} aria-hidden="true" className={iconClassName} />
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            aria-describedby="password-hint"
            minLength={8}
            required
            disabled={pending}
            className={inputClassName}
          />
        </span>
      </label>

      <label className="grid gap-2 text-sm font-bold text-[#d6e5e7]">
        Confirmar senha
        <span className="relative">
          <LockKeyhole size={18} aria-hidden="true" className={iconClassName} />
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Digite a senha novamente"
            minLength={8}
            required
            disabled={pending}
            className={inputClassName}
          />
        </span>
      </label>

      <p id="password-hint" className="text-xs leading-5 text-[#759196]">
        Use pelo menos 8 caracteres para manter sua conta protegida.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="group mt-1 inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#18b7bd] px-5 py-3 font-black text-[#021114] shadow-xl shadow-[#18b7bd]/15 transition hover:-translate-y-0.5 hover:bg-[#32d5dc] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <LoaderCircle size={19} className="animate-spin" aria-hidden="true" />
            Criando conta...
          </>
        ) : (
          <>
            Criar minha conta
            <ArrowRight size={18} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
