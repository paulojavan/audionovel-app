"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { setBrowserAccountScopeConfirmed } from "@/lib/account-scope";
import { ensureClientDeviceToken, getClientDeviceName } from "@/lib/client-device";

export function LoginForm({
  initialError = "",
  callbackUrl = "/",
}: {
  initialError?: string;
  callbackUrl?: string;
}) {
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);
  const loadingDialogRef = useRef<HTMLDialogElement>(null);
  const safeCallbackUrl = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";

  useEffect(() => {
    const dialog = loadingDialogRef.current;
    if (!dialog) return;

    if (pending) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [pending]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    let keepPendingForNavigation = false;

    submittingRef.current = true;
    setPending(true);
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
        const accountScopeCleared = await setBrowserAccountScopeConfirmed(null);
        window.location.href = accountScopeCleared ? safeCallbackUrl : "/perfil";
        keepPendingForNavigation = true;
        return;
      }

      setError(
        result?.error === "RATE_LIMITED"
          ? "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
          : "E-mail ou senha inválidos.",
      );
    } catch {
      setError("Não foi possível preparar este dispositivo. Verifique a conexão e tente novamente.");
    } finally {
      if (!keepPendingForNavigation) {
        submittingRef.current = false;
        setPending(false);
      }
    }
  }

  return (
    <>
      <form onSubmit={submitLogin} aria-busy={pending} className="mt-7 grid gap-5">
        {error ? (
          <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/8 p-3.5 text-sm leading-6 text-red-200">
            {error}
          </p>
        ) : null}

        <label className="grid gap-2 text-sm font-bold text-[#d6e5e7]">
          E-mail
          <span className="relative">
            <Mail
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5d7c80]"
            />
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              required
              disabled={pending}
              className="min-h-13 w-full rounded-xl border border-white/10 bg-[#020b0d]/75 py-3 pl-11 pr-4 text-white outline-none transition placeholder:text-[#526b6f] hover:border-white/20 focus:border-[#22d3dc]/50 focus:ring-4 focus:ring-[#18b7bd]/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </span>
        </label>

        <label className="grid gap-2 text-sm font-bold text-[#d6e5e7]">
          Senha
          <span className="relative">
            <LockKeyhole
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5d7c80]"
            />
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              required
              disabled={pending}
              className="min-h-13 w-full rounded-xl border border-white/10 bg-[#020b0d]/75 py-3 pl-11 pr-4 text-white outline-none transition placeholder:text-[#526b6f] hover:border-white/20 focus:border-[#22d3dc]/50 focus:ring-4 focus:ring-[#18b7bd]/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </span>
        </label>

        <Link
          href="/recuperar-senha"
          aria-disabled={pending}
          tabIndex={pending ? -1 : undefined}
          className="justify-self-end text-sm font-bold text-[#72e8ed] transition hover:text-white"
        >
          Esqueci minha senha
        </Link>

        <button
          type="submit"
          disabled={pending}
          className="group inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#18b7bd] px-5 py-3 font-black text-[#021114] shadow-xl shadow-[#18b7bd]/15 transition hover:-translate-y-0.5 hover:bg-[#32d5dc] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <LoaderCircle size={19} className="animate-spin" aria-hidden="true" />
              Entrando...
            </>
          ) : (
            <>
              Entrar
              <ArrowRight size={18} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <dialog
        ref={loadingDialogRef}
        className="fixed inset-0 z-[100] h-screen w-screen max-w-none place-items-center border-0 bg-transparent p-4 backdrop:bg-black/80 backdrop:backdrop-blur-sm open:grid"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-loading-title"
        aria-describedby="login-loading-description"
        onCancel={(event) => event.preventDefault()}
        tabIndex={-1}
      >
        <div
          className="grid w-full max-w-xs justify-items-center gap-5 rounded-3xl border border-white/10 bg-[#06171a] p-8 text-center shadow-2xl shadow-black/60"
          role="status"
          aria-live="polite"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#18b7bd]/10 text-[#55e1e7]">
            <LoaderCircle size={38} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </div>
          <div className="grid gap-2">
            <p id="login-loading-title" className="text-xl font-black text-white">Entrando...</p>
            <p id="login-loading-description" className="text-sm leading-6 text-[#9bb4b8]">
              Aguarde enquanto verificamos seus dados.
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
