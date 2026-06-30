import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storeSource = readFileSync(
  new URL("./password-reset-store.ts", import.meta.url),
  "utf8",
);

test("pedido usa a entrega segura e bloqueia apenas configuracao ausente", () => {
  assert.match(
    storeSource,
    /getPasswordResetDeliveryConfig\(\)/,
  );
  assert.match(
    storeSource,
    /deliveryConfig\.mode === "unconfigured"/,
  );
  assert.match(
    storeSource,
    /deliverPasswordResetLinkSafely\(\{/,
  );
});

test("implementacao antiga de webhook nao permanece no armazenamento", () => {
  assert.doesNotMatch(storeSource, /process\.env\.PASSWORD_RESET_WEBHOOK_URL/);
  assert.doesNotMatch(storeSource, /async function deliverPasswordResetLink/);
});
