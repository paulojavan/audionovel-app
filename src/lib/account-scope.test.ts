import assert from "node:assert/strict";
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
