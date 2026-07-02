import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationReadButton } from "@/components/notification-read-button";
import { NOTIFICATION_SELECT } from "@/lib/page-data-select";
import { prisma } from "@/lib/prisma";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export default async function NotificationsPage() {
  const session = await getActiveServerSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.isBlocked) redirect("/login?blocked=1");

  const [latestNotifications, unreadNotifications] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id, readAt: null },
      take: 100,
      orderBy: { createdAt: "desc" },
      select: NOTIFICATION_SELECT,
    }),
  ]);

  const notifications = [...new Map([...unreadNotifications, ...latestNotifications].map((notification) => [notification.id, notification])).values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <div className="px-4 py-6 md:px-8">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-black">Notificacoes</h1>
          <p className="mt-2 text-zinc-400">As 20 ultimas notificacoes, mantendo tambem qualquer notificacao nao lida.</p>
        </div>
        {notifications.some((notification) => !notification.readAt) ? <NotificationReadButton /> : null}
      </section>

      <div className="grid gap-2">
        {notifications.length ? (
          notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.href}
              className={`rounded-md border p-3 hover:bg-[#08353a] ${
                notification.readAt ? "border-white/10 bg-[#06272b] text-zinc-300" : "border-[#18b7bd]/40 bg-[#18b7bd]/10 text-white"
              }`}
            >
              <p className="font-bold">{notification.title}</p>
              <p className="mt-1 text-sm text-zinc-300">{notification.message}</p>
              <span className="mt-2 block text-xs text-zinc-500">{notification.createdAt.toLocaleString("pt-BR")}</span>
            </Link>
          ))
        ) : (
          <p className="rounded-md bg-[#06272b] p-3 text-zinc-400">Nenhuma notificacao ainda.</p>
        )}
      </div>
    </div>
  );
}
