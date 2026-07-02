import { createHmac, timingSafeEqual } from "node:crypto";

const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";

type MercadoPagoRequestOptions = {
  idempotencyKey?: string;
};

export type MercadoPagoPreferencePayload = {
  items: Array<{
    id: string;
    title: string;
    description?: string;
    quantity: number;
    unit_price: number;
    currency_id: string;
  }>;
  payer?: {
    name?: string;
    email?: string;
  };
  external_reference: string;
  metadata: Record<string, string>;
  notification_url: string;
  back_urls: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return?: "approved";
  payment_methods?: {
    excluded_payment_methods?: Array<{ id: string }>;
    excluded_payment_types?: Array<{ id: string }>;
    installments?: number;
  };
};

export type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  payer?: {
    id?: string | number;
    email?: string;
  };
};

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

export async function createMercadoPagoPreference(payload: MercadoPagoPreferencePayload, options: MercadoPagoRequestOptions = {}) {
  return mercadoPagoFetch<MercadoPagoPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(payload),
    idempotencyKey: options.idempotencyKey,
  });
}

export async function getMercadoPagoPayment(paymentId: string) {
  return mercadoPagoFetch<MercadoPagoPaymentResponse>(`/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
  });
}

export function verifyMercadoPagoWebhookSignature({
  dataId,
  requestId,
  signature,
  secret,
  nowMs = Date.now(),
}: {
  dataId: string;
  requestId: string | null;
  signature: string | null;
  secret: string | undefined;
  nowMs?: number;
}) {
  if (!secret) return false;
  if (!requestId || !signature) return false;

  const signatureParts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const timestamp = signatureParts.ts;
  const expected = signatureParts.v1;
  if (!timestamp || !expected) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestampSeconds) > 300) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const calculated = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqual(calculated, expected);
}

async function mercadoPagoFetch<T>(path: string, init: RequestInit & { idempotencyKey?: string }) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Mercado Pago nao configurado.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  if (init.idempotencyKey) headers.set("X-Idempotency-Key", init.idempotencyKey);

  const response = await fetch(`${MERCADO_PAGO_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = getMercadoPagoErrorMessage(payload) ?? `Mercado Pago respondeu com status ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

function getMercadoPagoErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  if ("message" in payload && typeof payload.message === "string") return payload.message;
  if ("error" in payload && typeof payload.error === "string") return payload.error;
  return null;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
