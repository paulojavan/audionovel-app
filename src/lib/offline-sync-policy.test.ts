import assert from "node:assert/strict";
import test from "node:test";
import {
  getOfflineSyncNextAttemptAt,
  shouldStartOfflineSync,
} from "./offline-sync-policy";

const NOW = 1_000_000;

test("sincronizacao bem-sucedida aguarda cinco minutos", () => {
  assert.equal(getOfflineSyncNextAttemptAt("success", NOW), NOW + 300_000);
});

test("sincronizacao com falha aguarda sessenta segundos", () => {
  assert.equal(getOfflineSyncNextAttemptAt("failure", NOW), NOW + 60_000);
});

test("sincronizacao inicia somente depois do proximo instante permitido", () => {
  assert.equal(shouldStartOfflineSync(String(NOW + 1), NOW), false);
  assert.equal(shouldStartOfflineSync(String(NOW), NOW), true);
  assert.equal(shouldStartOfflineSync(null, NOW), true);
});
