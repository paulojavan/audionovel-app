export type PwaInstallPromptState = "hidden" | "ios-instructions" | "browser-instructions" | "native-prompt";

type PwaInstallPromptInput = {
  isIos: boolean;
  isMobile: boolean;
  isStandalone: boolean;
  hasNativeInstallPrompt: boolean;
  dismissed: boolean;
};

export function isPwaInstalled({
  standalone,
  fullscreen,
  iosStandalone,
}: {
  standalone: boolean;
  fullscreen: boolean;
  iosStandalone: boolean;
}) {
  return standalone || fullscreen || iosStandalone;
}

export function getPwaInstallPromptState({
  isIos,
  isMobile,
  isStandalone,
  hasNativeInstallPrompt,
  dismissed,
}: PwaInstallPromptInput): PwaInstallPromptState {
  if (isStandalone || dismissed) return "hidden";
  if (hasNativeInstallPrompt) return "native-prompt";
  if (isIos) return "ios-instructions";
  if (isMobile) return "browser-instructions";
  return "hidden";
}

export function isIosUserAgent(userAgent: string) {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  if (userAgent.includes("Mac") && "ontouchstart" in globalThis) return true;
  return false;
}

export function isMobileUserAgent(userAgent: string) {
  return /Android|iPad|iPhone|iPod|Mobile/i.test(userAgent);
}
