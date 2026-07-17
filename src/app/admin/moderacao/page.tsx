import Link from "next/link";
import type { ReactNode } from "react";
import { AdminCommentModerationActions } from "@/components/admin-comment-moderation-actions";
import { ADMIN_MODERATION_COMMENT_SELECT } from "@/lib/page-data-select";
import { prisma } from "@/lib/prisma";

type AdminModerationPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminModerationPage({ searchParams }: AdminModerationPageProps) {
  const { tab } = await searchParams;
  const removedTab = tab === "removidos";
  const status = removedTab ? "REMOVED" : "PENDING";

  const comments = await prisma.comment.findMany({
    where: { status },
    take: 100,
    orderBy: { updatedAt: "desc" },
    select: ADMIN_MODERATION_COMMENT_SELECT,
  });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Moderacao de comentarios</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {removedTab ? "Comentarios removidos permanecem visiveis para auditoria." : "Comentarios publicados aguardam revisao administrativa."}
          </p>
        </div>
        <div className="flex rounded-full bg-[#06272b] p-1">
          <TabLink href="/admin/moderacao" active={!removedTab}>
            Pendentes
          </TabLink>
          <TabLink href="/admin/moderacao?tab=removidos" active={removedTab}>
            Removidos
          </TabLink>
        </div>
      </div>

      <div className="grid gap-3">
        {comments.length ? (
          comments.map((comment) => {
            const targetHref = getTargetHref(comment);
            const targetLabel = getTargetLabel(comment);

            return (
              <article key={comment.id} className="rounded-md bg-[#06272b] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{comment.user.name}</p>
                      {comment.parent ? <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-zinc-300">Resposta</span> : null}
                      {comment.editedAt ? <span className="rounded-full bg-[#18b7bd]/15 px-2 py-1 text-[10px] font-black uppercase text-[#18b7bd]">Editado</span> : null}
                    </div>
                    <p className="text-sm text-zinc-400">{comment.user.email}</p>
                    {comment.parent ? <p className="mt-1 text-xs text-zinc-500">Respondendo {comment.parent.user.name}</p> : null}
                  </div>
                  <Link href={targetHref} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20">
                    {targetLabel}
                  </Link>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-zinc-300">{comment.body}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                  <p className="text-xs text-zinc-500">
                    Enviado em {comment.createdAt.toLocaleString("pt-BR")}
                    {comment.editedAt ? ` - editado em ${comment.editedAt.toLocaleString("pt-BR")}` : ""}
                    {comment.removedAt ? ` - removido em ${comment.removedAt.toLocaleString("pt-BR")}` : ""}
                  </p>
                  <AdminCommentModerationActions commentId={comment.id} showRemove={!removedTab} />
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-md bg-[#06272b] p-4 text-zinc-400">
            {removedTab ? "Nenhum comentario removido." : "Nenhum comentario pendente de moderacao."}
          </p>
        )}
      </div>
    </section>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link className={`rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300 hover:bg-white/10 hover:text-white"}`} href={href}>
      {children}
    </Link>
  );
}

function getTargetHref(comment: {
  id: string;
  novel: { slug: string } | null;
  chapter: { id: string; volume: { novel: { slug: string } } } | null;
}) {
  if (comment.novel) return `/novels/${comment.novel.slug}#comment-${comment.id}`;
  if (comment.chapter) return `/chapters/${comment.chapter.id}#comment-${comment.id}`;
  return "#";
}

function getTargetLabel(comment: {
  novel: { title: string } | null;
  chapter: { title: string; volume: { title: string; novel: { title: string } } } | null;
}) {
  if (comment.novel) return comment.novel.title;
  if (comment.chapter) return `${comment.chapter.volume.novel.title} - ${comment.chapter.title}`;
  return "Sem alvo";
}
