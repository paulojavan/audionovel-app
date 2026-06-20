import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getActiveServerSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.isBlocked) redirect("/login?blocked=1");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase text-[#18b7bd]">Painel administrativo</p>
          <h1 className="mt-1 text-4xl font-black">Admin Áudio Novel BR</h1>
        </div>
        <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/10">
          Ver app
        </Link>
      </div>
      <AdminNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
