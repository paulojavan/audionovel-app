import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import { parseRegisterPayload } from "@/lib/register-validation";
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from "@/lib/system-settings";

export async function POST(request: Request) {
  const limited = enforceRateLimit({ key: `register:${getRequestIdentifier(request)}`, limit: 8, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const registrationsEnabled = await getSystemSettingBoolean(SYSTEM_SETTING_KEYS.registrationsEnabled, true);
  if (!registrationsEnabled) {
    return NextResponse.json({ error: "Novos cadastros estao temporariamente desativados." }, { status: 403 });
  }

  const parsed = parseRegisterPayload(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: parsed.data.email }, { name: parsed.data.name }],
    },
    select: { email: true, name: true },
  });
  if (existingUser) {
    const error =
      existingUser.email === parsed.data.email
        ? "Ja existe uma conta cadastrada com este e-mail."
        : "Este nome de usuario ja esta em uso.";
    return NextResponse.json({ error }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
