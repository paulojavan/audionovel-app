"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTransition } from "react";

export function ReactionButtons({
  target,
  targetId,
  likes,
  dislikes,
}: {
  target: "chapter";
  targetId: string;
  likes: number;
  dislikes: number;
}) {
  const [pending, startTransition] = useTransition();

  function react(type: "LIKE" | "DISLIKE") {
    startTransition(async () => {
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, targetId, type }),
      });
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => react("LIKE")} className="flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
        <ThumbsUp size={16} /> {likes}
      </button>
      <button type="button" disabled={pending} onClick={() => react("DISLIKE")} className="flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20">
        <ThumbsDown size={16} /> {dislikes}
      </button>
    </div>
  );
}
