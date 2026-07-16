import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import * as accountScope from "./account-scope";

test("normaliza escopo anonimo e separa chaves por conta", () => {
  assert.equal(accountScope.normalizeAccountScope(null), "anonymous");
  assert.equal(accountScope.normalizeAccountScope("  user-a  "), "user-a");
  assert.equal(accountScope.buildAccountStorageKey("user-a", "chapter:1"), "account:user-a:chapter:1");
  assert.notEqual(
    accountScope.buildAccountStorageKey("user-a", "chapter:1"),
    accountScope.buildAccountStorageKey("user-b", "chapter:1"),
  );
});

test("mensagem de escopo nunca transporta valor vazio", () => {
  assert.deepEqual(accountScope.buildAccountScopeMessage(""), {
    type: "SET_ACCOUNT_SCOPE",
    scope: "anonymous",
  });
});

test("troca de conta confirma escopo anonimo no service worker", async () => {
  const stored: Array<[string, string]> = [];
  const messages: unknown[] = [];
  const confirmed = await accountScope.setBrowserAccountScopeConfirmed(null, {
    storage: { setItem: (key, value) => stored.push([key, value]) },
    target: {
      postMessage(message, transfer) {
        messages.push(message);
        (transfer[0] as MessagePort).postMessage({ ok: true, scope: "anonymous" });
      },
    },
    timeoutMs: 100,
  });

  assert.equal(confirmed, true);
  assert.deepEqual(stored, [[accountScope.ACCOUNT_SCOPE_STORAGE_KEY, "anonymous"]]);
  assert.deepEqual(messages, [{ type: "SET_ACCOUNT_SCOPE", scope: "anonymous" }]);
});

test("login limpa e confirma a conta anterior antes do callback offline", () => {
  const loginForm = readFileSync(
    join(process.cwd(), "src", "components", "login-form.tsx"),
    "utf8",
  );
  const resetIndex = loginForm.indexOf("await setBrowserAccountScopeConfirmed(null)");
  const navigationIndex = loginForm.indexOf("window.location.href");

  assert.ok(resetIndex >= 0);
  assert.ok(navigationIndex > resetIndex);
  assert.match(loginForm, /accountScopeCleared \? safeCallbackUrl : "\/perfil"/);
});
