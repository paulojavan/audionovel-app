type CheckoutReturnParams = {
  checkout?: string | null;
  payment_id?: string | null;
  status?: string | null;
  collection_status?: string | null;
};

export function getApprovedCheckoutReturnPaymentId(params: CheckoutReturnParams) {
  const paymentId = params.payment_id?.trim();
  if (!paymentId) return null;
  if (params.checkout !== "success") return null;

  const status = params.status ?? params.collection_status;
  return status === "approved" ? paymentId : null;
}

export function getCleanCheckoutReturnPath(params: CheckoutReturnParams) {
  if (params.checkout === "pending") return "/assinaturas?checkout=pending";
  if (params.checkout === "cancel") return "/assinaturas?checkout=cancel";
  return "/assinaturas";
}
