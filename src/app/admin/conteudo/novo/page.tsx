import Link from "next/link";
import { AdminNovelForm } from "@/components/admin-content-forms";
import { prisma } from "@/lib/prisma";

export default async function NewNovelPage() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="grid gap-5">
      <Link href="/admin/conteudo" className="text-sm font-bold text-[#18b7bd]">
        Voltar para novels cadastradas
      </Link>
      <AdminNovelForm tags={tags} />
    </div>
  );
}
