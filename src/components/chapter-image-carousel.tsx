"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

export function ChapterImageCarousel({ images, chapterTitle }: { images: string[]; chapterTitle: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;

  function goTo(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nextIndex = Math.max(0, Math.min(index, images.length - 1));
    scroller.scrollTo({ left: nextIndex * scroller.clientWidth, behavior: "smooth" });
    setActiveIndex(nextIndex);
  }

  return (
    <section aria-label={`Imagens de ${chapterTitle}`} className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-[#06272b] p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <h2 className="text-xl font-bold">Imagens do capítulo</h2>
        <span className="text-sm text-zinc-300" aria-live="polite">{activeIndex + 1} de {images.length}</span>
      </div>
      <div
        ref={scrollerRef}
        className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-lg bg-black touch-pan-x motion-safe:scroll-smooth"
        onScroll={(event) => {
          const scroller = event.currentTarget;
          if (scroller.clientWidth > 0) {
            setActiveIndex(Math.min(images.length - 1, Math.round(scroller.scrollLeft / scroller.clientWidth)));
          }
        }}
      >
        {images.map((src, index) => (
          <figure key={`${src}-${index}`} className="relative aspect-[4/3] w-full shrink-0 snap-center sm:aspect-video">
            <Image
              src={src}
              alt={`Ilustração ${index + 1} do capítulo ${chapterTitle}`}
              fill
              sizes="(min-width: 768px) calc(100vw - 320px), 100vw"
              className="object-contain"
            />
          </figure>
        ))}
      </div>
      {images.length > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Imagem anterior"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={21} aria-hidden="true" />
          </button>
          <div className="flex flex-wrap justify-center gap-2" aria-label="Selecionar imagem">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Ir para imagem ${index + 1}`}
                aria-current={activeIndex === index ? "true" : undefined}
                className={`h-3 w-3 rounded-full transition ${activeIndex === index ? "bg-[#18b7bd]" : "bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex === images.length - 1}
            aria-label="Próxima imagem"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={21} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
