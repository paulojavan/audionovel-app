import { Prisma } from "@prisma/client";
import { calculateFixedPremiumUntil } from "./billing";
import { parseCheckoutReference } from "./billing-checkout";
import type { MercadoPagoPaymentResponse } from "./mercado-pago";
import { prisma } from "./prisma";

type ApplyPaymentOptions = {
  eventId?: string;
  expectedUserId?: string;
};

export type ApprovedPaymentReference = {
  paymentId: string;
  userId: string;
  planId: string;
  premiumDays: number;
  checkoutIntentId?: string;
};

export function resolveApprovedPaymentReference(
  payment: Pick<MercadoPagoPaymentResponse, "id" | "status" | "external_reference">,
  expectedUserId?: string,
): ApprovedPaymentReference | null {
  if (payment.status !== "approved") return null;

  const reference = parseCheckoutReference(payment.external_reference);
  if (!reference) return null;
  if (expectedUserId && reference.userId !== expectedUserId) return null;

  return {
    paymentId: String(payment.id),
    ...reference,
  };
}

export async function applyApprovedMercadoPagoPayment(payment: MercadoPagoPaymentResponse, options: ApplyPaymentOptions = {}) {
  const reference = await resolvePaymentReference(payment, options.expectedUserId);
  if (!reference) return { status: "ignored" as const };

  const existingPayment = await prisma.paymentTransaction.findFirst({
    where: { providerPaymentId: reference.paymentId, status: "SUCCEEDED" },
    select: { id: true },
  });
  if (existingPayment) return { status: "duplicate" as const, userId: reference.userId };

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: reference.userId },
        select: { premiumUntil: true },
      });
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: reference.planId },
        select: { name: true, amountCents: true, currency: true },
      });
      if (!user || !plan) return { status: "missing-target" as const, userId: reference.userId };

      await tx.user.update({
        where: { id: reference.userId },
        data: {
          plan: "PREMIUM",
          subscriptionStatus: "ACTIVE",
          premiumUntil: calculateFixedPremiumUntil(user.premiumUntil, reference.premiumDays),
        },
      });

      await tx.paymentTransaction.upsert({
        where: { providerEventId: options.eventId ?? `mp-payment-${reference.paymentId}-approved` },
        create: {
          providerEventId: options.eventId ?? `mp-payment-${reference.paymentId}-approved`,
          providerPaymentId: reference.paymentId,
          userId: reference.userId,
          amountCents: toCents(payment.transaction_amount) || plan.amountCents,
          currency: (payment.currency_id ?? plan.currency).toLowerCase(),
          status: "SUCCEEDED",
          description: `Mercado Pago - ${plan.name} (${reference.premiumDays} dias)`,
        },
        update: {},
      });

      if (reference.checkoutIntentId) {
        await tx.billingCheckoutIntent.update({
          where: { id: reference.checkoutIntentId },
          data: { usedAt: new Date() },
        });
      }

      return { status: "applied" as const, userId: reference.userId };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "duplicate" as const, userId: reference.userId };
    }
    throw error;
  }
}

async function resolvePaymentReference(payment: MercadoPagoPaymentResponse, expectedUserId?: string) {
  const legacyReference = resolveApprovedPaymentReference(payment, expectedUserId);
  if (legacyReference) return legacyReference;
  if (payment.status !== "approved") return null;

  const checkoutIntentId = payment.external_reference?.trim();
  if (!checkoutIntentId) return null;

  const checkoutIntent = await prisma.billingCheckoutIntent.findUnique({
    where: { id: checkoutIntentId },
    select: {
      id: true,
      userId: true,
      planId: true,
      premiumDays: true,
    },
  });
  if (!checkoutIntent) return null;
  if (expectedUserId && checkoutIntent.userId !== expectedUserId) return null;

  return {
    paymentId: String(payment.id),
    userId: checkoutIntent.userId,
    planId: checkoutIntent.planId,
    premiumDays: checkoutIntent.premiumDays,
    checkoutIntentId: checkoutIntent.id,
  };
}

function toCents(amount: number | undefined) {
  if (!amount || !Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}
