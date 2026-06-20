import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const userAdminUpdateSchema = z.object({
  isBlocked: z.boolean().optional(),
  adminNotes: z.string().max(4000).optional(),
  premiumUntil: z.string().nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const parsed = userAdminUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });

  const data: {
    isBlocked?: boolean;
    blockedReason?: string | null;
    blockedAt?: Date | null;
    adminNotes?: string | null;
    plan?: string;
    subscriptionStatus?: string;
    premiumUntil?: Date | null;
  } = {};

  if (typeof parsed.data.isBlocked === "boolean") {
    if (id === auth.user.id && parsed.data.isBlocked) {
      return NextResponse.json({ error: "Voce nao pode bloquear sua propria conta." }, { status: 400 });
    }

    data.isBlocked = parsed.data.isBlocked;
    data.blockedReason = parsed.data.isBlocked ? "Bloqueio manual pelo administrador" : null;
    data.blockedAt = parsed.data.isBlocked ? new Date() : null;
  }

  if (typeof parsed.data.adminNotes === "string") {
    data.adminNotes = parsed.data.adminNotes.trim() || null;
  }

  let manualPremiumUntil: Date | null | undefined;
  if (parsed.data.premiumUntil !== undefined) {
    if (parsed.data.premiumUntil === null || parsed.data.premiumUntil === "") {
      data.plan = "FREE";
      data.subscriptionStatus = "NONE";
      data.premiumUntil = null;
      manualPremiumUntil = null;
    } else {
      const date = new Date(`${parsed.data.premiumUntil}T23:59:59.999`);
      if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Data premium invalida." }, { status: 400 });

      data.plan = "PREMIUM";
      data.subscriptionStatus = "ACTIVE";
      data.premiumUntil = date;
      manualPremiumUntil = date;
    }
  }

  if (!Object.keys(data).length) return NextResponse.json({ error: "Nenhuma alteracao enviada." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data });

    if (manualPremiumUntil) {
      await tx.manualSubscription.create({
        data: {
          userId: id,
          adminUserId: auth.user.id,
          plan: "PREMIUM",
          premiumUntil: manualPremiumUntil,
          reason: "Alteracao manual na pagina de estatisticas do usuario",
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
