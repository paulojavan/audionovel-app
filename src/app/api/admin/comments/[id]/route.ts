import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const moderationSchema = z.object({
  action: z.enum(["APPROVE", "REMOVE"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const parsed = moderationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Acao invalida." }, { status: 400 });

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!comment) return NextResponse.json({ error: "Comentario nao encontrado." }, { status: 404 });

  if (parsed.data.action === "REMOVE") {
    await prisma.comment.update({
      where: { id },
      data: {
        status: "REMOVED",
        removedAt: new Date(),
        moderatedByAdminId: auth.user.id,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.comment.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      removedAt: null,
      moderatedByAdminId: auth.user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
