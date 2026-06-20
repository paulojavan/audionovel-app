import Link from "next/link";
import Image from "next/image";
import { BookOpen, Download, Headphones, Play, ShieldCheck, Star } from "lucide-react";
import { HomeRankingSwitcher } from "@/components/home-ranking-switcher";
import { prisma } from "@/lib/prisma";
import { getSafeServerSession } from "@/lib/safe-auth-session";

export default async function Home() {
  const session = await getSafeServerSession();

  if (!session?.user?.id || session.user.isBlocked) {
    return <LandingPage />;
  }

  const [novels, rankingByViews, rankingByRating, ratedNovelIds] = await Promise.all([
    prisma.novel.findMany({
      take: 12,
      include: { volumes: { include: { chapters: { take: 1, orderBy: { position: "asc" } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.novel.findMany({ take: 8, orderBy: { viewCount: "desc" } }),
    prisma.novel.findMany({ take: 8, orderBy: { ratingScore: "desc" } }),
    prisma.novelReaction.findMany({
      where: { userId: session.user.id, rating: { gte: 4 } },
      select: { novelId: true },
    }),
  ]);

  const ratedIds = ratedNovelIds.map((item) => item.novelId);
  const recommendations = ratedIds.length
    ? novels.filter((novel) => !ratedIds.includes(novel.id)).sort((a, b) => b.ratingScore - a.ratingScore)
    : novels.slice(0, 6);

  return (
    <div className="px-4 py-5 md:px-8">
      <section className="mb-10 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#18b7bd_0%,#06272b_55%,#020b0d_100%)] p-6 md:p-10">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-[#021114]">Web novels em audio</p>
        <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">Ouca capitulos, acompanhe o texto e continue de onde parou.</h1>
        <p className="mt-4 max-w-2xl text-zinc-100">Streaming online, modo offline autenticado, historico, favoritos, comentarios e capitulos premium.</p>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Star className="text-[#18b7bd]" size={22} />
          <h2 className="text-2xl font-bold">Recomendado para voce</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {recommendations.map((novel) => (
            <Link key={novel.id} href={`/novels/${novel.slug}`} className="rounded-md bg-[#06272b] p-3 transition hover:bg-[#08353a]">
              <Image src={novel.coverUrl} alt="" width={360} height={360} className="aspect-square w-full rounded-md object-cover" />
              <h3 className="mt-3 line-clamp-2 font-bold">{novel.title}</h3>
              <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{novel.author}</p>
              <p className="mt-1 text-sm font-bold text-yellow-200">{formatRating(novel.ratingScore, novel.ratingCount)}</p>
            </Link>
          ))}
        </div>
      </section>

      <HomeRankingSwitcher byViews={rankingByViews} byRating={rankingByRating} />
    </div>
  );
}

function LandingPage() {
  return (
    <main className="min-h-screen bg-[#020b0d] text-white">
      <section className="relative isolate min-h-screen overflow-hidden px-4 py-6 md:px-10">
        <Image src="/logo-audio-novel-br.png" alt="" fill className="object-cover opacity-20" priority sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,11,13,0.42)_0%,rgba(2,11,13,0.86)_48%,#020b0d_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,220,0.22),transparent_32rem)]" />

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-audio-novel-br.png"
              alt="Áudio Novel BR"
              width={60}
              height={60}
              className="h-14 w-14 rounded-md object-cover ring-1 ring-white/20"
            />
            <span className="text-lg font-black leading-tight md:text-2xl">Áudio Novel BR</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-bold text-zinc-100 hover:bg-white/10" href="/login">
              Entrar
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-full bg-[#18b7bd] px-4 py-2 text-sm font-black text-[#021114] hover:bg-[#22d3dc]" href="/cadastro">
              Criar conta
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] max-w-7xl items-center py-12">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-black uppercase tracking-[0.24em] text-[#8ff7ff]">Novels para ouvir e acompanhar</p>
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">Áudio Novel BR</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-100 md:text-xl">
              Ouça capítulos com texto sincronizado, continue de onde parou e leve suas novels favoritas para o modo offline com segurança.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="inline-flex min-h-12 items-center rounded-full bg-[#18b7bd] px-6 py-3 font-black text-[#021114] hover:bg-[#22d3dc]" href="/cadastro">
                Começar agora
              </Link>
              <Link className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 py-3 font-bold text-white hover:bg-white/10" href="/login">
                Já tenho conta
              </Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <LandingFeature icon={<Headphones size={20} />} title="Player imersivo" text="Modo página ou karaoke para acompanhar o texto." />
              <LandingFeature icon={<Download size={20} />} title="Offline protegido" text="Capítulos disponíveis sem depender de nova transmissão." />
              <LandingFeature icon={<ShieldCheck size={20} />} title="Premium seguro" text="Acesso por assinatura e capítulos liberados por plano." />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-16 md:grid-cols-3 md:px-10">
        <InfoCard icon={<BookOpen size={22} />} title="Biblioteca organizada" text="Volumes, capítulos, histórico, favoritos e progresso de audição em um só lugar." />
        <InfoCard icon={<Star size={22} />} title="Avaliações por estrelas" text="Descubra obras por nota média, visualizações e recomendações personalizadas." />
        <InfoCard icon={<Play size={22} />} title="Áudio + texto" text="Experiência criada para novels narradas, com leitura sincronizada quando disponível." />
      </section>
    </main>
  );
}

function LandingFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#06272b]/80 p-4 backdrop-blur">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#18b7bd] text-[#021114]">{icon}</div>
      <h2 className="font-black">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-300">{text}</p>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#06272b] p-5">
      <div className="mb-4 text-[#22d3dc]">{icon}</div>
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 leading-7 text-zinc-300">{text}</p>
    </div>
  );
}

function formatRating(average: number, count: number) {
  return count ? `${average.toFixed(1)} estrelas (${count})` : "Sem notas";
}
