"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
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
          : "E-mail ou senha invalidos.",
      );
    } catch {
      setError("Nao foi possivel preparar este dispositivo. Verifique a conexao e tente novamente.");
    } finally {
      if (!keepPendingForNavigation) {
        submittingRef.current = false;
        setPending(false);
      }
    }
  }

  return (
    <>
      <form onSubmit={submitLogin} aria-busy={pending} className="mt-6 grid gap-4">
        {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
        <label className="grid gap-2 text-sm font-bold text-zinc-200">
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-zinc-200">
          Senha
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="min-h-12 rounded-md border border-white/10 bg-[#020809] px-4 py-3 text-white outline-none ring-[#18b7bd]/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <Link
          href="/recuperar-senha"
          aria-disabled={pending}
          tabIndex={pending ? -1 : undefined}
          className="justify-self-end text-sm font-bold text-[#8ff7ff] hover:text-white"
        >
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

      <dialog
        ref={loadingDialogRef}
        className="fixed inset-0 z-[100] grid h-screen w-screen max-w-none place-items-center border-0 bg-transparent p-4 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-loading-title"
        aria-describedby="login-loading-description"
        onCancel={(event) => event.preventDefault()}
        tabIndex={-1}
      >
        <div
          className="grid w-full max-w-xs justify-items-center gap-5 rounded-2xl border border-white/10 bg-[#031316] p-7 text-center shadow-2xl shadow-black/60"
          role="status"
          aria-live="polite"
        >
          <div
            className="h-24 w-24 animate-spin rounded-full border-[7px] border-white/15 border-t-[#18b7bd] motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div className="grid gap-2">
            <p id="login-loading-title" className="text-xl font-black text-white">Entrando...</p>
            <p id="login-loading-description" className="text-sm text-zinc-300">
              Aguarde enquanto verificamos seus dados.
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
