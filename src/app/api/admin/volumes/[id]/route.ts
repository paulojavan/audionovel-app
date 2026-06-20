import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const volumeUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  position: z.number().int().min(1),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const parsed = volumeUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });

  try {
    const volume = await prisma.volume.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(volume);
  } catch {
    return NextResponse.json({ error: "Volume duplicado, inexistente ou dados invalidos." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;

  try {
    await prisma.volume.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel excluir o volume." }, { status: 404 });
  }
}
