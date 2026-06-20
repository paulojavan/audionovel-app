"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type StarRatingProps = {
  novelId: string;
  average: number;
  count: number;
  userRating?: number | null;
  isLoggedIn: boolean;
};

export function StarRating({ novelId, average, count, userRating, isLoggedIn }: StarRatingProps) {
  const router = useRouter();
  const [hoveredRating, setHoveredRating] = useState(0);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const activeRating = hoveredRating || userRating || Math.round(average);

  function rate(rating: number) {
    if (!isLoggedIn) {
      setMessage("Entre para avaliar.");
      return;
    }

    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "novel", targetId: novelId, rating }),
      });

      if (!response.ok) {
        setMessage("Nao foi possivel salvar sua nota.");
        return;
      }

      setMessage("Nota salva.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1" onMouseLeave={() => setHoveredRating(0)}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              disabled={pending}
              onClick={() => rate(rating)}
              onMouseEnter={() => setHoveredRating(rating)}
              className="rounded-full p-1 text-yellow-300 transition hover:scale-110 disabled:opacity-60"
              aria-label={`Avaliar com ${rating} estrelas`}
            >
              <Star size={24} fill={rating <= activeRating ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
        <span className="text-sm font-bold text-zinc-300">
          {average > 0 ? average.toFixed(1) : "Sem notas"} {count ? `(${count})` : ""}
        </span>
      </div>
      {message ? <p className={`text-sm ${message.includes("salva") ? "text-[#b8fbff]" : "text-yellow-200"}`}>{message}</p> : null}
    </div>
  );
}
