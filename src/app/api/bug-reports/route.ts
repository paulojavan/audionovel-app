import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { bugReportSchema } from "@/lib/bug-report-validation";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const limited = enforceRateLimit({ key: `bug-report:${auth.user.id}`, limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  const parsed = bugReportSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Reporte invalido." }, { status: 400 });
  }

  const report = await prisma.bugReport.create({
    data: {
      userId: auth.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      pageUrl: parsed.data.pageUrl || null,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
