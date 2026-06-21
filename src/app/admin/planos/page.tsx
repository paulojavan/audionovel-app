import { AdminPlanForm } from "@/components/admin-plan-form";
import { formatPlanInterval, formatPlanPrice, paymentMethodLabels } from "@/lib/plan-utils";
import { prisma } from "@/lib/prisma";

export default async function AdminPlansPage() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { amountCents: "asc" }],
  });

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-bold">Planos de assinatura</h2>
        <p className="mt-1 text-sm text-zinc-400">Cadastre valores, periodos e metodos de pagamento aceitos no Mercado Pago.</p>
      </div>

      <div className="grid gap-3">
        <h3 className="text-lg font-black">Novo plano</h3>
        <AdminPlanForm />
      </div>

      <div className="grid gap-3">
        <h3 className="text-lg font-black">Planos cadastrados</h3>
        {plans.length ? (
          plans.map((plan) => (
            <div key={plan.id} className="grid gap-3">
              <div className="rounded-lg bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black">{plan.name}</p>
                    <p className="text-sm text-zinc-400">
                      {formatPlanPrice(plan.amountCents, plan.currency)} / {formatPlanInterval(plan.interval)} - {paymentMethodLabels(plan).join(", ")}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${plan.active ? "bg-[#18b7bd]/15 text-[#b8fbff]" : "bg-red-500/10 text-red-200"}`}>
                    {plan.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              <AdminPlanForm
                plan={{
                  id: plan.id,
                  name: plan.name,
                  description: plan.description ?? "",
                  amountCents: plan.amountCents,
                  currency: plan.currency,
                  interval: plan.interval,
                  active: plan.active,
                  allowCard: plan.allowCard,
                  allowPix: plan.allowPix,
                  sortOrder: plan.sortOrder,
                }}
              />
            </div>
          ))
        ) : (
          <p className="rounded-md bg-[#06272b] p-4 text-zinc-400">Nenhum plano cadastrado ainda.</p>
        )}
      </div>
    </section>
  );
}
