import { prisma } from "@/lib/prisma";
import { getFinanceMonthPeriod } from "@/lib/finance-period";

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const period = getFinanceMonthPeriod(month);
  const createdAt = { gte: period.start, lt: period.end };
  const [payments, stats] = await Promise.all([
    prisma.paymentTransaction.findMany({ where: { createdAt }, take: 100, orderBy: { createdAt: "desc" }, include: { user: true } }),
    getPaymentStats(period.start, period.end),
  ]);

  const totalRevenue = stats.revenueCents / 100;

  return (
    <div className="grid gap-8">
      <form className="flex flex-wrap items-end gap-3 rounded-lg bg-[#06272b] p-4" action="/admin/financeiro">
        <label className="grid gap-2 text-sm font-bold text-zinc-200">
          Mes de referencia
          <input
            type="month"
            name="month"
            defaultValue={period.month}
            className="min-h-11 rounded-md border border-white/10 bg-black px-3 py-2 text-white"
          />
        </label>
        <button type="submit" className="min-h-11 rounded-full bg-[#18b7bd] px-5 py-2 font-black text-[#021114] hover:bg-[#22d3dc]">
          Ver mes
        </button>
      </form>

      <section className="grid gap-3 sm:grid-cols-3">
        <FinanceCard label="Receita confirmada" value={`R$ ${totalRevenue.toFixed(2)}`} />
        <FinanceCard label="Pagamentos aprovados" value={stats.succeededCount.toString()} />
        <FinanceCard label="Outros status" value={stats.failedCount.toString()} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Transacoes de {formatMonth(period.month)}</h2>
        <div className="overflow-hidden rounded-md border border-white/10 bg-[#06272b]">
          {payments.length ? (
            payments.map((payment) => (
              <div key={payment.id} className="grid gap-2 border-b border-white/10 p-3 text-sm last:border-b-0 md:grid-cols-[1fr_auto_auto_auto]">
                <span>
                  <strong>{payment.user?.email ?? "Sem usuario"}</strong>
                  <span className="block text-zinc-400">{payment.description ?? payment.providerPaymentId ?? payment.providerEventId}</span>
                </span>
                <span>{payment.currency.toUpperCase()} {(payment.amountCents / 100).toFixed(2)}</span>
                <span>{payment.status}</span>
                <span className="text-zinc-400">{payment.createdAt.toLocaleDateString("pt-BR")}</span>
              </div>
            ))
          ) : (
            <p className="p-4 text-zinc-400">Nenhum pagamento registrado ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}

async function getPaymentStats(start: Date, end: Date) {
  const [row] = await prisma.$queryRaw<Array<{
    revenueCents: bigint | null;
    succeededCount: bigint;
    failedCount: bigint;
  }>>`
    SELECT
      COALESCE(SUM("amountCents") FILTER (WHERE "status" = 'SUCCEEDED'), 0) AS "revenueCents",
      COUNT(*) FILTER (WHERE "status" = 'SUCCEEDED') AS "succeededCount",
      COUNT(*) FILTER (WHERE "status" <> 'SUCCEEDED') AS "failedCount"
    FROM "PaymentTransaction"
    WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
  `;

  return {
    revenueCents: Number(row?.revenueCents ?? 0),
    succeededCount: Number(row?.succeededCount ?? 0),
    failedCount: Number(row?.failedCount ?? 0),
  };
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthIndex - 1, 1)),
  );
}

function FinanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#06272b] p-4">
      <p className="text-sm font-bold text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
