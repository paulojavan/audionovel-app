import { buildAccountStorageKey } from "./account-scope";
import type { OfflineItem } from "./offline-items";

export function getOfflineAudioRecordId(accountScope: string, chapterId: string) {
  return buildAccountStorageKey(accountScope, `offline:chapter:${chapterId}`);
}

export function selectAvailableOfflineItems(
  items: OfflineItem[],
  audioRecordIds: Iterable<IDBValidKey | string>,
  accountScope: string,
  now = Date.now(),
) {
  const audioIds = new Set(Array.from(audioRecordIds, String));
  return items.filter((item) => (
    new Date(item.expiresAt).getTime() > now &&
    audioIds.has(getOfflineAudioRecordId(accountScope, item.chapterId))
  ));
}

export function selectRecoverableOfflineItems(
  items: OfflineItem[],
  audioRecordIds: Iterable<IDBValidKey | string>,
  accountScope: string,
) {
  const audioIds = new Set(Array.from(audioRecordIds, String));
  return items.filter((item) => (
    audioIds.has(getOfflineAudioRecordId(accountScope, item.chapterId))
  ));
}
