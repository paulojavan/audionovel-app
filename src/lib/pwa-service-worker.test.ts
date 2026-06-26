import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const serviceWorkerSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const staticAssetsBlock = serviceWorkerSource.match(/const STATIC_ASSETS = \[[\s\S]*?\];/)?.[0] ?? "";

test("service worker nao pre-cacheia o manifest dinamico do Next", () => {
  assert.doesNotMatch(staticAssetsBlock, /["']\/manifest\.webmanifest["']/);
  assert.match(serviceWorkerSource, /url\.pathname === "\/manifest\.webmanifest"/);
});

test("service worker nao intercepta chunks internos do Next", () => {
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\("\/_next\/"\)/);
  assert.doesNotMatch(serviceWorkerSource, /url\.pathname\.startsWith\("\/_next\/static\/"\)\s*return true/);
});
