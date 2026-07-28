import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Headphones } from "lucide-react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="min-h-svh bg-[#020b0d] text-white lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)]">
      <section className="relative min-h-56 overflow-hidden border-b border-white/10 lg:min-h-svh lg:border-b-0 lg:border-r">
        <Image
          src="/logo-audio-novel-br.png"
          alt="Livro aberto iluminado em azul-ciano e microfone com ondas sonoras"
          fill
          className="object-cover object-[center_42%]"
          sizes="(min-width: 1024px) 55vw, 100vw"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,11,13,0.08)_0%,rgba(2,11,13,0.2)_48%,rgba(2,11,13,0.93)_100%)] lg:bg-[linear-gradient(90deg,rgba(2,11,13,0.02)_0%,rgba(2,11,13,0.12)_56%,rgba(2,11,13,0.78)_100%)]" />
        <div className="absolute left-4 top-4 sm:left-7 sm:top-7">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-white/12 bg-[#031316]/72 px-3 py-2 shadow-xl backdrop-blur-xl transition hover:bg-[#031316]/90"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18b7bd] text-[#021114]">
              <Headphones size={18} aria-hidden="true" />
            </span>
            <span className="text-sm font-black">
              Áudio Novel <span className="text-[#5be3e9]">BR</span>
            </span>
          </Link>
        </div>
        <div className="absolute bottom-7 left-7 right-7 hidden max-w-xl lg:block">
          <p className="text-3xl font-black leading-tight tracking-[-0.035em] text-balance">
            “Toda grande história merece ser ouvida.”
          </p>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-[#69e4e9]">
            Leia com os olhos. Viva com os ouvidos.
          </p>
        </div>
      </section>

      <section className="relative flex min-h-[calc(100svh-14rem)] items-center justify-center overflow-hidden px-4 py-10 sm:px-8 lg:min-h-svh lg:px-12 lg:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(24,183,189,0.14),transparent_24rem),radial-gradient(circle_at_10%_90%,rgba(34,211,220,0.07),transparent_20rem)]" />
        <div className="relative w-full max-w-[30rem]">
          <Link
            href="/"
            className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-bold text-[#9bb4b8] transition hover:text-white"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Voltar para o início
          </Link>

          <div className="rounded-[1.75rem] border border-white/10 bg-[#06171a]/72 p-6 shadow-[0_32px_80px_-36px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#65e3e9]">{eyebrow}</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">{title}</h1>
            <p className="mt-3 leading-7 text-[#a7bec2]">{description}</p>
            {children}
            <div className="mt-7 border-t border-white/8 pt-6 text-center text-sm text-[#8fa8ac]">{footer}</div>
          </div>

          <p className="mt-7 text-center text-xs leading-5 text-[#617d81]">
            Ao continuar, você concorda com o uso seguro dos seus dados para acessar a plataforma.
          </p>
        </div>
      </section>
    </main>
  );
}
