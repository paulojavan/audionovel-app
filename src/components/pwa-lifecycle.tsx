"use client";

import Image from "next/image";
import { CheckCircle, Download, RefreshCw, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPwaInstallPromptState, isIosUserAgent, isMobileUserAgent } from "@/lib/pwa-install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSED_KEY = "audio-novel-br-install-dismissed";
const INSTALL_DISMISSED_UNTIL_KEY = "audio-novel-br-install-dismissed-until";

// Duração de supressão quando usuário descarta: 3 dias
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

export function PwaLifecycle() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

      setIsStandalone(standalone);
      setIsIos(isIosUserAgent(navigator.userAgent));
      setIsMobile(isMobileUserAgent(navigator.userAgent));

      // Verificar supressão temporizada
      const dismissedUntil = localStorage.getItem(INSTALL_DISMISSED_UNTIL_KEY);
      const permanentDismiss = localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
      const tempDismissed = dismissedUntil ? Date.now() < Number(dismissedUntil) : false;
      setInstallDismissed(permanentDismiss || tempDismissed);

      setMounted(true);
    });

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setPromptEvent(null);
      setIsStandalone(true);
      setInstalled(true);
      // Mostrar confirmação brevemente
      dismissTimerRef.current = setTimeout(() => setInstalled(false), 4000);
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
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const installState = useMemo(
    () =>
      getPwaInstallPromptState({
        isIos,
        isMobile,
        isStandalone,
        hasNativeInstallPrompt: Boolean(promptEvent),
        dismissed: installDismissed,
      }),
    [installDismissed, isIos, isMobile, isStandalone, promptEvent],
  );

  if (!mounted) return null;

  // ── App instalado com sucesso ────────────────────────────────────────────
  if (installed) {
    return (
      <PwaNotice
        variant="success"
        icon={<CheckCircle size={20} />}
        title="App instalado!"
        body="Audio Novel BR está na sua tela inicial. Aproveite!"
        actionLabel="Fechar"
        onAction={() => setInstalled(false)}
        onDismiss={() => setInstalled(false)}
      />
    );
  }

  // ── Atualização disponível ───────────────────────────────────────────────
  if (updateAvailable) {
    return (
      <PwaNotice
        variant="update"
        icon={<RefreshCw size={20} />}
        title="Nova versão disponível"
        body="Reinicie para carregar as melhorias mais recentes do Audio Novel BR."
        actionLabel="Atualizar agora"
        onAction={activateWaitingServiceWorker}
        onDismiss={() => setUpdateAvailable(false)}
      />
    );
  }

  // ── Prompt nativo (Chrome Android) ──────────────────────────────────────
  if (installState === "native-prompt") {
    return (
      <PwaNotice
        variant="install"
        icon={<Download size={20} />}
        title="Instale o Audio Novel BR"
        body="Abra como app nativo com acesso rápido pela tela inicial, sem usar o navegador."
        actionLabel="Instalar grátis"
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

  // ── Instruções iOS (Safari) ──────────────────────────────────────────────
  if (installState === "ios-instructions") {
    return (
      <IosInstallGuide onDismiss={() => dismissInstallPrompt(setInstallDismissed)} />
    );
  }

  // ── Instruções Chrome Android (fallback) ────────────────────────────────
  if (installState === "browser-instructions") {
    return (
      <PwaNotice
        variant="install"
        icon={<Download size={20} />}
        title="Instale o Audio Novel BR"
        body={
          <>
            No Chrome Android, abra o <strong>menu (⋮)</strong> e toque em{" "}
            <strong>Instalar app</strong> ou{" "}
            <strong>Adicionar à tela inicial</strong>.
          </>
        }
        actionLabel="Entendi"
        onAction={() => dismissInstallPrompt(setInstallDismissed)}
        onDismiss={() => dismissInstallPrompt(setInstallDismissed)}
      />
    );
  }

  return null;
}

// ─── PwaNotice ────────────────────────────────────────────────────────────────
type NoticeVariant = "install" | "update" | "success";

function PwaNotice({
  variant = "install",
  icon,
  title,
  body,
  actionLabel,
  onAction,
  onDismiss,
}: {
  variant?: NoticeVariant;
  icon: ReactNode;
  title: string;
  body: ReactNode;
  actionLabel: string;
  onAction: () => void | Promise<void>;
  onDismiss: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleAction = async () => {
    setActing(true);
    try {
      await onAction();
    } finally {
      setActing(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  const accentColor =
    variant === "success"
      ? "#22c55e"
      : variant === "update"
        ? "#f59e0b"
        : "#18b7bd";

  return (
    <aside
      role="dialog"
      aria-live="polite"
      aria-label={title}
      style={{
        transform: visible ? "translateY(0)" : "translateY(120%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
      }}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-[#03191c]/96 p-4 text-white shadow-2xl shadow-black/60 backdrop-blur-xl md:bottom-6 md:right-6 md:left-auto md:mx-0 md:w-[22rem]"
    >
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-30"
        style={{
          background: `linear-gradient(135deg, ${accentColor}40 0%, transparent 60%)`,
        }}
      />

      <div className="relative flex gap-3">
        {/* App icon */}
        <div
          className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl"
          style={{ outline: `1px solid ${accentColor}50` }}
        >
          <Image
            src="/icons/icon-192x192.png"
            alt="Audio Novel BR"
            width={56}
            height={56}
            className="h-full w-full object-cover"
            priority
          />
          {/* Colored badge icon overlay */}
          <span
            className="absolute bottom-0.5 right-0.5 grid h-5 w-5 place-items-center rounded-full text-white"
            style={{ background: accentColor }}
          >
            <span style={{ transform: "scale(0.7)", display: "grid" }}>{icon}</span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
                Audio Novel BR
              </p>
              <h2 className="mt-0.5 text-sm font-black leading-tight text-white">{title}</h2>
            </div>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={handleDismiss}
              className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">{body}</p>

          <button
            type="button"
            onClick={handleAction}
            disabled={acting}
            className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-black text-[#021114] transition-all active:scale-95 disabled:opacity-70"
            style={{ background: accentColor }}
          >
            {acting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#021114]/30 border-t-[#021114]" />
                <span>Aguarde...</span>
              </>
            ) : (
              actionLabel
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── IosInstallGuide ─────────────────────────────────────────────────────────
function IosInstallGuide({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  const steps = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      ),
      label: 'Toque em "Compartilhar"',
      desc: "Botão na barra inferior do Safari",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
      label: '"Adicionar à Tela de Início"',
      desc: "Role a lista de ações e toque na opção",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      label: 'Toque em "Adicionar"',
      desc: "Confirme no canto superior direito",
    },
  ];

  return (
    <aside
      role="dialog"
      aria-live="polite"
      aria-label="Como instalar no iOS"
      style={{
        transform: visible ? "translateY(0)" : "translateY(120%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
      }}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-[#03191c]/96 p-4 text-white shadow-2xl shadow-black/60 backdrop-blur-xl md:bottom-6 md:right-6 md:left-auto md:mx-0 md:w-[22rem]"
    >
      {/* iOS blue accent */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-blue-500/20 to-transparent opacity-60" />

      <div className="relative">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl">
            <Image
              src="/icons/icon-192x192.png"
              alt="Audio Novel BR"
              width={40}
              height={40}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
              Instalar no iOS
            </p>
            <h2 className="text-sm font-black leading-tight">Adicione à Tela de Início</h2>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={handleDismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        {/* Steps */}
        <div className="mb-3 space-y-2">
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                step === i
                  ? "bg-blue-500/15 ring-1 ring-blue-400/30"
                  : "opacity-60 hover:opacity-100 hover:bg-white/5"
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                  step === i ? "bg-blue-500 text-white" : "bg-white/10 text-zinc-400"
                }`}
              >
                {s.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black leading-tight">{s.label}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">{s.desc}</p>
              </div>
              <span
                className={`ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                  step === i ? "bg-blue-500 text-white" : "bg-white/10 text-zinc-500"
                }`}
              >
                {i + 1}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 rounded-full bg-blue-500 py-2.5 text-sm font-black text-white transition-all active:scale-95"
            >
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 rounded-full bg-blue-500 py-2.5 text-sm font-black text-white transition-all active:scale-95"
            >
              ✓ Entendi
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dismissInstallPrompt(setInstallDismissed: (value: boolean) => void) {
  // Suprime por 3 dias (não permanente)
  const until = Date.now() + DISMISS_DURATION_MS;
  localStorage.setItem(INSTALL_DISMISSED_UNTIL_KEY, String(until));
  setInstallDismissed(true);
}

async function activateWaitingServiceWorker() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  } catch {
    window.location.reload();
  }
}
