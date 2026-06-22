"use client";

import Image from "next/image";
import { Download, RefreshCw, Share2, Smartphone, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getPwaInstallPromptState, isIosUserAgent } from "@/lib/pwa-install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSED_KEY = "audio-novel-br-install-dismissed";

export function PwaLifecycle() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

      setIsStandalone(standalone);
      setIsIos(isIosUserAgent(navigator.userAgent));
      setInstallDismissed(localStorage.getItem(INSTALL_DISMISSED_KEY) === "1");
      setMounted(true);
    });

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setPromptEvent(null);
      setIsStandalone(true);
    };
    const handleUpdateAvailable = () => setUpdateAvailable(true);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("pwa-update-available", handleUpdateAvailable);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("pwa-update-available", handleUpdateAvailable);
    };
  }, []);

  const installState = useMemo(
    () =>
      getPwaInstallPromptState({
        isIos,
        isStandalone,
        hasNativeInstallPrompt: Boolean(promptEvent),
        dismissed: installDismissed,
      }),
    [installDismissed, isIos, isStandalone, promptEvent],
  );

  if (!mounted) return null;

  if (updateAvailable) {
    return (
      <PwaNotice
        icon={<RefreshCw size={20} />}
        title="Nova versao disponivel"
        body="Atualize para carregar as melhorias mais recentes."
        actionLabel="Atualizar app"
        onAction={activateWaitingServiceWorker}
        onDismiss={() => setUpdateAvailable(false)}
      />
    );
  }

  if (installState === "native-prompt") {
    return (
      <PwaNotice
        icon={<Download size={20} />}
        title="Instale o Audio Novel BR"
        body="Abra como app, com acesso rapido pela tela inicial."
        actionLabel="Instalar"
        onAction={async () => {
          if (!promptEvent) return;
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          setPromptEvent(null);
          if (choice.outcome === "dismissed") dismissInstallPrompt(setInstallDismissed);
        }}
        onDismiss={() => dismissInstallPrompt(setInstallDismissed)}
      />
    );
  }

  if (installState === "ios-instructions") {
    return (
      <PwaNotice
        icon={<Smartphone size={20} />}
        title="Adicione a tela de inicio"
        body="No Safari, toque em Compartilhar e depois em Adicionar a Tela de Inicio."
        actionLabel="Entendi"
        onAction={() => dismissInstallPrompt(setInstallDismissed)}
        onDismiss={() => dismissInstallPrompt(setInstallDismissed)}
        secondaryIcon={<Share2 size={16} />}
      />
    );
  }

  return null;
}

function PwaNotice({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  onDismiss,
  secondaryIcon,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void | Promise<void>;
  onDismiss: () => void;
  secondaryIcon?: ReactNode;
}) {
  return (
    <aside className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 mx-auto max-w-xl rounded-lg border border-[#18b7bd]/40 bg-[#03191c]/95 p-3 text-white shadow-2xl shadow-black/40 backdrop-blur md:bottom-6 md:right-6 md:left-auto md:mx-0 md:w-[26rem]">
      <div className="flex gap-3">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-[#06272b] ring-1 ring-[#18b7bd]/40">
          <Image src="/icons/icon-192x192.png" alt="" width={48} height={48} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-[#22d3dc]">{icon}</span>
            <div className="min-w-0">
              <h2 className="text-sm font-black leading-tight">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-300">{body}</p>
            </div>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={onDismiss}
              className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <X size={17} />
            </button>
          </div>
          <button
            type="button"
            onClick={onAction}
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#18b7bd] px-4 py-2 text-sm font-black text-[#021114] hover:bg-[#22d3dc]"
          >
            {secondaryIcon}
            {actionLabel}
          </button>
        </div>
      </div>
    </aside>
  );
}

function dismissInstallPrompt(setInstallDismissed: (value: boolean) => void) {
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  setInstallDismissed(true);
}

async function activateWaitingServiceWorker() {
  const registration = await navigator.serviceWorker?.getRegistration();
  registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
}
