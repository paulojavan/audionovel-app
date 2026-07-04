import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const layoutSource = readFileSync("src/app/layout.tsx", "utf8");
const homeSource = readFileSync("src/app/page.tsx", "utf8");

test("layout define o dominio publico como metadataBase", () => {
  assert.match(
    layoutSource,
    /metadataBase:\s*new URL\("https:\/\/audionovelbr\.com\.br"\)/,
  );
});

test("home define canonical relativo ao metadataBase", () => {
  assert.match(homeSource, /export const metadata:\s*Metadata\s*=/);
  assert.match(
    homeSource,
    /alternates:\s*\{\s*canonical:\s*"\/",?\s*\}/,
  );
});

test("layout nao canonicaliza todas as rotas para a home", () => {
  assert.doesNotMatch(layoutSource, /canonical\s*:/);
});
