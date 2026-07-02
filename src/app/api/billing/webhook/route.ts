import { NextResponse } from "next/server";
import { applyApprovedMercadoPagoPayment } from "@/lib/billing-reconciliation";
import { getMercadoPagoPayment, verifyMercadoPagoWebhookSignature } from "@/lib/mercado-pago";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoWebhookBody = {
  action?: string;
  type?: string;
  topic?: string;
  data?: {
    id?: string | number;
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const body = parseWebhookBody(rawBody);
  const url = new URL(request.url);
  const paymentId = getPaymentId(body, url);

  if (!paymentId) {
    return NextResponse.json({ received: true, ignored: "missing-payment-id" });
  }

  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook nao configurado." }, { status: 503 });
  }

  const validSignature = verifyMercadoPagoWebhookSignature({
    dataId: paymentId,
    requestId: request.headers.get("x-request-id"),
    signature: request.headers.get("x-signature"),
    secret: webhookSecret,
  });
  if (!validSignature) return NextResponse.json({ error: "Webhook invalido." }, { status: 401 });

  const payment = await getMercadoPagoPayment(paymentId);
  const eventId = buildEventId(request.headers.get("x-request-id"), paymentId, payment.status);

  if (payment.status !== "approved") {
    await recordPaymentEvent({
      eventId,
      paymentId,
      userId: null,
      amountCents: toCents(payment.transaction_amount),
      currency: payment.currency_id ?? "brl",
      status: normalizePaymentStatus(payment.status),
      description: payment.description ?? "Pagamento Mercado Pago sem aprovacao",
    });
    return NextResponse.json({ received: true });
  }

  const result = await applyApprovedMercadoPagoPayment(payment, { eventId });
  if (result.status === "ignored") {
    await recordPaymentEvent({
      eventId,
      paymentId,
      userId: null,
      amountCents: toCents(payment.transaction_amount),
      currency: payment.currency_id ?? "brl",
      status: "APPROVED_UNLINKED",
      description: "Pagamento Mercado Pago aprovado sem referencia local",
    });
    return NextResponse.json({ received: true, ignored: "missing-reference" });
  }

  return NextResponse.json({ received: true, status: result.status });
}

function parseWebhookBody(rawBody: string): MercadoPagoWebhookBody {
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody) as MercadoPagoWebhookBody;
  } catch {
    return {};
  }
}

function getPaymentId(body: MercadoPagoWebhookBody, url: URL) {
  const queryType = url.searchParams.get("type") ?? url.searchParams.get("topic");
  const bodyType = body.type ?? body.topic;
  const type = queryType ?? bodyType;
  if (type && type !== "payment") return null;

  const id = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
  return id ? String(id) : null;
}

function buildEventId(requestId: string | null, paymentId: string, status: string | undefined) {
  return requestId ? `mp-request-${requestId}` : `mp-payment-${paymentId}-${status ?? "unknown"}`;
}

function toCents(amount: number | undefined) {
  if (!amount || !Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function normalizePaymentStatus(status: string | undefined) {
  if (!status) return "UNKNOWN";
  return status.trim().toUpperCase();
}

async function recordPaymentEvent({
  eventId,
  paymentId,
  userId,
  amountCents,
  currency,
  status,
  description,
}: {
  eventId: string;
  paymentId: string;
  userId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  description: string;
}) {
  await prisma.paymentTransaction.upsert({
    where: { providerEventId: eventId },
    create: {
      providerEventId: eventId,
      providerPaymentId: status === "SUCCEEDED" ? paymentId : null,
      userId,
      amountCents,
      currency: currency.toLowerCase(),
      status,
      description,
    },
    update: {},
  });
}
