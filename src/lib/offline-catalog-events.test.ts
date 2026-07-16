import assert from "node:assert/strict";
import test from "node:test";
import {
  notifyOfflineCatalogUpdated,
  subscribeOfflineCatalogUpdates,
} from "./offline-catalog-events";

test("atualizacao do catalogo notifica somente a conta correspondente", () => {
  let updates = 0;
  const unsubscribe = subscribeOfflineCatalogUpdates("user-1", () => {
    updates += 1;
  });

  notifyOfflineCatalogUpdated("user-2");
  notifyOfflineCatalogUpdated("user-1");
  unsubscribe();
  notifyOfflineCatalogUpdated("user-1");

  assert.equal(updates, 1);
});
