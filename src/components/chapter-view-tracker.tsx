"use client";

import { useEffect, useRef } from "react";

export function ChapterViewTracker({ chapterId }: { chapterId: string }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    void fetch(`/api/chapters/${encodeURIComponent(chapterId)}/view`, {
      method: "POST",
      keepalive: true,
    });
  }, [chapterId]);

  return null;
}
