import { permanentRedirect } from "next/navigation";

export default function SubscriptionTypoRedirectPage() {
  permanentRedirect("/assinaturas");
}
