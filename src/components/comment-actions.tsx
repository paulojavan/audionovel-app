"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { CommentForm } from "./comment-form";

type CommentActionsProps = {
  target: "novel" | "chapter";
  targetId: string;
  commentId: string;
  body: string;
  isLoggedIn: boolean;
  canEdit: boolean;
  allowReply?: boolean;
};

export function CommentActions({ target, targetId, commentId, body, isLoggedIn, canEdit, allowReply = true }: CommentActionsProps) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState(body);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel editar o comentario.");
        return;
      }

      setEditOpen(false);
      setMessage("Comentario editado e enviado para moderacao.");
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-3">
        {allowReply ? (
          <button
            type="button"
            onClick={() => {
              setReplyOpen((value) => !value);
              setEditOpen(false);
            }}
            className="text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-white"
          >
            Responder
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setEditOpen((value) => !value);
              setReplyOpen(false);
            }}
            className="text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-white"
          >
            Editar
          </button>
        ) : null}
        {message ? <span className="text-xs text-[#18b7bd]">{message}</span> : null}
      </div>

      {replyOpen && allowReply ? (
        <div className="mt-3">
          <CommentForm target={target} targetId={targetId} isLoggedIn={isLoggedIn} parentId={commentId} compact />
        </div>
      ) : null}

      {editOpen ? (
        <form onSubmit={submitEdit} className="mt-3 grid gap-2 rounded-md border border-white/10 bg-black/40 p-3">
          <textarea
            value={editBody}
            onChange={(event) => setEditBody(event.target.value)}
            minLength={2}
            maxLength={1200}
            rows={3}
            className="resize-y rounded-md border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#18b7bd]"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setEditOpen(false)} className="rounded-full px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/10">
              Cancelar
            </button>
            <button disabled={pending || editBody.trim().length < 2} className="rounded-full bg-[#18b7bd] px-4 py-2 text-sm font-black text-[#021114] disabled:opacity-60">
              {pending ? "Salvando..." : "Salvar edicao"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
