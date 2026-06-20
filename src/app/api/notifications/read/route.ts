import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireUser } from "@/lib/api";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  await prisma.notification.updateMany({
    where: { userId: auth.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidateTag(CACHE_TAGS.notifications, "max");

  return NextResponse.json({ ok: true });
}
