"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SystemSettings } from "@/lib/system-settings";

type AdminSystemSettingsFormProps = {
  initialSettings: SystemSettings;
};

export function AdminSystemSettingsForm({ initialSettings }: AdminSystemSettingsFormProps) {
  const router = useRouter();
  const [registrationsEnabled, setRegistrationsEnabled] = useState(initialSettings.registrationsEnabled);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(initialSettings.subscriptionsEnabled);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function saveSettings() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationsEnabled, subscriptionsEnabled }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel salvar as configuracoes.");
        return;
      }

      setMessage("Configuracoes salvas.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <SettingToggle
        title="Novos cadastros"
        description="Quando desativado, novos usuarios nao conseguem criar conta por e-mail. Usuarios existentes continuam podendo entrar."
        checked={registrationsEnabled}
        onChange={setRegistrationsEnabled}
        enabledLabel="Cadastros ativos"
        disabledLabel="Cadastros bloqueados"
      />
      <SettingToggle
        title="Compras de assinaturas"
        description="Quando desativado, o botao de contratar premium fica indisponivel e a API de checkout tambem bloqueia novas compras."
        checked={subscriptionsEnabled}
        onChange={setSubscriptionsEnabled}
        enabledLabel="Compras ativas"
        disabledLabel="Compras bloqueadas"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={saveSettings}
          className="rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar configuracoes"}
        </button>
        {message ? <p className={`text-sm ${message.includes("salvas") ? "text-[#b8fbff]" : "text-red-300"}`}>{message}</p> : null}
      </div>
    </div>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  onChange,
  enabledLabel,
  disabledLabel,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  enabledLabel: string;
  disabledLabel: string;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#06272b] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h3 className="text-lg font-black">{title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-8 w-16 rounded-full transition ${checked ? "bg-[#18b7bd]" : "bg-red-500/80"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${checked ? "left-9" : "left-1"}`} />
        </button>
      </div>
      <p className={`mt-3 text-sm font-bold ${checked ? "text-[#b8fbff]" : "text-red-200"}`}>{checked ? enabledLabel : disabledLabel}</p>
    </section>
  );
}
