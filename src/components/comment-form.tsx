"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { CommentSpoilerHint } from "./comment-spoiler-hint";

type CommentFormProps = {
  target: "novel" | "chapter";
  targetId: string;
  isLoggedIn: boolean;
  parentId?: string;
  compact?: boolean;
};

export function CommentForm({ target, targetId, isLoggedIn, parentId, compact = false }: CommentFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          novelId: target === "novel" ? targetId : undefined,
          chapterId: target === "chapter" ? targetId : undefined,
          parentId,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel publicar o comentario.");
        return;
      }

      setBody("");
      setMessage(parentId ? "Resposta enviada para moderacao." : "Comentario enviado para moderacao.");
      router.refresh();
    });
  }

  if (!isLoggedIn) {
    return (
      <div className="mb-4 rounded-md border border-white/10 bg-[#06272b] p-4 text-sm text-zinc-300">
        <Link href="/login" className="font-bold text-[#18b7bd]">
          Entre na sua conta
        </Link>{" "}
        para comentar.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 grid gap-3 rounded-md border border-white/10 bg-[#06272b] p-4">
      <label className="text-sm font-bold text-zinc-300" htmlFor={`${target}-comment-${parentId ?? "root"}`}>
        {parentId ? "Responder comentario" : "Escrever comentario"}
      </label>
      <textarea
        id={`${target}-comment-${parentId ?? "root"}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        minLength={2}
        maxLength={1200}
        required
        rows={compact ? 3 : 4}
        placeholder={parentId ? "Escreva sua resposta..." : "Compartilhe sua opiniao..."}
        className="resize-y rounded-md border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#18b7bd]"
      />
      <CommentSpoilerHint />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${message.includes("moderacao") ? "text-[#18b7bd]" : "text-red-300"}`}>{message}</p>
        <button type="submit" disabled={pending || body.trim().length < 2} className="rounded-full bg-[#18b7bd] px-5 py-2 font-black text-[#021114] disabled:opacity-50">
          {pending ? "Publicando..." : parentId ? "Responder" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
