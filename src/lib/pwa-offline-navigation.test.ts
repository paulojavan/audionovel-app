import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "components", "pwa-offline-navigation.tsx"),
  "utf8",
);
const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

test("links cobertos usam navegacao de documento somente quando offline", () => {
  assert.match(source, /document\.addEventListener\("click", handleOfflineClick, true\)/);
  assert.match(source, /if \(navigator\.onLine\) return/);
  assert.match(source, /event\.button !== 0/);
  assert.match(source, /event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey/);
  assert.match(source, /anchor\.hasAttribute\("download"\)/);
  assert.match(source, /window\.location\.assign\(url\.href\)/);
  assert.match(layout, /<PwaOfflineNavigation \/>/);
});

test("allowlist cliente corresponde as paginas aprovadas", () => {
  assert.match(source, /pathname === "\/"/);
  assert.match(source, /pathname === "\/novels"/);
  assert.match(source, /pathname\.startsWith\("\/novels\/"\)/);
  assert.match(source, /pathname\.startsWith\("\/chapters\/"\)/);
  assert.match(source, /pathname === "\/biblioteca"/);
});
