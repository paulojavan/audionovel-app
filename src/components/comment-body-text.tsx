"use client";

import { useState } from "react";
import { parseCommentSpoilers } from "@/lib/comment-spoilers";

export function CommentBodyText({ body }: { body: string }) {
  const segments = parseCommentSpoilers(body);

  return (
    <p className="mt-1 whitespace-pre-wrap text-zinc-300">
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <span key={`text-${index}`}>{segment.content}</span>
        ) : (
          <SpoilerText key={`spoiler-${index}-${segment.content}`} content={segment.content} />
        ),
      )}
    </p>
  );
}

function SpoilerText({ content }: { content: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <button
      type="button"
      aria-expanded={revealed}
      onClick={() => setRevealed(true)}
      className={`mx-1 inline rounded-md border px-2 py-0.5 text-left align-baseline transition ${
        revealed
          ? "border-[#18b7bd]/40 bg-[#18b7bd]/10 text-zinc-200"
          : "border-white/15 bg-black text-xs font-bold text-zinc-400 hover:border-[#18b7bd]/50 hover:text-white"
      }`}
    >
      {revealed ? content : "Spoiler — clique para revelar"}
    </button>
  );
}
