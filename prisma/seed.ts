import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const transcript = JSON.stringify([
  { start: 0, end: 8, text: "A chuva batia contra as janelas da estação orbital." },
  { start: 8, end: 16, text: "Lia ajustou os fones e ouviu a primeira mensagem proibida." },
  { start: 16, end: 28, text: "Do outro lado da linha, uma voz sussurrava coordenadas esquecidas." },
  { start: 28, end: 42, text: "Cada palavra acendia no painel como se o texto respirasse junto do áudio." },
  { start: 42, end: 60, text: "Quando a porta se abriu, ela já sabia que não estava sozinha." },
]);

async function main() {
  const adminPasswordHash = await hashPassword("admin123456");
  const demoPasswordHash = await hashPassword("usuario123456");

  await prisma.user.upsert({
    where: { email: "admin@novelbeat.local" },
    update: { passwordHash: adminPasswordHash },
    create: {
      name: "Admin Áudio Novel BR",
      email: "admin@novelbeat.local",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      plan: "PREMIUM",
      subscriptionStatus: "ACTIVE",
    },
  });

  await prisma.user.upsert({
    where: { email: "demo@novelbeat.local" },
    update: { passwordHash: demoPasswordHash },
    create: {
      name: "Usuário Demo",
      email: "demo@novelbeat.local",
      passwordHash: demoPasswordHash,
    },
  });

  const novel = await prisma.novel.upsert({
    where: { slug: "ecos-da-estacao-zero" },
    update: {},
    create: {
      slug: "ecos-da-estacao-zero",
      title: "Ecos da Estação Zero",
      author: "Marina Vale",
      narrator: "Caio Nunes",
      synopsis: "Uma operadora de comunicações encontra transmissões antigas que apontam para uma conspiração escondida entre colônias espaciais.",
      coverUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80",
      viewCount: 1204,
      ratingScore: 4.8,
      ratingCount: 210,
    },
  });

  const volume = await prisma.volume.upsert({
    where: { novelId_position: { novelId: novel.id, position: 1 } },
    update: {},
    create: { novelId: novel.id, title: "Volume 1: Sinais", position: 1 },
  });

  await prisma.chapter.upsert({
    where: { volumeId_position: { volumeId: volume.id, position: 1 } },
    update: {},
    create: {
      volumeId: volume.id,
      title: "A mensagem no ruído",
      position: 1,
      durationSec: 60,
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      transcriptJson: transcript,
      premiumOnly: false,
      viewCount: 542,
    },
  });

  await prisma.chapter.upsert({
    where: { volumeId_position: { volumeId: volume.id, position: 2 } },
    update: {},
    create: {
      volumeId: volume.id,
      title: "Porta de emergência",
      position: 2,
      durationSec: 60,
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      transcriptJson: transcript,
      premiumOnly: true,
      viewCount: 318,
    },
  });

  const secondNovel = await prisma.novel.upsert({
    where: { slug: "biblioteca-das-sombras" },
    update: {},
    create: {
      slug: "biblioteca-das-sombras",
      title: "Biblioteca das Sombras",
      author: "Rafael Akiyama",
      synopsis: "Arquivistas guardam livros que reescrevem memórias, mas uma aprendiz decide ouvir a história que todos temem abrir.",
      coverUrl: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80",
      viewCount: 863,
      ratingScore: 4.6,
      ratingCount: 144,
    },
  });

  const secondVolume = await prisma.volume.upsert({
    where: { novelId_position: { novelId: secondNovel.id, position: 1 } },
    update: {},
    create: { novelId: secondNovel.id, title: "Volume 1: Tinta Viva", position: 1 },
  });

  await prisma.chapter.upsert({
    where: { volumeId_position: { volumeId: secondVolume.id, position: 1 } },
    update: {},
    create: {
      volumeId: secondVolume.id,
      title: "O livro que respirava",
      position: 1,
      durationSec: 60,
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      transcriptJson: transcript,
      premiumOnly: false,
      viewCount: 220,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
