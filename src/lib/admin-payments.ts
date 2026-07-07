import type { Prisma } from "@prisma/client";

export const CONFIRMED_PAYMENT_STATUS = "SUCCEEDED";

type CreatedAtFilter = Prisma.PaymentTransactionWhereInput["createdAt"];

export function getConfirmedPaymentWhere(createdAt?: CreatedAtFilter): Prisma.PaymentTransactionWhereInput {
  return {
    ...(createdAt ? { createdAt } : {}),
    status: CONFIRMED_PAYMENT_STATUS,
  };
}

export function getPendingPaymentWhere(createdAt?: CreatedAtFilter): Prisma.PaymentTransactionWhereInput {
  return {
    ...(createdAt ? { createdAt } : {}),
    status: { not: CONFIRMED_PAYMENT_STATUS },
  };
}
