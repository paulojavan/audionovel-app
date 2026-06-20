import { createPasswordResetRequest } from "@/lib/password-reset-store";
import { parsePasswordResetRequestPayload } from "@/lib/password-reset-validation";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = enforceRateLimit({ key: `password-reset-request:${getRequestIdentifier(request)}`, limit: 5, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const parsed = parsePasswordResetRequestPayload(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const result = await createPasswordResetRequest(parsed.data.email, origin);

  return Response.json(result);
}
