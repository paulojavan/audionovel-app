import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { bugReportStatusSchema } from "@/lib/bug-report-validation";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const parsed = bugReportStatusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Status invalido." }, { status: 400 });

  const report = await prisma.bugReport.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json(report);
}
