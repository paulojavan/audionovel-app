"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import {
  isMobileUserAgent,
  isPwaInstalled,
} from "@/lib/pwa-install";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function PwaInstallMenuItem({
  variant,
}: {
  variant: "sidebar" | "mobile";
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
    let nativePromptAvailable = false;

    function syncVisibility() {
      const installed = isPwaInstalled({
        standalone: standaloneQuery.matches,
        fullscreen: fullscreenQuery.matches,
        iosStandalone: Boolean((navigator as NavigatorWithStandalone).standalone),
      });
      setVisible(
        !installed &&
          (nativePromptAvailable || isMobileUserAgent(navigator.userAgent)),
      );
    }

    const handleBeforeInstallPrompt = () => {
      nativePromptAvailable = true;
      syncVisibility();
    };
    const handleInstalled = () => setVisible(false);

    syncVisibility();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    standaloneQuery.addEventListener("change", syncVisibility);
    fullscreenQuery.addEventListener("change", syncVisibility);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      standaloneQuery.removeEventListener("change", syncVisibility);
      fullscreenQuery.removeEventListener("change", syncVisibility);
    };
  }, []);

  if (!visible) return null;

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={requestPwaInstall}
        className="relative flex min-h-14 min-w-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-black text-zinc-300 hover:bg-white/10"
      >
        <Download size={19} />
        <span>Instalar app</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={requestPwaInstall}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-white/10"
    >
      <Download size={18} /> Instalar app
    </button>
  );
}

function requestPwaInstall() {
  window.dispatchEvent(new CustomEvent("pwa-install-requested"));
}
