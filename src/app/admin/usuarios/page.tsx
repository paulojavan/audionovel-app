import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  ADMIN_USERS_PAGE_SIZE,
  buildAdminUsersPageHref,
  normalizeAdminUsersPage,
} from "@/lib/admin-user-pagination";
import { prisma } from "@/lib/prisma";
import { getSubscriptionDisplayState } from "@/lib/subscription";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const query = q?.trim();
  const currentPage = normalizeAdminUsersPage(page);
  const where = query
    ? {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
          { role: { contains: query } },
          { plan: { contains: query } },
          { subscriptionStatus: { contains: query } },
        ],
      }
    : undefined;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (currentPage - 1) * ADMIN_USERS_PAGE_SIZE,
      take: ADMIN_USERS_PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        subscriptionStatus: true,
        premiumUntil: true,
        isBlocked: true,
        blockedAt: true,
        createdAt: true,
        _count: { select: { comments: true, favorites: true, listeningProgress: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">Usuários</h2>
        <p className="mt-1 text-sm text-zinc-400">Pesquise por nome, email, perfil, plano ou status.</p>
      </div>
      <form className="flex flex-col gap-2 rounded-lg bg-[#06272b] p-3 sm:flex-row" action="/admin/usuarios">
        <label className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Pesquisar usuários"
            className="w-full rounded-md border border-white/10 bg-black py-3 pl-10 pr-4 outline-none focus:border-[#18b7bd]"
          />
        </label>
        <button className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc]" type="submit">
          Pesquisar
        </button>
        {query ? (
          <Link href="/admin/usuarios" className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 font-bold hover:bg-white/10">
            <X size={16} />
            Limpar
          </Link>
        ) : null}
      </form>
      <div className="overflow-x-auto rounded-md border border-white/10 bg-[#06272b]">
        {users.length ? (
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-white/10 text-zinc-400">
              <tr>
                <th className="px-3 py-3">Nome</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Perfil</th>
                <th className="px-3 py-3">Plano</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Conta</th>
                <th className="px-3 py-3">Histórico</th>
                <th className="px-3 py-3">Criado em</th>
                <th className="px-3 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const subscriptionDisplay = getSubscriptionDisplayState(user);

                return (
                  <tr key={user.id} className="border-b border-white/10 last:border-b-0">
                    <td className="px-3 py-3 font-bold">{user.name}</td>
                    <td className="px-3 py-3 text-zinc-300">{user.email}</td>
                    <td className="px-3 py-3">{user.role}</td>
                    <td className="px-3 py-3">{subscriptionDisplay.planLabel}</td>
                    <td className="px-3 py-3">
                      {subscriptionDisplay.statusLabel}
                      {user.premiumUntil ? <span className="block text-xs text-zinc-500">Até {user.premiumUntil.toLocaleDateString("pt-BR")}</span> : null}
                    </td>
                    <td className="px-3 py-3">
                      {user.isBlocked ? <span className="font-bold text-red-400">Bloqueado</span> : <span className="font-bold text-[#18b7bd]">Ativo</span>}
                      {user.blockedAt ? <span className="block text-xs text-zinc-500">{user.blockedAt.toLocaleDateString("pt-BR")}</span> : null}
                    </td>
                    <td className="px-3 py-3 text-zinc-400">
                      {user._count.listeningProgress} ouvidos • {user._count.favorites} favoritos • {user._count.comments} comentários
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{user.createdAt.toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/usuarios/${user.id}`} className="rounded-full bg-[#18b7bd] px-3 py-2 text-xs font-black text-[#021114] hover:bg-[#22d3dc]">
                        Ver estatisticas
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-zinc-400">{query ? `Nenhum usuário encontrado para "${query}".` : "Nenhum usuário cadastrado."}</p>
        )}
      </div>
      <nav className="flex items-center justify-center gap-3">
        <PageLink href={buildAdminUsersPageHref(query, currentPage - 1)} disabled={currentPage <= 1}>
          Anterior
        </PageLink>
        <span className="text-sm font-bold text-zinc-300">Pagina {currentPage} de {totalPages}</span>
        <PageLink href={buildAdminUsersPageHref(query, currentPage + 1)} disabled={currentPage >= totalPages}>
          Proxima
        </PageLink>
      </nav>
    </section>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-600">{children}</span>;
  return <Link href={href} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/10">{children}</Link>;
}
