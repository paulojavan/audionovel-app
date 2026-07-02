import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { updateSystemSettings } from "@/lib/system-settings";

const settingsSchema = z.object({
  registrationsEnabled: z.boolean(),
  subscriptionsEnabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Configuracoes invalidas." }, { status: 400 });

  await updateSystemSettings(parsed.data);

  return NextResponse.json({ ok: true });
}
