import type { OfflineItem } from "./offline-items";

const MAX_RENEWAL_BATCH_SIZE = 100;

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

  const chapterIds = recoverableItems.map((item) => item.chapterId);
  const renewedItems: RenewedOfflineItem[] = [];
  for (let index = 0; index < chapterIds.length; index += MAX_RENEWAL_BATCH_SIZE) {
    renewedItems.push(...await dependencies.renewItems(
      chapterIds.slice(index, index + MAX_RENEWAL_BATCH_SIZE),
    ));
  }
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
