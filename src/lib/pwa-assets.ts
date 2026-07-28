export const PWA_ICON_REVISION = "20260728-2";

export function getVersionedPwaAsset(pathname: string) {
  return `${pathname}?v=${PWA_ICON_REVISION}`;
}
