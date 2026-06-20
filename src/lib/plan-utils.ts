export function formatPlanPrice(amountCents: number, currency = "brl") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function formatPlanInterval(interval: string) {
  if (interval === "year") return "ano";
  return "mes";
}

export function paymentMethodLabels(plan: { allowCard: boolean; allowPix: boolean }) {
  return [
    plan.allowCard ? "Cartao" : null,
    plan.allowPix ? "Pix" : null,
  ].filter(Boolean) as string[];
}
