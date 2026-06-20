"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useState, useTransition } from "react";

type FavoriteNovelButtonProps = {
  novelId: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
};

export function FavoriteNovelButton({ novelId, initialFavorited, isLoggedIn }: FavoriteNovelButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
        <Heart size={18} /> Entrar para favoritar
      </Link>
    );
  }

  function toggleFavorite() {
    startTransition(async () => {
      setMessage("");
      const nextFavorited = !favorited;
      const response = await fetch("/api/favorites", {
        method: nextFavorited ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel atualizar os favoritos.");
        return;
      }

      setFavorited(nextFavorited);
    });
  }

  return (
    <div className="grid justify-items-start gap-1">
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black disabled:opacity-60 ${
          favorited ? "bg-[#18b7bd] text-[#021114] hover:bg-[#22d3dc]" : "border border-white/15 text-white hover:bg-white/10"
        }`}
      >
        <Heart size={18} fill={favorited ? "currentColor" : "none"} />
        {favorited ? "Favoritada" : "Favoritar"}
      </button>
      {message ? <span className="text-xs text-red-200">{message}</span> : null}
    </div>
  );
}
