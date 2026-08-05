import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const renewRoute = readFileSync(join(process.cwd(), "src", "app", "api", "offline", "renew", "route.ts"), "utf8");
const audioRoute = readFileSync(join(process.cwd(), "src", "app", "api", "chapters", "[id]", "audio", "route.ts"), "utf8");

test("renovacao offline serializa atualizacoes em uma unica transacao", () => {
  assert.match(renewRoute, /prisma\.\$transaction\(/);
  assert.match(renewRoute, /prisma\.offlineDownload\.update\(/);
  assert.doesNotMatch(renewRoute, /prisma\.offlineDownload\.upsert\(/);
  // Promise.all com ate 100 escritas concorrentes ocupava todo o pool (P2037).
  assert.doesNotMatch(renewRoute, /Promise\.all\(/);
});

test("audio offline atualiza lastUsedAt no maximo uma vez por janela", () => {
  assert.match(audioRoute, /LAST_USED_WRITE_THROTTLE_MS/);
  assert.match(audioRoute, /select: \{ id: true, lastUsedAt: true \}/);
  assert.match(audioRoute, /Date\.now\(\) - offlineDownload\.lastUsedAt\.getTime\(\) > LAST_USED_WRITE_THROTTLE_MS/);
});
