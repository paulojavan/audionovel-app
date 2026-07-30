import { confirmPasswordReset } from "@/lib/password-reset-store";
import { parsePasswordResetConfirmPayload } from "@/lib/password-reset-validation";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const parsed = parsePasswordResetConfirmPayload(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const requestIdentifier = getRequestIdentifier(request) ?? `token:${parsed.data.token}`;
  const limited = await enforceRateLimit({ key: `password-reset-confirm:${requestIdentifier}`, limit: 10, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const result = await confirmPasswordReset(parsed.data.token, parsed.data.password);
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ message: result.message });
}
