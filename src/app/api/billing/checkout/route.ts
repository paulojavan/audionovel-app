import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from "@/lib/system-settings";

const checkoutSchema = z.object({
  planId: z.string().min(1),
});

const allowDevBilling = process.env.ALLOW_DEV_BILLING === "true";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const limited = enforceRateLimit({ key: `checkout:${auth.user.id}`, limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const subscriptionsEnabled = await getSystemSettingBoolean(SYSTEM_SETTING_KEYS.subscriptionsEnabled, true);
  if (!subscriptionsEnabled) {
    return NextResponse.json({ error: "Compras de assinaturas estao temporariamente desativadas." }, { status: 403 });
  }

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Plano invalido." }, { status: 400 });

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id: parsed.data.planId, active: true },
  });

  if (!plan) return NextResponse.json({ error: "Plano nao encontrado ou inativo." }, { status: 404 });

  if (!stripe) {
    if (allowDevBilling) {
      await activateDevSubscription(auth.user.id, plan);
      return NextResponse.json({ activated: true });
    }

    return NextResponse.json({ error: "Stripe nao configurado." }, { status: 503 });
  }

  const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  let customerId = auth.user.stripeCustomerId;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.user.email,
        name: auth.user.name,
        metadata: { userId: auth.user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: auth.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: getPaymentMethodTypes(plan),
      line_items: [getLineItem(plan)],
      success_url: `${origin}/assinaturas?checkout=success`,
      cancel_url: `${origin}/assinaturas?checkout=cancel`,
      metadata: { userId: auth.user.id, planId: plan.id },
      subscription_data: { metadata: { userId: auth.user.id, planId: plan.id } },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (allowDevBilling) {
      await activateDevSubscription(auth.user.id, plan);
      return NextResponse.json({
        activated: true,
        warning: "Stripe indisponivel no ambiente local; assinatura de teste ativada.",
      });
    }

    console.error(error);
    return NextResponse.json({ error: "Nao foi possivel iniciar o pagamento." }, { status: 502 });
  }
}

function getPaymentMethodTypes(plan: { allowCard: boolean; allowPix: boolean }) {
  const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [];
  if (plan.allowCard) paymentMethodTypes.push("card");
  if (plan.allowPix) paymentMethodTypes.push("pix");
  return paymentMethodTypes;
}

function getLineItem(plan: {
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  interval: string;
  stripePriceId: string | null;
}) {
  if (plan.stripePriceId) {
    return { price: plan.stripePriceId, quantity: 1 };
  }

  return {
    quantity: 1,
    price_data: {
      currency: plan.currency,
      unit_amount: plan.amountCents,
      product_data: {
        name: plan.name,
        description: plan.description ?? undefined,
      },
      recurring: {
        interval: plan.interval === "year" ? "year" : "month",
      },
    },
  } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
}

async function activateDevSubscription(userId: string, plan: { id: string; name: string; interval: string; amountCents: number; currency: string }) {
  const premiumUntil = new Date();
  premiumUntil.setDate(premiumUntil.getDate() + (plan.interval === "year" ? 365 : 30));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { plan: "PREMIUM", subscriptionStatus: "ACTIVE", premiumUntil },
    }),
    prisma.paymentTransaction.create({
      data: {
        userId,
        stripeEventId: `dev-subscription-${plan.id}-${userId}-${Date.now()}`,
        amountCents: plan.amountCents,
        currency: plan.currency,
        status: "TEST",
        description: `Assinatura ${plan.name} ativada para teste local`,
      },
    }),
  ]);
}
