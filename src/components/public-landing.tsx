import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Check,
  CloudDownload,
  Headphones,
  Play,
  Sparkles,
} from "lucide-react";
import { formatAppDate } from "@/lib/app-time";

const highlights = [
  {
    icon: Headphones,
    title: "Narração imersiva",
    text: "Uma experiência de áudio criada para acompanhar cada capítulo.",
  },
  {
    icon: BookOpenText,
    title: "Áudio e texto",
    text: "Ouça a história e acompanhe a leitura quando houver sincronização.",
  },
  {
    icon: CloudDownload,
    title: "Disponível offline",
    text: "Leve seus capítulos com você e continue mesmo sem conexão.",
  },
];

const benefits = [
  "Progresso salvo automaticamente",
  "Biblioteca, favoritos e histórico",
  "Experiência otimizada para celular",
  "Capítulos gratuitos e premium",
];

export function PublicLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02090b] text-white">
      <section className="relative flex min-h-svh flex-col border-b border-white/8">
        <header className="absolute inset-x-0 top-0 z-30 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10">
          <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-[#020b0d]/72 px-3 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:px-4">
            <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Áudio Novel BR — início">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[#36dae1]/25 bg-[#02090b]">
                <Image
                  src="/logo-audio-novel-br.png"
                  alt=""
                  width={40}
                  height={40}
                  className="block h-full w-full object-cover"
                  sizes="40px"
                />
              </span>
              <span className="hidden text-base font-black tracking-[-0.025em] min-[390px]:block">
                Áudio Novel <span className="text-[#27cbd2]">BR</span>
              </span>
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/login"
                className="inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-bold text-zinc-100 transition hover:bg-white/8 sm:px-5"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#20c3ca] px-4 text-sm font-black text-[#021114] shadow-lg shadow-[#18b7bd]/15 transition hover:bg-[#53e1e6] sm:px-5"
              >
                Começar
                <ArrowRight size={15} aria-hidden="true" className="hidden sm:block" />
              </Link>
            </div>
          </nav>
        </header>

        <div className="relative min-h-[68svh] flex-1 overflow-hidden bg-[#01070a] sm:min-h-[72svh]">
          <Image
            src="/hero-audio-novel-br.png"
            alt="Áudio Novel BR — livro aberto iluminado e microfone com ondas sonoras"
            width={1731}
            height={909}
            className="absolute inset-0 h-full w-full object-cover object-center"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#02090b]/35 via-transparent to-[#02090b]/75 sm:from-[#02090b]/20 sm:to-[#02090b]/45" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#02090b] to-transparent" />
        </div>

        <div className="relative z-10 bg-[#02090b] px-4 pb-10 sm:px-6 sm:pb-12 lg:px-10 lg:pb-14">
          <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16">
            <div className="max-w-3xl">
              <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#62e3e8]">
                <Sparkles size={15} aria-hidden="true" />
                Sua próxima história está esperando
              </p>
              <h1 className="text-4xl font-black leading-[1.02] tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl">
                Histórias para ler. Mundos para ouvir.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#a9c0c3] sm:text-lg">
                Descubra web novels narradas, acompanhe seu progresso e viva cada capítulo no seu ritmo.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:min-w-[25rem]">
              <Link
                href="/cadastro"
                className="inline-flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-[#20c3ca] px-6 py-3 font-black text-[#021114] shadow-xl shadow-[#18b7bd]/15 transition hover:-translate-y-0.5 hover:bg-[#53e1e6]"
              >
                Criar conta grátis
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-6 py-3 font-bold text-white transition hover:border-[#22d3dc]/30 hover:bg-white/9"
              >
                <Play size={16} fill="currentColor" aria-hidden="true" />
                Já sou membro
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 bg-[#041114] px-4 py-5 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-black uppercase tracking-[0.15em] text-[#7f9da1] sm:justify-between">
          <span className="flex items-center gap-2">
            <Check size={15} className="text-[#2bd0d7]" aria-hidden="true" />
            Progresso salvo
          </span>
          <span className="flex items-center gap-2">
            <Check size={15} className="text-[#2bd0d7]" aria-hidden="true" />
            Modo offline
          </span>
          <span className="flex items-center gap-2">
            <Check size={15} className="text-[#2bd0d7]" aria-hidden="true" />
            Áudio + texto
          </span>
          <span className="flex items-center gap-2">
            <Check size={15} className="text-[#2bd0d7]" aria-hidden="true" />
            Feito para o Brasil
          </span>
        </div>
      </section>

      <section className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-10 lg:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(24,183,189,0.1),transparent_34rem)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#58dce2]">Uma experiência completa</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-balance sm:text-5xl">
              Tudo o que importa. Sem distrações.
            </h2>
            <p className="mt-5 leading-7 text-[#8fa9ad] sm:text-lg">
              Do primeiro play ao último capítulo, cada detalhe foi pensado para manter você dentro da história.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-[1.75rem] border border-white/8 bg-white/8 md:grid-cols-3">
            {highlights.map(({ icon: Icon, title, text }) => (
              <article key={title} className="group bg-[#061518] p-7 transition hover:bg-[#082126] sm:p-9">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#27cbd2]/20 bg-[#20c3ca]/8 text-[#55dee4] transition group-hover:bg-[#20c3ca] group-hover:text-[#021114]">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="text-xl font-black tracking-tight">{title}</h3>
                <p className="mt-3 leading-7 text-[#8fa9ad]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-10 lg:pb-32">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-white/8 bg-[#061518] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[26rem] overflow-hidden lg:min-h-[38rem]">
            <Image
              src="/logo-audio-novel-br.png"
              alt="Livro e microfone representando a experiência Áudio Novel BR"
              width={1254}
              height={1254}
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 48vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#061518]/80 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#061518]/55" />
          </div>

          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-16">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#58dce2]">Sua biblioteca acompanha você</p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] text-balance sm:text-5xl">
              Continue de onde parou, em qualquer lugar.
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-[#9ab2b6] sm:text-lg">
              Organize suas histórias, favorite suas obras preferidas e mantenha seus capítulos sempre por perto.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm font-bold text-[#c8d9db]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#20c3ca] text-[#021114]">
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>

            <Link
              href="/cadastro"
              className="mt-9 inline-flex min-h-13 w-fit items-center justify-center gap-2 rounded-xl px-6 py-3 font-black shadow-xl shadow-[#18b7bd]/15 transition hover:-translate-y-0.5 hover:brightness-110"
              style={{ backgroundColor: "#20c3ca", color: "#021114" }}
            >
              Começar minha jornada
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 bg-[#041114] px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#58dce2]">Pronto para dar o play?</p>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-balance sm:text-5xl">
            Sua próxima história começa aqui.
          </h2>
          <Link
            href="/cadastro"
            className="mt-8 inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#20c3ca] px-7 py-3 font-black text-[#021114] shadow-xl shadow-[#18b7bd]/15 transition hover:-translate-y-0.5 hover:bg-[#53e1e6]"
          >
            Criar conta grátis
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/8 bg-[#02090b] px-4 py-7 text-center text-sm text-[#647f83]">
        <p>© {formatAppDate(new Date(), { year: "numeric" })} Áudio Novel BR. Leia com os olhos. Viva com os ouvidos.</p>
      </footer>
    </main>
  );
}
