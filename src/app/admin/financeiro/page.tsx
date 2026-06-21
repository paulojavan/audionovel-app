import { prisma } from "@/lib/prisma";

export default async function AdminFinancePage() {
  const [payments, stats] = await Promise.all([
    prisma.paymentTransaction.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { user: true } }),
    getPaymentStats(),
  ]);

  const totalRevenue = stats.revenueCents / 100;

  return (
    <div className="grid gap-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <FinanceCard label="Receita confirmada" value={`R$ ${totalRevenue.toFixed(2)}`} />
        <FinanceCard label="Pagamentos aprovados" value={stats.succeededCount.toString()} />
        <FinanceCard label="Outros status" value={stats.failedCount.toString()} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Transacoes</h2>
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

async function getPaymentStats() {
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
  `;

  return {
    revenueCents: Number(row?.revenueCents ?? 0),
    succeededCount: Number(row?.succeededCount ?? 0),
    failedCount: Number(row?.failedCount ?? 0),
  };
}

function FinanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#06272b] p-4">
      <p className="text-sm font-bold text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
