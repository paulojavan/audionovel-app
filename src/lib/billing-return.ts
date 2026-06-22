type CheckoutReturnParams = {
  checkout?: string | null;
  collection_id?: string | null;
  payment_id?: string | null;
  status?: string | null;
  collection_status?: string | null;
};

export function getApprovedCheckoutReturnPaymentId(params: CheckoutReturnParams) {
  if (!isApprovedCheckoutReturn(params)) return null;
  return getCheckoutReturnPaymentId(params);
}

export function getCheckoutReturnPaymentId(params: CheckoutReturnParams) {
  const paymentId = params.payment_id?.trim();
  const collectionId = params.collection_id?.trim();
  const id = paymentId || collectionId;
  if (!id) return null;
  if (params.checkout !== "success" && params.checkout !== "pending") return null;
  return id;
}

export function isApprovedCheckoutReturn(params: CheckoutReturnParams) {
  if (params.checkout !== "success") return false;

  const status = params.status ?? params.collection_status;
  return status === "approved";
}

export function getCleanCheckoutReturnPath(params: CheckoutReturnParams) {
  if (params.checkout === "pending") return "/assinaturas?checkout=pending";
  if (params.checkout === "cancel") return "/assinaturas?checkout=cancel";
  return "/assinaturas";
}
