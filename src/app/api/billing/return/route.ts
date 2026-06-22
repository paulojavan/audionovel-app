import { NextResponse } from "next/server";
import { applyApprovedMercadoPagoPayment } from "@/lib/billing-reconciliation";
import { getApprovedCheckoutReturnPaymentId, getCleanCheckoutReturnPath } from "@/lib/billing-return";
import { getMercadoPagoPayment } from "@/lib/mercado-pago";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const session = await getActiveServerSession();
  const paymentId = getApprovedCheckoutReturnPaymentId(params);

  if (paymentId && session?.user?.id) {
    try {
      const payment = await getMercadoPagoPayment(paymentId);
      await applyApprovedMercadoPagoPayment(payment, {
        expectedUserId: session.user.id,
        eventId: `mp-return-${paymentId}`,
      });
    } catch (error) {
      console.error("Nao foi possivel reconciliar retorno do Mercado Pago.", error);
    }
  }

  return NextResponse.redirect(new URL(getCleanCheckoutReturnPath(params), url.origin));
}
