import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

test("configuracao de imagens nao aceita host global", () => {
  assert.doesNotMatch(config, /hostname:\s*"\*\*"/);
  assert.match(config, /IMAGE_URL_ALLOWED_HOSTS/);
  for (const host of ["i0.wp.com", "i1.wp.com", "i2.wp.com", "i3.wp.com"]) {
    assert.match(config, new RegExp(`"${host.replaceAll(".", "\\.")}"`));
  }
});

test("respostas incluem CSP HSTS e politica de permissoes", () => {
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /Permissions-Policy/);
  assert.match(config, /frame-src 'self' https:\/\/www\.youtube-nocookie\.com/);
});
