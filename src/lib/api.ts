import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
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
    select: {
      id: true,
      role: true,
      plan: true,
      subscriptionStatus: true,
      premiumUntil: true,
      email: true,
      name: true,
      paymentProviderCustomerId: true,
      isBlocked: true,
    },
  });

  if (!user) {
    return { error: NextResponse.json({ error: "Usuário não encontrado." }, { status: 401 }) };
  }

  if (user.isBlocked) {
    return { error: NextResponse.json({ error: "Usuario bloqueado. Entre em contato com o administrador via Discord." }, { status: 403 }) };
  }

  return { session, user };
}

export async function canPlayChapter(chapterId: string, userId?: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId, published: true },
    include: {
      volume: {
        include: {
          novel: true,
        },
      },
    },
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
