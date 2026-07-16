import test from "node:test";
import {
  markOfflineCatalogReady,
  waitForOfflineCatalogReady,
} from "./offline-catalog-readiness";

test("espera do catalogo resolve quando a primeira leitura termina", async () => {
  const waiting = waitForOfflineCatalogReady("user-ready", 100);
  markOfflineCatalogReady("user-ready");
  await waiting;
});

test("espera do catalogo possui limite quando o painel nao e montado", async () => {
  const startedAt = Date.now();
  await waitForOfflineCatalogReady("user-timeout", 10);
  if (Date.now() - startedAt > 100) {
    throw new Error("A espera do catalogo ultrapassou o limite esperado.");
  }
});
