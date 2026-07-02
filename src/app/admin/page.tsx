import Link from "next/link";
import { ADMIN_DASHBOARD_PAYMENT_SELECT, ADMIN_TOP_NOVEL_SELECT } from "@/lib/page-data-select";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const [stats, topNovels, recentPayments] = await Promise.all([
    getAdminDashboardStats(),
    prisma.novel.findMany({ take: 5, orderBy: { viewCount: "desc" }, select: ADMIN_TOP_NOVEL_SELECT }),
    prisma.paymentTransaction.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: ADMIN_DASHBOARD_PAYMENT_SELECT,
    }),
  ]);

  const totalRevenue = stats.revenueCents / 100;

  return (
    <div className="grid gap-8">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Usuarios" value={stats.userCount.toString()} href="/admin/usuarios" />
        <MetricCard label="Premium" value={stats.premiumCount.toString()} href="/admin/usuarios" />
        <MetricCard label="Novels" value={stats.novelCount.toString()} href="/admin/conteudo" />
        <MetricCard label="Capitulos" value={stats.chapterCount.toString()} href="/admin/conteudo" />
        <MetricCard label="Receita" value={`R$ ${totalRevenue.toFixed(2)}`} href="/admin/financeiro" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Novels mais vistas</h2>
            <Link href="/admin/conteudo" className="text-sm font-bold text-[#18b7bd]">
              Gerenciar
            </Link>
          </div>
          <div className="grid gap-2">
            {topNovels.map((novel, index) => (
              <Link key={novel.id} href={`/novels/${novel.slug}`} className="grid grid-cols-[32px_1fr_auto] rounded-md bg-[#06272b] p-3 hover:bg-[#08353a]">
                <span className="font-black text-zinc-500">{index + 1}</span>
                <strong>{novel.title}</strong>
                <span className="text-sm text-zinc-400">{novel.viewCount} views</span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Pagamentos recentes</h2>
            <Link href="/admin/financeiro" className="text-sm font-bold text-[#18b7bd]">
              Ver todos
            </Link>
          </div>
          <div className="overflow-hidden rounded-md border border-white/10 bg-[#06272b]">
            {recentPayments.length ? (
              recentPayments.map((payment) => (
                <div key={payment.id} className="border-b border-white/10 p-3 text-sm last:border-b-0">
                  <p className="font-bold">{payment.user?.email ?? "Sem usuario"}</p>
                  <p className="mt-1 text-zinc-400">
                    {payment.currency.toUpperCase()} {(payment.amountCents / 100).toFixed(2)} - {payment.status}
                  </p>
                </div>
              ))
            ) : (
              <p className="p-4 text-zinc-400">Nenhum pagamento registrado ainda.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-[#06272b] p-4">
        <h2 className="text-2xl font-bold">Moderacao</h2>
        <p className="mt-2 text-zinc-300">{stats.commentCount} comentarios cadastrados.</p>
        <Link href="/admin/moderacao" className="mt-4 inline-flex rounded-full bg-[#18b7bd] px-4 py-2 text-sm font-black text-[#021114] hover:bg-[#22d3dc]">
          Abrir moderacao
        </Link>
      </section>
    </div>
  );
}

async function getAdminDashboardStats() {
  const [row] = await prisma.$queryRaw<Array<{
    userCount: bigint;
    premiumCount: bigint;
    novelCount: bigint;
    chapterCount: bigint;
    commentCount: bigint;
    revenueCents: bigint | null;
  }>>`
    SELECT
      (SELECT COUNT(*) FROM "User") AS "userCount",
      (SELECT COUNT(*) FROM "User" WHERE "subscriptionStatus" IN ('ACTIVE', 'TRIALING') AND "premiumUntil" > CURRENT_TIMESTAMP) AS "premiumCount",
      (SELECT COUNT(*) FROM "Novel") AS "novelCount",
      (SELECT COALESCE(SUM(CASE WHEN "positionEnd" IS NOT NULL AND "positionEnd" > "position" THEN "positionEnd" - "position" + 1 ELSE 1 END), 0) FROM "Chapter") AS "chapterCount",
      (SELECT COUNT(*) FROM "Comment") AS "commentCount",
      (SELECT COALESCE(SUM("amountCents"), 0) FROM "PaymentTransaction" WHERE "status" = 'SUCCEEDED') AS "revenueCents"
  `;

  return {
    userCount: Number(row?.userCount ?? 0),
    premiumCount: Number(row?.premiumCount ?? 0),
    novelCount: Number(row?.novelCount ?? 0),
    chapterCount: Number(row?.chapterCount ?? 0),
    commentCount: Number(row?.commentCount ?? 0),
    revenueCents: Number(row?.revenueCents ?? 0),
  };
}

function MetricCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-lg bg-[#06272b] p-4 hover:bg-[#08353a]">
      <p className="text-sm font-bold text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </Link>
  );
}
