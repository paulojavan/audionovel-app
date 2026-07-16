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
  extendAudioExpiry: (
    accountScope: string,
    chapterId: string,
    expiresAt: string,
  ) => Promise<boolean>;
  saveItem: (accountScope: string, item: OfflineItem) => Promise<void>;
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
  let renewed = 0;
  for (const item of renewedItems) {
    const localItem = localByChapter.get(item.chapterId);
    if (!localItem) continue;
    const extended = await dependencies.extendAudioExpiry(
      accountScope,
      item.chapterId,
      item.expiresAt,
    );
    if (!extended) continue;
    await dependencies.saveItem(accountScope, {
      ...localItem,
      cacheKey: item.cacheKey,
      expiresAt: item.expiresAt,
    });
    renewed += 1;
  }

  if (renewed > 0) {
    await dependencies.preparePage(accountScope);
  }
  return { renewed };
}
