import Image from "next/image";
import { getNovelStatusLabel } from "@/lib/novel-status";

export function NovelStatusCover({
  src,
  title,
  status,
  className,
  sizes,
  compact = false,
}: {
  src: string;
  title: string;
  status: string;
  className: string;
  sizes: string;
  compact?: boolean;
}) {
  const label = getNovelStatusLabel(status);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src} alt={`Capa de ${title}`} fill sizes={sizes} className="object-cover" />
      <span
        className={
          compact
            ? "absolute bottom-1 left-1 right-1 truncate rounded bg-[#18b7bd] px-1 py-0.5 text-center text-[8px] font-black uppercase leading-none text-[#021114] shadow shadow-black/30"
            : "absolute right-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-[#18b7bd] px-2.5 py-1 text-xs font-black uppercase text-[#021114] shadow-lg shadow-black/30"
        }
      >
        {label}
      </span>
    </div>
  );
}
