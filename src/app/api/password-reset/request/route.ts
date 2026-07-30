import { createPasswordResetRequest } from "@/lib/password-reset-store";
import { parsePasswordResetRequestPayload } from "@/lib/password-reset-validation";
import { getPublicOrigin } from "@/lib/public-origin";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const parsed = parsePasswordResetRequestPayload(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const requestIdentifier = getRequestIdentifier(request) ?? `email:${parsed.data.email}`;
  const limited = await enforceRateLimit({ key: `password-reset-request:${requestIdentifier}`, limit: 5, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const origin = getPublicOrigin({
    headers: request.headers,
    envOrigin: process.env.APP_ORIGIN ?? process.env.NEXTAUTH_URL,
    fallbackOrigin: new URL(request.url).origin,
  });
  const result = await createPasswordResetRequest(parsed.data.email, origin);

  return Response.json(result);
}
