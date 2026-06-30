"use client";

import type { ChapterPart } from "@/lib/chapter-grouping";
import { getChapterPartSeekDetail } from "@/lib/chapter-playback";

export function ChapterPartLinks({ parts }: { parts: ChapterPart[] }) {
  function seekToPart(part: ChapterPart) {
    window.dispatchEvent(
      new CustomEvent("audio-novel-seek", {
        detail: getChapterPartSeekDetail(part),
      }),
    );
    document.getElementById("chapter-player")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mt-3 grid max-w-4xl gap-2">
      {parts.map((part) => (
        <button
          key={`${part.position}-${part.startSec}`}
          type="button"
          onClick={() => seekToPart(part)}
          className="min-h-12 rounded-md bg-black/35 px-4 py-3 text-left text-2xl font-black leading-tight text-white ring-1 ring-white/10 hover:bg-[#021114] hover:text-[#18b7bd] focus:outline-none focus:ring-2 focus:ring-white md:text-4xl"
        >
          Cap. {part.position} - {part.title}
        </button>
      ))}
    </div>
  );
}
