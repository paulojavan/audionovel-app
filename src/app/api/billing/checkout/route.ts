import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { buildMercadoPagoPreferencePayload, getCheckoutErrorMessage, getFixedPremiumDays } from "@/lib/billing-checkout";
import { createMercadoPagoPreference, isMercadoPagoConfigured } from "@/lib/mercado-pago";
import { prisma } from "@/lib/prisma";
import { getPublicOrigin } from "@/lib/public-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from "@/lib/system-settings";

const checkoutSchema = z.object({
  planId: z.string().min(1),
});

const allowDevBilling = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_BILLING === "true";

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

  if (!isMercadoPagoConfigured()) {
    if (allowDevBilling) {
      await activateDevSubscription(auth.user.id, plan);
      return NextResponse.json({ activated: true });
    }

    return NextResponse.json({ error: "Mercado Pago nao configurado." }, { status: 503 });
  }

  const origin = getPublicOrigin({
    headers: request.headers,
    envOrigin: process.env.NEXTAUTH_URL,
    fallbackOrigin: request.url,
  });

  try {
    const premiumDays = getFixedPremiumDays(plan);
    const expiresAt = new Date(Date.now() + 60 * 60_000);
    const checkoutIntent = await prisma.billingCheckoutIntent.create({
      data: {
        userId: auth.user.id,
        planId: plan.id,
        premiumDays,
        expiresAt,
      },
    });

    const preferencePayload = buildMercadoPagoPreferencePayload({
      origin,
      userId: auth.user.id,
      userEmail: auth.user.email,
      userName: auth.user.name,
      checkoutReference: checkoutIntent.id,
      plan,
    });

    console.info("Mercado Pago checkout origin", {
      origin,
      notificationUrl: preferencePayload.notification_url,
      backUrls: preferencePayload.back_urls,
    });

    const preference = await createMercadoPagoPreference(preferencePayload, {
      idempotencyKey: `checkout-${auth.user.id}-${plan.id}-${Date.now()}`,
    });

    const url = preference.init_point ?? preference.sandbox_init_point;
    if (!url) return NextResponse.json({ error: "Mercado Pago nao retornou URL de pagamento." }, { status: 502 });

    return NextResponse.json({ url });
  } catch (error) {
    if (allowDevBilling) {
      await activateDevSubscription(auth.user.id, plan);
      return NextResponse.json({
        activated: true,
        warning: "Mercado Pago indisponivel no ambiente local; assinatura de teste ativada.",
      });
    }

    console.error(error);
    return NextResponse.json({ error: getCheckoutErrorMessage(error) }, { status: 502 });
  }
}

async function activateDevSubscription(userId: string, plan: { id: string; name: string; interval: string; premiumDays: number; amountCents: number; currency: string }) {
  const premiumUntil = new Date();
  premiumUntil.setDate(premiumUntil.getDate() + getFixedPremiumDays(plan));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { plan: "PREMIUM", subscriptionStatus: "ACTIVE", premiumUntil },
    }),
    prisma.paymentTransaction.create({
      data: {
        userId,
        providerEventId: `dev-subscription-${plan.id}-${userId}-${Date.now()}`,
        amountCents: plan.amountCents,
        currency: plan.currency,
        status: "TEST",
        description: `Assinatura ${plan.name} ativada para teste local`,
      },
    }),
  ]);
}
