import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Sem assinatura." }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Webhook inválido." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    if (userId && typeof session.subscription === "string") {
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: "PREMIUM",
          subscriptionStatus: "ACTIVE",
          stripeSubscriptionId: session.subscription,
        },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    await prisma.user.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { plan: "FREE", subscriptionStatus: "CANCELED" },
    });
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
    const user = customerId
      ? await prisma.user.findUnique({ where: { stripeCustomerId: customerId } })
      : null;

    await prisma.paymentTransaction.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        stripePaymentId: invoice.id,
        userId: user?.id,
        amountCents: invoice.amount_paid ?? 0,
        currency: invoice.currency ?? "brl",
        status: "SUCCEEDED",
        description: "Pagamento de assinatura premium",
      },
      update: {},
    });
  }

  return NextResponse.json({ received: true });
}
