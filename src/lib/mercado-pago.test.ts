import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyMercadoPagoWebhookSignature } from "./mercado-pago";

function signature(dataId: string, requestId: string, timestamp: number, secret: string) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const digest = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${timestamp},v1=${digest}`;
}

test("webhook falha fechado sem segredo ou cabecalhos", () => {
  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId: "1",
      requestId: "request",
      signature: "ts=1,v1=x",
      secret: undefined,
    }),
    false,
  );
  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId: "1",
      requestId: null,
      signature: null,
      secret: "secret",
    }),
    false,
  );
});

test("webhook aceita assinatura recente e rejeita timestamp antigo", () => {
  const now = 1_750_000_000_000;
  const timestamp = Math.floor(now / 1000);
  const secret = "secret";

  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId: "123",
      requestId: "request-1",
      signature: signature("123", "request-1", timestamp, secret),
      secret,
      nowMs: now,
    }),
    true,
  );
  assert.equal(
    verifyMercadoPagoWebhookSignature({
      dataId: "123",
      requestId: "request-1",
      signature: signature("123", "request-1", timestamp - 601, secret),
      secret,
      nowMs: now,
    }),
    false,
  );
});
