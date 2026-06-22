export type PwaInstallPromptState = "hidden" | "ios-instructions" | "native-prompt";

type PwaInstallPromptInput = {
  isIos: boolean;
  isStandalone: boolean;
  hasNativeInstallPrompt: boolean;
  dismissed: boolean;
};

export function getPwaInstallPromptState({
  isIos,
  isStandalone,
  hasNativeInstallPrompt,
  dismissed,
}: PwaInstallPromptInput): PwaInstallPromptState {
  if (isStandalone || dismissed) return "hidden";
  if (hasNativeInstallPrompt) return "native-prompt";
  if (isIos) return "ios-instructions";
  return "hidden";
}

export function isIosUserAgent(userAgent: string) {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  if (userAgent.includes("Mac") && "ontouchstart" in globalThis) return true;
  return false;
}
