import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
const proxy = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
const loadingFallback = readFileSync(join(process.cwd(), "public", "loading-fallback.html"), "utf8");
const offlineFallback = readFileSync(join(process.cwd(), "public", "offline-fallback.html"), "utf8");

test("configuracao de imagens nao aceita host global", () => {
  assert.doesNotMatch(config, /hostname:\s*"\*\*"/);
  assert.match(config, /IMAGE_URL_ALLOWED_HOSTS/);
  for (const host of ["i0.wp.com", "i1.wp.com", "i2.wp.com", "i3.wp.com"]) {
    assert.match(config, new RegExp(`"${host.replaceAll(".", "\\.")}"`));
  }
});

test("respostas incluem CSP HSTS e politica de permissoes", () => {
  assert.match(proxy, /Content-Security-Policy/);
  assert.match(proxy, /'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.doesNotMatch(proxy, /script-src[^;\n]*'unsafe-inline'/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /Permissions-Policy/);
  assert.match(proxy, /frame-src 'self' https:\/\/www\.youtube-nocookie\.com/);
});

test("fallbacks do PWA funcionam sem scripts inline bloqueados pelo CSP", () => {
  for (const fallback of [loadingFallback, offlineFallback]) {
    assert.doesNotMatch(fallback, /\son(?:click|error)=/i);
    assert.doesNotMatch(fallback, /<script(?!\s+src=)/i);
    assert.match(fallback, /<script src="\/pwa-fallback\.js" defer><\/script>/);
  }
  assert.match(proxy, /isPwaFallback[\s\S]*?"script-src 'self'"/);
});
