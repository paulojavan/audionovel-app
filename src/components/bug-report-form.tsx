"use client";

import { Bug } from "lucide-react";
import { FormEvent, useState, useTransition } from "react";

export function BugReportForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const currentPageUrl = pageUrl.trim() || `${window.location.pathname}${window.location.search}`;

    startTransition(async () => {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, pageUrl: currentPageUrl }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel enviar o reporte.");
        return;
      }

      setTitle("");
      setDescription("");
      setMessage("Reporte enviado. Obrigado por ajudar a melhorar o app.");
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg bg-[#06272b] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#18b7bd] text-[#021114]">
          <Bug size={20} />
        </span>
        <div>
          <h2 className="text-2xl font-black">Reportar bug</h2>
          <p className="text-sm text-zinc-400">Conte o que aconteceu para a equipe investigar.</p>
        </div>
      </div>

      <label className="grid gap-1 text-sm font-bold text-zinc-300">
        Titulo
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          minLength={3}
          maxLength={120}
          required
          className="rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
        />
      </label>

      <label className="grid gap-1 text-sm font-bold text-zinc-300">
        Descricao
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          minLength={10}
          maxLength={4000}
          rows={8}
          required
          className="resize-y rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
        />
      </label>

      <label className="grid gap-1 text-sm font-bold text-zinc-300">
        Pagina relacionada
        <input
          value={pageUrl}
          onChange={(event) => setPageUrl(event.target.value)}
          maxLength={500}
          placeholder="Preenchido automaticamente se ficar vazio"
          className="rounded-md border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-[#18b7bd]"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${message.startsWith("Reporte enviado") ? "text-[#b8fbff]" : "text-red-300"}`}>{message}</p>
        <button type="submit" disabled={pending} className="rounded-full bg-[#18b7bd] px-5 py-2 font-black text-[#021114] disabled:opacity-60">
          {pending ? "Enviando..." : "Enviar reporte"}
        </button>
      </div>
    </form>
  );
}
