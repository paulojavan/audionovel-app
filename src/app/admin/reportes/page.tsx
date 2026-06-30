import { AdminBugReportStatusForm } from "@/components/admin-bug-report-status-form";
import { ADMIN_BUG_REPORT_SELECT } from "@/lib/page-data-select";
import { prisma } from "@/lib/prisma";

const statusLabels: Record<string, string> = {
  OPEN: "Aberto",
  IN_REVIEW: "Em analise",
  RESOLVED: "Resolvido",
};

export default async function AdminBugReportsPage() {
  const reports = await prisma.bugReport.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: ADMIN_BUG_REPORT_SELECT,
  });

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-bold">Reportes de bug</h2>
        <p className="mt-1 text-sm text-zinc-400">Acompanhe os problemas enviados pelos usuarios.</p>
      </div>

      <div className="grid gap-3">
        {reports.length ? (
          reports.map((report) => (
            <article key={report.id} className="grid gap-3 rounded-lg bg-[#06272b] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black">{report.title}</h3>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-zinc-200">{statusLabels[report.status] ?? report.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    {report.user?.name ?? "Usuario removido"} - {report.user?.email ?? "sem email"} - {report.createdAt.toLocaleString("pt-BR")}
                  </p>
                  {report.pageUrl ? <p className="mt-1 break-all text-xs text-[#b8fbff]">{report.pageUrl}</p> : null}
                </div>
                <AdminBugReportStatusForm reportId={report.id} status={report.status} />
              </div>
              <p className="whitespace-pre-wrap rounded-md bg-black/25 p-3 text-sm text-zinc-200">{report.description}</p>
            </article>
          ))
        ) : (
          <p className="rounded-md bg-[#06272b] p-4 text-zinc-400">Nenhum reporte enviado ainda.</p>
        )}
      </div>
    </section>
  );
}
