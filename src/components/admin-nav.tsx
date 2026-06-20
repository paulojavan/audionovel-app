"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/conteudo", label: "Novels" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/financeiro", label: "Financeiro" },
  { href: "/admin/moderacao", label: "Moderacao" },
  { href: "/admin/seguranca", label: "Seguranca" },
  { href: "/admin/configuracoes", label: "Configuracoes" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-lg bg-[#06272b] p-1 text-sm font-bold scrollbar-thin">
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-md px-4 py-2 transition ${
              active ? "bg-[#18b7bd] text-[#021114]" : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
