import { Prisma } from "@prisma/client";
import { calculateFixedPremiumUntil } from "./billing";
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
  checkoutIntentId: string;
  usedAt: Date | null;
  expiresAt: Date;
};

export function resolveApprovedPaymentReference(
  payment: Pick<MercadoPagoPaymentResponse, "id" | "status" | "external_reference">,
  expectedUserId?: string,
): ApprovedPaymentReference | null {
  void payment;
  void expectedUserId;
  return null;
}

export function resolvePaymentEventUserId(
  payment: Pick<MercadoPagoPaymentResponse, "external_reference">,
  checkoutIntent: Pick<ApprovedPaymentReference, "checkoutIntentId" | "userId"> | { id: string; userId: string } | null,
) {
  const checkoutIntentId = payment.external_reference?.trim();
  if (!checkoutIntentId || !checkoutIntent) return null;

  const intentId = "checkoutIntentId" in checkoutIntent ? checkoutIntent.checkoutIntentId : checkoutIntent.id;
  return intentId === checkoutIntentId ? checkoutIntent.userId : null;
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
      const now = new Date();
      const user = await tx.user.findUnique({
        where: { id: reference.userId },
        select: { premiumUntil: true },
      });
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: reference.planId },
        select: { name: true, amountCents: true, currency: true },
      });
      if (!user || !plan) return { status: "missing-target" as const, userId: reference.userId };
      if (!validateCheckoutPayment(payment, reference, plan, now, options.expectedUserId)) {
        return { status: "ignored" as const };
      }

      const claimed = await tx.billingCheckoutIntent.updateMany({
        where: {
          id: reference.checkoutIntentId,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return { status: "duplicate" as const, userId: reference.userId };

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
          amountCents: toCents(payment.transaction_amount),
          currency: payment.currency_id!.toLowerCase(),
          status: "SUCCEEDED",
          description: `Mercado Pago - ${plan.name} (${reference.premiumDays} dias)`,
        },
        update: {},
      });

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
      usedAt: true,
      expiresAt: true,
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
    usedAt: checkoutIntent.usedAt,
    expiresAt: checkoutIntent.expiresAt,
  };
}

export function validateCheckoutPayment(
  payment: Pick<MercadoPagoPaymentResponse, "status" | "transaction_amount" | "currency_id">,
  intent: Pick<ApprovedPaymentReference, "userId" | "usedAt" | "expiresAt">,
  plan: { amountCents: number; currency: string },
  now = new Date(),
  expectedUserId?: string,
) {
  if (payment.status !== "approved") return false;
  if (intent.usedAt || intent.expiresAt.getTime() <= now.getTime()) return false;
  if (expectedUserId && intent.userId !== expectedUserId) return false;
  if (toCents(payment.transaction_amount) !== plan.amountCents) return false;
  return payment.currency_id?.toLowerCase() === plan.currency.toLowerCase();
}

function toCents(amount: number | undefined) {
  if (!amount || !Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}
