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

test("login mostra modal nativo bloqueante durante a autenticacao", () => {
  assert.match(loginFormSource, /const loadingDialogRef = useRef<HTMLDialogElement>\(null\)/);
  assert.match(loginFormSource, /useEffect\(\(\) => \{[\s\S]*?dialog\.showModal\(\)/);
  assert.match(loginFormSource, /<dialog[\s\S]*?ref=\{loadingDialogRef\}/);
  assert.match(loginFormSource, /onCancel=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(loginFormSource, /fixed inset-0 z-\[100\]/);
  assert.match(loginFormSource, /aria-modal="true"/);
  assert.match(loginFormSource, /role="status"/);
  assert.match(loginFormSource, /animate-spin/);
  assert.match(loginFormSource, /motion-reduce:animate-none/);
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
