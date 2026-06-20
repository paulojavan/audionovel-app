import { prisma } from "@/lib/prisma";

export default async function AdminFinancePage() {
  const [payments, revenue, succeededCount, failedCount] = await Promise.all([
    prisma.paymentTransaction.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { user: true } }),
    prisma.paymentTransaction.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true } }),
    prisma.paymentTransaction.count({ where: { status: "SUCCEEDED" } }),
    prisma.paymentTransaction.count({ where: { NOT: { status: "SUCCEEDED" } } }),
  ]);

  const totalRevenue = (revenue._sum.amountCents ?? 0) / 100;

  return (
    <div className="grid gap-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <FinanceCard label="Receita confirmada" value={`R$ ${totalRevenue.toFixed(2)}`} />
        <FinanceCard label="Pagamentos aprovados" value={succeededCount.toString()} />
        <FinanceCard label="Outros status" value={failedCount.toString()} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Transações</h2>
        <div className="overflow-hidden rounded-md border border-white/10 bg-[#06272b]">
          {payments.length ? (
            payments.map((payment) => (
              <div key={payment.id} className="grid gap-2 border-b border-white/10 p-3 text-sm last:border-b-0 md:grid-cols-[1fr_auto_auto_auto]">
                <span>
                  <strong>{payment.user?.email ?? "Sem usuário"}</strong>
                  <span className="block text-zinc-400">{payment.description ?? payment.stripePaymentId ?? payment.stripeEventId}</span>
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

function FinanceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#06272b] p-4">
      <p className="text-sm font-bold text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
