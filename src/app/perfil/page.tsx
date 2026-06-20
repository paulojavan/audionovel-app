import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BillingButton } from "@/components/billing-button";
import { ProfileEditForm } from "@/components/profile-edit-form";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/subscription";
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from "@/lib/system-settings";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.isBlocked) redirect("/login?blocked=1");

  const [user, firstActivePlan, subscriptionsEnabled] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        payments: { take: 10, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.subscriptionPlan.findFirst({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { amountCents: "asc" }],
      select: { id: true, name: true },
    }),
    getSystemSettingBoolean(SYSTEM_SETTING_KEYS.subscriptionsEnabled, true),
  ]);

  if (!user) redirect("/login");
  const premium = hasPremiumAccess(user);

  return (
    <div className="px-4 py-6 md:px-8">
      <section className="mb-8 rounded-lg bg-[#06272b] p-6">
        <p className="text-sm uppercase text-zinc-400">Perfil</p>
        <h1 className="mt-1 text-4xl font-black">{user.name}</h1>
        <p className="mt-2 text-zinc-400">{user.email}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">Plano: {premium ? "Premium" : "Free"}</span>
          {!premium && subscriptionsEnabled && firstActivePlan ? <BillingButton planId={firstActivePlan.id} label={`Assinar ${firstActivePlan.name}`} /> : null}
        </div>
      </section>

      <section className="mb-8">
        <ProfileEditForm user={{ name: user.name, email: user.email }} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">Gestao financeira</h2>
        <div className="overflow-hidden rounded-md border border-white/10">
          {user.payments.length ? (
            user.payments.map((payment) => (
              <div key={payment.id} className="grid grid-cols-3 gap-3 border-b border-white/10 p-3 text-sm last:border-b-0">
                <span>{payment.description}</span>
                <span>
                  {payment.currency.toUpperCase()} {(payment.amountCents / 100).toFixed(2)}
                </span>
                <span>{payment.status}</span>
              </div>
            ))
          ) : (
            <p className="p-3 text-zinc-400">Nenhum pagamento registrado ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
