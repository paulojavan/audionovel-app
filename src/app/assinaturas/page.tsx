import Link from "next/link";
import { Check } from "lucide-react";
import { BillingButton } from "@/components/billing-button";
import { applyApprovedMercadoPagoPayment } from "@/lib/billing-reconciliation";
import { getApprovedCheckoutReturnPaymentId } from "@/lib/billing-return";
import { getMercadoPagoPayment } from "@/lib/mercado-pago";
import { formatPlanInterval, formatPlanPrice, paymentMethodLabels } from "@/lib/plan-utils";
import { prisma } from "@/lib/prisma";
import { getActiveServerSession } from "@/lib/safe-auth-session";
import { hasPremiumAccess } from "@/lib/subscription";
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from "@/lib/system-settings";

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; premium?: string; payment_id?: string; status?: string; collection_status?: string }>;
}) {
  const [params, session, subscriptionsEnabled] = await Promise.all([
    searchParams,
    getActiveServerSession(),
    getSystemSettingBoolean(SYSTEM_SETTING_KEYS.subscriptionsEnabled, true),
  ]);
  const { checkout, premium } = params;
  const returnPaymentId = getApprovedCheckoutReturnPaymentId(params);
  if (returnPaymentId && session?.user?.id) {
    await reconcileCheckoutReturnPayment(returnPaymentId, session.user.id);
  }

  const [user, plans] = await Promise.all([
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: { role: true, plan: true, subscriptionStatus: true, premiumUntil: true, isBlocked: true },
        })
      : Promise.resolve(null),
    prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { amountCents: "asc" }],
    }),
  ]);
  const isPremium = hasPremiumAccess(user);

  return (
    <div className="px-4 py-6 md:px-8">
      <section className="mb-8 max-w-3xl">
        <p className="text-sm font-bold uppercase text-[#18b7bd]">Assinaturas</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">Escolha seu plano</h1>
        <p className="mt-3 text-zinc-300">
          Libere capitulos premium, mantenha seu historico sincronizado e ouca com recursos offline protegidos.
        </p>
      </section>

      {premium === "required" ? (
        <StatusMessage tone="warning">Este capitulo faz parte do plano Premium.</StatusMessage>
      ) : null}
      {!subscriptionsEnabled ? <StatusMessage tone="warning">Compras de assinaturas estao temporariamente desativadas.</StatusMessage> : null}
      {checkout === "success" ? <StatusMessage tone="success">Pagamento aprovado. Sua assinatura sera liberada em instantes.</StatusMessage> : null}
      {checkout === "pending" ? <StatusMessage tone="warning">Pagamento pendente. Assim que o Mercado Pago aprovar, o premium sera liberado.</StatusMessage> : null}
      {checkout === "cancel" ? <StatusMessage tone="warning">Pagamento cancelado. Nenhuma cobranca foi feita.</StatusMessage> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanCard title="Free" price="R$ 0" current={!isPremium} features={["Capitulos gratuitos", "Comentarios", "Favoritos", "Historico de leitura"]}>
          {!session?.user?.id ? (
            <Link className="rounded-full border border-white/10 px-5 py-3 text-center font-black text-white hover:bg-white/10" href="/login">
              Entrar para usar
            </Link>
          ) : (
            <span className="rounded-full border border-white/10 px-5 py-3 text-center font-black text-zinc-400">Plano atual</span>
          )}
        </PlanCard>

        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            title={plan.name}
            price={`${formatPlanPrice(plan.amountCents, plan.currency)} / ${formatPlanInterval(plan.interval)}`}
            highlight
            current={isPremium}
            features={[
              plan.description ?? "Acesso premium aos capitulos",
              "Modo offline protegido",
              "Player karaoke",
              `Pagamento: ${paymentMethodLabels(plan).join(", ")}`,
            ]}
          >
            {!session?.user?.id ? (
              <Link className="rounded-full bg-[#18b7bd] px-5 py-3 text-center font-black text-[#021114]" href="/login">
                Entrar para assinar
              </Link>
            ) : isPremium ? (
              <span className="rounded-full bg-[#18b7bd]/20 px-5 py-3 text-center font-black text-[#b8fbff]">Premium ativo</span>
            ) : !subscriptionsEnabled ? (
              <span className="rounded-full bg-white/10 px-5 py-3 text-center font-black text-zinc-400">Compras indisponiveis</span>
            ) : (
              <BillingButton planId={plan.id} label={`Contratar ${plan.name}`} />
            )}
          </PlanCard>
        ))}
      </div>

      {!plans.length ? <p className="mt-4 rounded-md bg-[#06272b] p-4 text-zinc-400">Nenhum plano premium ativo no momento.</p> : null}

      <section className="mt-8 rounded-lg bg-[#06272b] p-5 text-sm text-zinc-300">
        <h2 className="text-lg font-bold text-white">Pagamento</h2>
        <p className="mt-2">
          Em producao, o pagamento e processado pelo Mercado Pago. No ambiente local de desenvolvimento, se o Mercado Pago nao estiver disponivel, o sistema ativa uma assinatura de teste para permitir validar o fluxo.
        </p>
      </section>
    </div>
  );
}

async function reconcileCheckoutReturnPayment(paymentId: string, userId: string) {
  try {
    const payment = await getMercadoPagoPayment(paymentId);
    await applyApprovedMercadoPagoPayment(payment, {
      expectedUserId: userId,
      eventId: `mp-return-${paymentId}`,
    });
  } catch (error) {
    console.error("Nao foi possivel reconciliar retorno do Mercado Pago.", error);
  }
}

function PlanCard({
  title,
  price,
  features,
  children,
  highlight = false,
  current = false,
}: {
  title: string;
  price: string;
  features: string[];
  children: React.ReactNode;
  highlight?: boolean;
  current?: boolean;
}) {
  return (
    <section className={`rounded-lg border p-5 ${highlight ? "border-[#18b7bd]/50 bg-[#18b7bd]/10" : "border-white/10 bg-[#06272b]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-2 text-3xl font-black">{price}</p>
        </div>
        {current ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase text-[#b8fbff]">Atual</span> : null}
      </div>
      <ul className="mt-5 grid gap-3 text-sm text-zinc-300">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <Check size={16} className="text-[#18b7bd]" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StatusMessage({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" }) {
  return (
    <div className={`mb-4 rounded-md p-4 text-sm font-bold ${tone === "success" ? "bg-[#18b7bd]/15 text-[#b8fbff]" : "bg-yellow-500/10 text-yellow-200"}`}>
      {children}
    </div>
  );
}
