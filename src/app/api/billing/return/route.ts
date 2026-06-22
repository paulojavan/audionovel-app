import { NextResponse } from "next/server";
import { applyApprovedMercadoPagoPayment } from "@/lib/billing-reconciliation";
import { getCheckoutReturnPaymentId, getCleanCheckoutReturnPath, isApprovedCheckoutReturn } from "@/lib/billing-return";
import { getMercadoPagoPayment } from "@/lib/mercado-pago";
import { getPublicOrigin } from "@/lib/public-origin";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const session = await getActiveServerSession();
  const paymentId = getCheckoutReturnPaymentId(params);
  let paymentApplied = false;

  if (paymentId && session?.user?.id) {
    try {
      const payment = await getMercadoPagoPayment(paymentId);
      const result = await applyApprovedMercadoPagoPayment(payment, {
        expectedUserId: session.user.id,
        eventId: `mp-return-${paymentId}`,
      });
      paymentApplied = result.status === "applied" || result.status === "duplicate";
    } catch (error) {
      console.error("Nao foi possivel reconciliar retorno do Mercado Pago.", error);
    }
  }

  const origin = getPublicOrigin({
    headers: request.headers,
    envOrigin: process.env.NEXTAUTH_URL,
    fallbackOrigin: url.origin,
  });

  const returnPath = paymentApplied || isApprovedCheckoutReturn(params) ? "/assinaturas?checkout=success" : getCleanCheckoutReturnPath(params);
  return NextResponse.redirect(new URL(returnPath, origin));
}
