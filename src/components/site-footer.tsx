import { MessageCircle, PlaySquare } from "lucide-react";
import { formatAppDate } from "@/lib/app-time";

const socialLinks = [
  { href: "https://www.youtube.com/@AudioNovelBR", label: "YouTube", Icon: PlaySquare },
  { href: "https://discord.gg/6gHJuT9hAk", label: "Discord", Icon: MessageCircle },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#02090b] px-4 py-7 text-center text-sm text-[#8fa8ac]">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4">
        <nav aria-label="Redes sociais" className="flex flex-wrap items-center justify-center gap-3">
          {socialLinks.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-bold text-zinc-100 transition hover:border-[#18b7bd] hover:text-[#58dce2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58dce2]"
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
        <p>© {formatAppDate(new Date(), { year: "numeric" })} Áudio Novel BR. Leia com os olhos. Viva com os ouvidos.</p>
      </div>
    </footer>
  );
}
