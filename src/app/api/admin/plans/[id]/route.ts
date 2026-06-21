import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { subscriptionPlanSchema } from "@/lib/plan-validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const parsed = subscriptionPlanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Plano invalido." }, { status: 400 });

  const plan = await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      ...parsed.data,
      description: parsed.data.description || null,
    },
  });

  return NextResponse.json(plan);
}
