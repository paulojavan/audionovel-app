import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { normalizeRenewalChapterIds } from "./offline-renewal";

const routeSource = readFileSync(
  join(process.cwd(), "src", "app", "api", "offline", "renew", "route.ts"),
  "utf8",
);

test("normaliza ids unicos e limita renovacao a cem capitulos", () => {
  assert.deepEqual(normalizeRenewalChapterIds([" a ", "a", "b", null]), ["a", "b"]);
  assert.throws(
    () => normalizeRenewalChapterIds(Array.from({ length: 101 }, (_, index) => `chapter-${index}`)),
    /100 capitulos/,
  );
});

test("rejeita corpo de renovacao que nao seja uma lista", () => {
  assert.throws(() => normalizeRenewalChapterIds("chapter-1"), /Capitulos invalidos/);
});

test("rota em lote exige autenticacao premium e renova somente audio publicado", () => {
  assert.match(routeSource, /requireUser\(\)/);
  assert.match(routeSource, /hasPremiumAccess\(auth\.user\)/);
  assert.match(routeSource, /contentType:\s*"AUDIO"/);
  assert.match(routeSource, /published:\s*true/);
  assert.match(routeSource, /getOfflineLicenseExpiry/);
  assert.match(routeSource, /offlineDownload\.upsert/);
});
