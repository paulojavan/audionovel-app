"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AdminCommentModerationActionsProps = {
  commentId: string;
  showRemove?: boolean;
};

export function AdminCommentModerationActions({ commentId, showRemove = true }: AdminCommentModerationActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function moderate(action: "APPROVE" | "REMOVE") {
    setMessage("");

    startTransition(async () => {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel moderar o comentario.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {message ? <span className="text-xs text-red-300">{message}</span> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => moderate("APPROVE")}
        className="rounded-full bg-[#18b7bd] px-4 py-2 text-sm font-black text-[#021114] disabled:opacity-60"
      >
        Aprovar
      </button>
      {showRemove ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => moderate("REMOVE")}
          className="rounded-full bg-red-500/90 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
        >
          Remover
        </button>
      ) : null}
    </div>
  );
}
