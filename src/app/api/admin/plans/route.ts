import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { subscriptionPlanSchema } from "@/lib/plan-validation";
import { slugify } from "@/lib/slug";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const parsed = subscriptionPlanSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Plano invalido." }, { status: 400 });

  const plan = await prisma.subscriptionPlan.create({
    data: {
      ...parsed.data,
      slug: await uniquePlanSlug(parsed.data.name),
      description: parsed.data.description || null,
      stripePriceId: parsed.data.stripePriceId || null,
    },
  });

  return NextResponse.json(plan);
}

async function uniquePlanSlug(name: string) {
  const baseSlug = slugify(name, { fallback: "plano" });
  const existing = await prisma.subscriptionPlan.findUnique({ where: { slug: baseSlug }, select: { id: true } });
  if (!existing) return baseSlug;
  return `${baseSlug}-${Date.now()}`;
}
