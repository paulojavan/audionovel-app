import type { OfflineItem } from "./offline-items";

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
) {
  await dependencies.ensureDeviceToken();
  const recoverableItems = await dependencies.getRecoverableItems(accountScope);
  if (!recoverableItems.length) return { renewed: 0 };

  const renewedItems = await dependencies.renewItems(
    recoverableItems.map((item) => item.chapterId),
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
  return { renewed };
}
