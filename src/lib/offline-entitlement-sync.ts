import type { OfflineItem } from "./offline-items";

const MAX_RENEWAL_BATCH_SIZE = 100;

function selectRenewalBatch(
  items: OfflineItem[],
  renewalCursor?: string | null,
) {
  const sortedItems = [...items].sort((left, right) => (
    left.chapterId.localeCompare(right.chapterId)
  ));
  if (sortedItems.length <= MAX_RENEWAL_BATCH_SIZE) return sortedItems;

  const nextIndex = renewalCursor
    ? sortedItems.findIndex((item) => item.chapterId > renewalCursor)
    : 0;
  const startIndex = nextIndex >= 0 ? nextIndex : 0;
  return Array.from(
    { length: MAX_RENEWAL_BATCH_SIZE },
    (_, offset) => sortedItems[(startIndex + offset) % sortedItems.length],
  );
}

export type RenewedOfflineItem = {
  chapterId: string;
  cacheKey: string;
  expiresAt: string;
};

type OfflineEntitlementSyncDependencies = {
  ensureDeviceToken: () => Promise<unknown>;
  getRecoverableItems: (accountScope: string) => Promise<OfflineItem[]>;
  renewItems: (chapterIds: string[]) => Promise<RenewedOfflineItem[]>;
  updateItemsBatch: (
    accountScope: string,
    items: OfflineItem[],
  ) => Promise<number>;
  preparePage: (accountScope: string) => Promise<void>;
};

export async function reconcileOfflineEntitlement(
  accountScope: string,
  dependencies: OfflineEntitlementSyncDependencies,
  renewalCursor?: string | null,
): Promise<{ renewed: number; nextCursor?: string }> {
  await dependencies.ensureDeviceToken();
  const recoverableItems = await dependencies.getRecoverableItems(accountScope);
  if (!recoverableItems.length) return { renewed: 0 };

  const renewalBatch = selectRenewalBatch(recoverableItems, renewalCursor);
  const renewedItems = await dependencies.renewItems(
    renewalBatch.map((item) => item.chapterId),
  );
  const localByChapter = new Map(
    recoverableItems.map((item) => [item.chapterId, item]),
  );
  const itemsToUpdate: OfflineItem[] = [];
  for (const item of renewedItems) {
    const localItem = localByChapter.get(item.chapterId);
    if (!localItem) continue;
    itemsToUpdate.push({
      ...localItem,
      cacheKey: item.cacheKey,
      expiresAt: item.expiresAt,
    });
  }
  const renewed = await dependencies.updateItemsBatch(
    accountScope,
    itemsToUpdate,
  );

  if (renewed > 0) {
    await dependencies.preparePage(accountScope);
  }
  const result: { renewed: number; nextCursor?: string } = { renewed };
  if (recoverableItems.length > renewalBatch.length) {
    result.nextCursor = renewalBatch.at(-1)?.chapterId;
  }
  return result;
}
