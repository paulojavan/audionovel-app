import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { CHAPTER_AUDIO_REVISION_SELECT, CHAPTER_PAGE_SELECT, REQUIRE_USER_SELECT } from "./page-data-select";
import { prisma } from "./prisma";
import { hasActiveSessionUser } from "./session-state";
import { hasPremiumAccess } from "./subscription";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!hasActiveSessionUser(session)) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: REQUIRE_USER_SELECT,
  });

  if (!user) {
    return { error: NextResponse.json({ error: "Usuário não encontrado." }, { status: 401 }) };
  }

  if (user.isBlocked) {
    return { error: NextResponse.json({ error: "Usuario bloqueado. Entre em contato com o administrador via Discord." }, { status: 403 }) };
  }

  return { session, user };
}

export async function requireAdmin() {
  const auth = await requireUser();
  if ("error" in auth) return auth;

  if (auth.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }

  return auth;
}

export async function canPlayChapter(chapterId: string, userId?: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId, published: true },
    select: CHAPTER_PAGE_SELECT,
  });

  if (!chapter) return { allowed: false, status: 404 as const, chapter: null, reason: "Capítulo não encontrado." };
  if (!chapter.premiumOnly) return { allowed: true, status: 200 as const, chapter, reason: null };
  if (!userId) return { allowed: false, status: 401 as const, chapter, reason: "Faça login para ouvir este capítulo." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, subscriptionStatus: true, premiumUntil: true, isBlocked: true },
  });

  if (user?.isBlocked) {
    return { allowed: false, status: 403 as const, chapter, reason: "Usuario bloqueado. Entre em contato com o administrador via Discord." };
  }

  if (!hasPremiumAccess(user)) {
    return { allowed: false, status: 402 as const, chapter, reason: "Capítulo disponível apenas para premium." };
  }

  return { allowed: true, status: 200 as const, chapter, reason: null };
}

export async function canPlayChapterAudioRevision(chapterId: string, userId?: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId, published: true },
    select: CHAPTER_AUDIO_REVISION_SELECT,
  });

  if (!chapter) return { allowed: false, status: 404 as const, chapter: null, reason: "Capitulo nao encontrado." };
  if (!chapter.premiumOnly) return { allowed: true, status: 200 as const, chapter, reason: null };
  if (!userId) return { allowed: false, status: 401 as const, chapter, reason: "Faca login para ouvir este capitulo." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, subscriptionStatus: true, premiumUntil: true, isBlocked: true },
  });
  if (user?.isBlocked) {
    return { allowed: false, status: 403 as const, chapter, reason: "Usuario bloqueado. Entre em contato com o administrador via Discord." };
  }
  if (!hasPremiumAccess(user)) {
    return { allowed: false, status: 402 as const, chapter, reason: "Capitulo disponivel apenas para premium." };
  }

  return { allowed: true, status: 200 as const, chapter, reason: null };
}
