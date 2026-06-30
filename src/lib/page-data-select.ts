import type { Prisma } from "@prisma/client";

export const REQUIRE_USER_SELECT = {
  id: true,
  role: true,
  email: true,
  name: true,
  isBlocked: true,
} as const satisfies Prisma.UserSelect;

export const COMMENT_THREAD_SELECT = {
  id: true,
  body: true,
  status: true,
  editedAt: true,
  createdAt: true,
  userId: true,
  user: { select: { name: true } },
  replies: {
    where: { status: { in: ["APPROVED", "REMOVED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      status: true,
      editedAt: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true } },
    },
  },
} as const satisfies Prisma.CommentSelect;

export const PUBLIC_NOVEL_SELECT = {
  id: true,
  title: true,
  author: true,
  synopsis: true,
  coverUrl: true,
  viewCount: true,
  ratingScore: true,
  ratingCount: true,
  volumes: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      position: true,
      chapters: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          positionEnd: true,
          contentType: true,
          durationSec: true,
          startSec: true,
          chapterPartsJson: true,
          viewCount: true,
          premiumOnly: true,
          createdAt: true,
        },
      },
    },
  },
  tags: {
    orderBy: { tag: { name: "asc" } },
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
  continuation: {
    select: {
      slug: true,
      title: true,
      coverUrl: true,
      synopsis: true,
    },
  },
} as const satisfies Prisma.NovelSelect;

export const CATALOG_NOVEL_SELECT = {
  id: true,
  slug: true,
  title: true,
  author: true,
  coverUrl: true,
  ratingScore: true,
  ratingCount: true,
  tags: {
    take: 3,
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} as const satisfies Prisma.NovelSelect;

export const CATALOG_TAG_SELECT = {
  id: true,
  name: true,
  slug: true,
} as const satisfies Prisma.TagSelect;

export const LIBRARY_USER_SELECT = {
  id: true,
  favorites: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      novel: {
        select: {
          slug: true,
          coverUrl: true,
          title: true,
        },
      },
    },
  },
  listeningProgress: {
    take: 20,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      chapterId: true,
      positionSec: true,
      completed: true,
      chapter: {
        select: {
          title: true,
          position: true,
          positionEnd: true,
          volume: {
            select: {
              title: true,
              position: true,
              novel: { select: { title: true } },
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.UserSelect;

export const PROFILE_USER_SELECT = {
  name: true,
  email: true,
  role: true,
  subscriptionStatus: true,
  premiumUntil: true,
  payments: {
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      description: true,
      currency: true,
      amountCents: true,
      status: true,
    },
  },
} as const satisfies Prisma.UserSelect;

export const OFFLINE_DOWNLOAD_SELECT = {
  id: true,
  chapterId: true,
  cacheKey: true,
  expiresAt: true,
  chapter: {
    select: {
      title: true,
      position: true,
      positionEnd: true,
      startSec: true,
      durationSec: true,
      chapterPartsJson: true,
      volume: {
        select: {
          title: true,
          novel: { select: { title: true } },
        },
      },
    },
  },
} as const satisfies Prisma.OfflineDownloadSelect;

export const CHAPTER_PROGRESS_SELECT = {
  positionSec: true,
} as const satisfies Prisma.ListeningProgressSelect;

export const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  message: true,
  href: true,
  readAt: true,
  createdAt: true,
} as const satisfies Prisma.NotificationSelect;

export const SUBSCRIPTION_PLAN_SELECT = {
  id: true,
  name: true,
  description: true,
  amountCents: true,
  currency: true,
  interval: true,
  premiumDays: true,
  allowCard: true,
  allowPix: true,
} as const satisfies Prisma.SubscriptionPlanSelect;

export const CHAPTER_PAGE_SELECT = {
  id: true,
  title: true,
  position: true,
  positionEnd: true,
  contentType: true,
  durationSec: true,
  audioUrl: true,
  youtubeVideoId: true,
  coverUrl: true,
  startSec: true,
  chapterPartsJson: true,
  transcriptJson: true,
  premiumOnly: true,
  likeCount: true,
  dislikeCount: true,
  volume: {
    select: {
      title: true,
      novelId: true,
      novel: {
        select: {
          slug: true,
          title: true,
          coverUrl: true,
        },
      },
    },
  },
} as const satisfies Prisma.ChapterSelect;

export const ADMIN_CONTENT_NOVEL_SELECT = {
  id: true,
  title: true,
  author: true,
  synopsis: true,
  coverUrl: true,
  status: true,
  viewCount: true,
  tags: {
    select: {
      tag: { select: { id: true, name: true } },
    },
  },
  volumes: {
    select: {
      id: true,
      chapters: {
        select: {
          position: true,
          positionEnd: true,
          premiumOnly: true,
        },
      },
    },
  },
} as const satisfies Prisma.NovelSelect;

export const ADMIN_NOVEL_PANEL_SELECT = {
  id: true,
  slug: true,
  title: true,
  author: true,
  synopsis: true,
  coverUrl: true,
  status: true,
  viewCount: true,
  ratingScore: true,
  ratingCount: true,
  tags: {
    select: {
      tagId: true,
      tag: { select: { name: true } },
    },
  },
  volumes: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      position: true,
      chapters: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          positionEnd: true,
          contentType: true,
          durationSec: true,
          premiumOnly: true,
          createdAt: true,
        },
      },
    },
  },
} as const satisfies Prisma.NovelSelect;

export const ADMIN_PAYMENT_SELECT = {
  id: true,
  description: true,
  providerPaymentId: true,
  providerEventId: true,
  amountCents: true,
  currency: true,
  status: true,
  createdAt: true,
  user: { select: { email: true } },
} as const satisfies Prisma.PaymentTransactionSelect;

export const ADMIN_DASHBOARD_PAYMENT_SELECT = {
  id: true,
  amountCents: true,
  currency: true,
  status: true,
  user: { select: { email: true } },
} as const satisfies Prisma.PaymentTransactionSelect;

export const ADMIN_TOP_NOVEL_SELECT = {
  id: true,
  slug: true,
  title: true,
  viewCount: true,
} as const satisfies Prisma.NovelSelect;

export const ADMIN_MODERATION_COMMENT_SELECT = {
  id: true,
  body: true,
  editedAt: true,
  removedAt: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
  novel: { select: { slug: true, title: true } },
  chapter: {
    select: {
      id: true,
      title: true,
      volume: {
        select: {
          title: true,
          novel: { select: { title: true, slug: true } },
        },
      },
    },
  },
  parent: {
    select: {
      id: true,
      user: { select: { name: true } },
    },
  },
} as const satisfies Prisma.CommentSelect;

export const ADMIN_BUG_REPORT_SELECT = {
  id: true,
  title: true,
  description: true,
  pageUrl: true,
  status: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} as const satisfies Prisma.BugReportSelect;

export const ADMIN_PLAN_SELECT = {
  id: true,
  name: true,
  description: true,
  amountCents: true,
  currency: true,
  interval: true,
  premiumDays: true,
  active: true,
  allowCard: true,
  allowPix: true,
  sortOrder: true,
} as const satisfies Prisma.SubscriptionPlanSelect;

export const ADMIN_EDIT_NOVEL_SELECT = {
  id: true,
  title: true,
  author: true,
  synopsis: true,
  coverUrl: true,
  status: true,
  continuationId: true,
  tags: { select: { tagId: true } },
} as const satisfies Prisma.NovelSelect;

export const ADMIN_EDIT_CHAPTER_SELECT = {
  id: true,
  title: true,
  position: true,
  positionEnd: true,
  contentType: true,
  durationSec: true,
  audioUrl: true,
  youtubeUrl: true,
  startSec: true,
  chapterPartsJson: true,
  transcriptJson: true,
  premiumOnly: true,
  published: true,
  volumeId: true,
  volume: {
    select: {
      novel: {
        select: {
          id: true,
          title: true,
          volumes: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, position: true },
          },
        },
      },
    },
  },
} as const satisfies Prisma.ChapterSelect;

export const ADMIN_USER_DETAIL_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  subscriptionStatus: true,
  premiumUntil: true,
  isBlocked: true,
  adminNotes: true,
  favorites: {
    orderBy: { createdAt: "desc" },
    select: {
      novelId: true,
      createdAt: true,
      novel: {
        select: { id: true, title: true, slug: true },
      },
    },
  },
  listeningProgress: {
    orderBy: { updatedAt: "desc" },
    select: {
      updatedAt: true,
      chapter: {
        select: {
          volume: {
            select: {
              novel: {
                select: { id: true, title: true, slug: true },
              },
            },
          },
        },
      },
    },
  },
  comments: {
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      novel: { select: { title: true, slug: true } },
      chapter: {
        select: {
          id: true,
          title: true,
          volume: {
            select: {
              novel: { select: { title: true, slug: true } },
            },
          },
        },
      },
    },
  },
  payments: {
    select: { status: true, amountCents: true },
  },
  _count: {
    select: {
      comments: true,
      manualSubscriptionLogs: true,
    },
  },
} as const satisfies Prisma.UserSelect;
