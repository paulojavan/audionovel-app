import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import { prisma } from "./prisma";

export const getCachedUnreadNotificationCount = unstable_cache(
  async (userId: string) => prisma.notification.count({ where: { userId, readAt: null } }),
  ["unread-notification-count"],
  { revalidate: 15, tags: [CACHE_TAGS.notifications] },
);
