# Blocking Login Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir um carregamento circular de tela inteira e impedir submissões duplicadas enquanto o login estiver aguardando preparação do dispositivo ou autenticação.

**Architecture:** O `LoginForm` continuará responsável pelo fluxo de credenciais, mas trocará `useTransition` por um estado explícito acompanhado de uma referência síncrona que fecha a janela de duplo envio antes da nova renderização. O próprio formulário renderizará um overlay modal somente durante a operação, liberando-o nas falhas e mantendo-o até a navegação nos sucessos.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4 Client Components, NextAuth 4.24.14, TypeScript, Tailwind CSS 4 e Node Test Runner via `tsx`.

## Global Constraints

- Restringir a alteração ao formulário de login existente e a um teste de regressão.
- Preservar autenticação, mensagens de erro, validação, regras de dispositivo e destino após o sucesso.
- Não adicionar dependências nem infraestrutura global de carregamento.
- Manter o overlay até `window.location.href` iniciar a navegação após um login bem-sucedido.
- Remover o overlay e liberar nova tentativa em toda falha tratada.
- Usar um overlay sem fechamento manual, com semântica acessível e indicador circular animado.

---

### Task 1: Bloqueio e overlay durante o login

**Files:**
- Create: `src/lib/login-loading-wiring.test.ts`
- Modify: `src/components/login-form.tsx`

**Interfaces:**
- Consumes: `signIn("credentials", options)`, `ensureClientDeviceToken(): Promise<string>`, `getClientDeviceName(): string` e `setBrowserAccountScopeConfirmed(null): Promise<boolean>` já usados pelo formulário.
- Produces: nenhuma API pública nova; `LoginForm` preserva as props `initialError?: string` e `callbackUrl?: string`.

- [ ] **Step 1: Escrever o teste de regressão que descreve o bloqueio completo**

Crie `src/lib/login-loading-wiring.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loginFormSource = readFileSync(
  new URL("../components/login-form.tsx", import.meta.url),
  "utf8",
);

test("login bloqueia envios duplicados durante toda a autenticacao", () => {
  assert.match(loginFormSource, /const submittingRef = useRef\(false\)/);
  assert.match(loginFormSource, /if \(submittingRef\.current\) return/);
  assert.match(
    loginFormSource,
    /submittingRef\.current = true;[\s\S]*?setPending\(true\);[\s\S]*?await ensureClientDeviceToken\(\)/,
  );
  assert.match(loginFormSource, /aria-busy=\{pending\}/);
  assert.match(loginFormSource, /disabled=\{pending\}/);
});

test("login mostra overlay circular e inacessivel a novos cliques", () => {
  assert.match(loginFormSource, /\{pending \? \([\s\S]*?fixed inset-0 z-\[100\]/);
  assert.match(loginFormSource, /role="dialog"/);
  assert.match(loginFormSource, /aria-modal="true"/);
  assert.match(loginFormSource, /role="status"/);
  assert.match(loginFormSource, /animate-spin/);
  assert.match(loginFormSource, />Entrando\.\.\.<\/p>/);
});

test("login libera nova tentativa somente quando a operacao falha", () => {
  assert.match(loginFormSource, /let keepPendingForNavigation = false/);
  assert.match(
    loginFormSource,
    /window\.location\.href = accountScopeCleared \? safeCallbackUrl : "\/perfil";[\s\S]*?keepPendingForNavigation = true;[\s\S]*?return/,
  );
  assert.match(
    loginFormSource,
    /finally \{[\s\S]*?if \(!keepPendingForNavigation\) \{[\s\S]*?submittingRef\.current = false;[\s\S]*?setPending\(false\)/,
  );
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha esperada**

Execute:

```bash
npx tsx --test src/lib/login-loading-wiring.test.ts
```

Esperado: `FAIL`, porque o formulário ainda usa `useTransition`, não possui `submittingRef` e não renderiza o overlay.

- [ ] **Step 3: Implementar a trava síncrona, o estado explícito e o overlay**

Substitua o conteúdo de `src/components/login-form.tsx` por:

```tsx
"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRef, useState, type FormEvent } from "react";
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
  const safeCallbackUrl = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";

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

      {pending ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-loading-title"
          aria-describedby="login-loading-description"
        >
          <div
            className="grid w-full max-w-xs justify-items-center gap-5 rounded-2xl border border-white/10 bg-[#031316] p-7 text-center shadow-2xl shadow-black/60"
            role="status"
            aria-live="polite"
          >
            <div
              className="h-24 w-24 animate-spin rounded-full border-[7px] border-white/15 border-t-[#18b7bd]"
              aria-hidden="true"
            />
            <div className="grid gap-2">
              <p id="login-loading-title" className="text-xl font-black text-white">Entrando...</p>
              <p id="login-loading-description" className="text-sm text-zinc-300">
                Aguarde enquanto verificamos seus dados.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Executar o teste direcionado e confirmar que ficou verde**

Execute:

```bash
npx tsx --test src/lib/login-loading-wiring.test.ts
```

Esperado: `3` testes, `3` aprovados e `0` falhas.

- [ ] **Step 5: Executar as verificações completas**

Execute:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Esperado: todos os testes aprovados, lint sem erros, build concluído, e `git diff --check` sem saída.

- [ ] **Step 6: Registrar a implementação**

Execute:

```bash
git add src/components/login-form.tsx src/lib/login-loading-wiring.test.ts
git commit -m "feat: block repeated login submissions"
```

Esperado: commit criado contendo apenas o formulário e seu teste de regressão.
