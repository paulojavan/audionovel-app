"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type PlanFormData = {
  id?: string;
  name: string;
  description: string;
  amountCents: number;
  currency: string;
  interval: string;
  active: boolean;
  allowCard: boolean;
  allowPix: boolean;
  sortOrder: number;
};

const blankPlan: PlanFormData = {
  name: "",
  description: "",
  amountCents: 1990,
  currency: "brl",
  interval: "month",
  active: true,
  allowCard: true,
  allowPix: false,
  sortOrder: 0,
};

export function AdminPlanForm({ plan }: { plan?: PlanFormData }) {
  const router = useRouter();
  const [form, setForm] = useState(plan ?? blankPlan);
  const [amount, setAmount] = useState(((plan?.amountCents ?? blankPlan.amountCents) / 100).toFixed(2));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const editing = Boolean(plan?.id);

  function updateField<Key extends keyof PlanFormData>(key: Key, value: PlanFormData[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    const payload = { ...form, amountCents };

    startTransition(async () => {
      const response = await fetch(editing ? `/api/admin/plans/${plan?.id}` : "/api/admin/plans", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responsePayload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(responsePayload.error ?? "Nao foi possivel salvar o plano.");
        return;
      }

      setMessage(editing ? "Plano atualizado." : "Plano cadastrado.");
      if (!editing) {
        setForm(blankPlan);
        setAmount((blankPlan.amountCents / 100).toFixed(2));
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-white/10 bg-[#06272b] p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_140px]">
        <label className="grid gap-1 text-sm font-bold text-zinc-300">
          Nome
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
            className="rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-zinc-300">
          Valor
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            required
            className="rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold text-zinc-300">
          Periodo
          <select
            value={form.interval}
            onChange={(event) => updateField("interval", event.target.value)}
            className="rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
          >
            <option value="month">Mensal</option>
            <option value="year">Anual</option>
          </select>
        </label>
      </div>

      <label className="grid gap-1 text-sm font-bold text-zinc-300">
        Descricao
        <textarea
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          maxLength={240}
          rows={2}
          className="resize-y rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-[120px]">
        <label className="grid gap-1 text-sm font-bold text-zinc-300">
          Ordem
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(event) => updateField("sortOrder", Number(event.target.value))}
            className="rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 text-sm font-bold text-zinc-300">
        <Toggle checked={form.active} onChange={(value) => updateField("active", value)} label="Plano ativo" />
        <Toggle checked={form.allowCard} onChange={(value) => updateField("allowCard", value)} label="Aceitar cartao" />
        <Toggle checked={form.allowPix} onChange={(value) => updateField("allowPix", value)} label="Aceitar Pix" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${message.includes("Plano") ? "text-[#b8fbff]" : "text-red-300"}`}>{message}</p>
        <button type="submit" disabled={pending} className="rounded-full bg-[#18b7bd] px-5 py-2 font-black text-[#021114] disabled:opacity-60">
          {pending ? "Salvando..." : editing ? "Salvar plano" : "Cadastrar plano"}
        </button>
      </div>
    </form>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#18b7bd]" />
      {label}
    </label>
  );
}
