import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminUserDetailActions } from "@/components/admin-user-detail-actions";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/subscription";

export default async function AdminUserStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      favorites: {
        orderBy: { createdAt: "desc" },
        include: { novel: true },
      },
      listeningProgress: {
        orderBy: { updatedAt: "desc" },
        include: { chapter: { include: { volume: { include: { novel: true } } } } },
      },
      comments: {
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          novel: { select: { title: true, slug: true } },
          chapter: { select: { id: true, title: true, volume: { select: { novel: { select: { title: true, slug: true } } } } } },
        },
      },
      payments: { orderBy: { createdAt: "desc" } },
      manualSubscriptionLogs: { orderBy: { createdAt: "desc" } },
      _count: { select: { comments: true, favorites: true, listeningProgress: true } },
    },
  });

  if (!user) notFound();

  const followedNovels = new Map<string, { title: string; slug: string; source: string; updatedAt: Date }>();
  for (const favorite of user.favorites) {
    followedNovels.set(favorite.novelId, {
      title: favorite.novel.title,
      slug: favorite.novel.slug,
      source: "Favorito",
      updatedAt: favorite.createdAt,
    });
  }
  for (const progress of user.listeningProgress) {
    const novel = progress.chapter.volume.novel;
    const current = followedNovels.get(novel.id);
    if (!current || progress.updatedAt > current.updatedAt) {
      followedNovels.set(novel.id, {
        title: novel.title,
        slug: novel.slug,
        source: current ? `${current.source} + historico` : "Historico",
        updatedAt: progress.updatedAt,
      });
    }
  }

  const premiumPurchases = user.payments.filter((payment) => payment.status === "SUCCEEDED" && payment.amountCents > 0).length;
  const manualPremiumCount = user.manualSubscriptionLogs.length;
  const totalPaid = user.payments
    .filter((payment) => payment.status === "SUCCEEDED")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const premiumUntilValue = user.premiumUntil ? user.premiumUntil.toISOString().slice(0, 10) : "";
  const premium = hasPremiumAccess(user);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/usuarios" className="text-sm font-bold text-[#18b7bd]">
            Voltar para usuarios
          </Link>
          <h2 className="mt-2 text-3xl font-black">{user.name}</h2>
          <p className="text-zinc-400">{user.email}</p>
        </div>
        <span className={`rounded-full px-4 py-2 text-sm font-black ${user.isBlocked ? "bg-red-500/20 text-red-200" : "bg-[#18b7bd]/20 text-[#b8fbff]"}`}>
          {user.isBlocked ? "Bloqueado" : "Ativo"}
        </span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Plano" value={premium ? "Premium" : "Free"} />
        <MetricCard label="Compras premium" value={premiumPurchases.toString()} />
        <MetricCard label="Premium manual" value={manualPremiumCount.toString()} />
        <MetricCard label="Total pago" value={`R$ ${(totalPaid / 100).toFixed(2)}`} />
        <MetricCard label="Comentarios" value={user._count.comments.toString()} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-6">
          <section className="rounded-lg bg-[#06272b] p-4">
            <h3 className="text-xl font-bold">Novels acompanhadas</h3>
            <div className="mt-3 grid gap-2">
              {[...followedNovels.values()].length ? (
                [...followedNovels.values()].map((novel) => (
                  <Link key={novel.slug} href={`/novels/${novel.slug}`} className="rounded-md bg-black/40 p-3 hover:bg-white/10">
                    <strong>{novel.title}</strong>
                    <span className="block text-sm text-zinc-400">
                      {novel.source} - atualizado em {novel.updatedAt.toLocaleDateString("pt-BR")}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-zinc-400">Nenhuma novel acompanhada ainda.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg bg-[#06272b] p-4">
            <h3 className="text-xl font-bold">Historico de mensagens</h3>
            <div className="mt-3 grid gap-2">
              {user.comments.length ? (
                user.comments.map((comment) => {
                  const href = comment.novel ? `/novels/${comment.novel.slug}` : comment.chapter ? `/chapters/${comment.chapter.id}` : "#";
                  const label = comment.novel?.title ?? comment.chapter?.volume.novel.title ?? "Sem alvo";

                  return (
                    <Link key={comment.id} href={href} className="rounded-md bg-black/40 p-3 hover:bg-white/10">
                      <span className="text-sm font-bold text-[#18b7bd]">{label}</span>
                      {comment.chapter ? <span className="block text-xs text-zinc-500">Capitulo: {comment.chapter.title}</span> : null}
                      <p className="mt-2 text-zinc-300">{comment.body}</p>
                      <span className="mt-2 block text-xs text-zinc-500">{comment.createdAt.toLocaleString("pt-BR")}</span>
                    </Link>
                  );
                })
              ) : (
                <p className="text-zinc-400">Nenhuma mensagem enviada ainda.</p>
              )}
            </div>
          </section>
        </div>

        <AdminUserDetailActions
          userId={user.id}
          isBlocked={user.isBlocked}
          adminNotes={user.adminNotes ?? ""}
          premiumUntil={premiumUntilValue}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#06272b] p-4">
      <p className="text-sm font-bold text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
