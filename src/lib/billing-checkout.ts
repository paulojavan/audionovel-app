import type { MercadoPagoPreferencePayload } from "./mercado-pago";

type CheckoutPlan = {
  id: string;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  interval: string;
  allowCard: boolean;
  allowPix: boolean;
};

type CheckoutUserInput = {
  origin: string;
  userId: string;
  userEmail: string;
  userName: string;
  checkoutReference: string;
  plan: CheckoutPlan;
};

export function isPixOnlyPlan(plan: Pick<CheckoutPlan, "allowCard" | "allowPix">) {
  return plan.allowPix && !plan.allowCard;
}

export function isCardOnlyPlan(plan: Pick<CheckoutPlan, "allowCard" | "allowPix">) {
  return plan.allowCard && !plan.allowPix;
}

export function getFixedPremiumDays(plan: Pick<CheckoutPlan, "interval">) {
  return plan.interval === "year" ? 365 : 30;
}

export function buildMercadoPagoPreferencePayload({
  origin,
  userEmail,
  userName,
  checkoutReference,
  plan,
}: CheckoutUserInput): MercadoPagoPreferencePayload {
  const baseOrigin = normalizeCheckoutOrigin(origin);
  const premiumDays = String(getFixedPremiumDays(plan));
  const metadata = {
    checkout_reference: checkoutReference,
    premium_days: premiumDays,
  };

  return {
    items: [
      {
        id: plan.id,
        title: plan.name,
        description: plan.description ?? undefined,
        quantity: 1,
        unit_price: plan.amountCents / 100,
        currency_id: plan.currency.toUpperCase(),
      },
    ],
    payer: {
      email: userEmail,
      name: userName,
    },
    external_reference: checkoutReference,
    metadata,
    notification_url: `${baseOrigin}/api/billing/webhook`,
    back_urls: {
      success: `${baseOrigin}/api/billing/return?checkout=success`,
      failure: `${baseOrigin}/api/billing/return?checkout=cancel`,
      pending: `${baseOrigin}/api/billing/return?checkout=pending`,
    },
    auto_return: "approved",
    payment_methods: getPaymentMethods(plan),
  };
}

export function buildCheckoutReference(userId: string, planId: string, premiumDays: string | number) {
  return `user:${userId};plan:${planId};days:${premiumDays}`;
}

export function normalizeCheckoutOrigin(origin: string) {
  const normalized = origin.trim().replace(/\/+$/, "");
  return normalized || "http://localhost:3000";
}

export function parseCheckoutReference(reference: string | null | undefined) {
  if (!reference) return null;

  const values = Object.fromEntries(
    reference.split(";").map((part) => {
      const [key, ...rest] = part.split(":");
      return [key, rest.join(":")];
    }),
  );

  if (!values.user || !values.plan) return null;

  const premiumDays = Number.parseInt(values.days ?? "30", 10);
  return {
    userId: values.user,
    planId: values.plan,
    premiumDays: Number.isFinite(premiumDays) && premiumDays > 0 ? premiumDays : 30,
  };
}

export function getCheckoutErrorMessage(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message) : "";

  if (message.toLowerCase().includes("access token")) {
    return "Mercado Pago nao configurado. Verifique MERCADO_PAGO_ACCESS_TOKEN.";
  }

  return "Nao foi possivel iniciar o pagamento.";
}

function getPaymentMethods(plan: Pick<CheckoutPlan, "allowCard" | "allowPix">) {
  if (isPixOnlyPlan(plan)) {
    return {
      excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }, { id: "atm" }],
      installments: 1,
    };
  }

  if (isCardOnlyPlan(plan)) {
    return {
      excluded_payment_methods: [{ id: "pix" }],
      excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
      installments: 12,
    };
  }

  return {
    excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
    installments: 12,
  };
}
