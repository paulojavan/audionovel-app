import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import { getPrismaErrorCode, isTransientPrismaSessionError } from "./auth-session-grace";
import { prisma } from "./prisma";

export const getCachedUnreadNotificationCount = unstable_cache(
  async (userId: string) => {
    try {
      return await prisma.notification.count({ where: { userId, readAt: null } });
    } catch (error) {
      if (!isTransientPrismaSessionError(error)) throw error;

      console.warn(
        JSON.stringify({
          event: "notification_count_database_failure",
          timestamp: new Date().toISOString(),
          prismaCode: getPrismaErrorCode(error),
        }),
      );
      return 0;
    }
  },
  ["unread-notification-count"],
  { revalidate: 15, tags: [CACHE_TAGS.notifications] },
);
