export type LatestChapterItem = {
  id: string;
  title: string;
  position: number;
  positionEnd: number | null;
  premiumOnly: boolean;
  createdAt: Date | string;
  volume: {
    title: string;
    position: number;
    novel: {
      id: string;
      title: string;
      slug: string;
      coverUrl: string;
    };
  };
};

export function groupLatestChapters(chapters: LatestChapterItem[]) {
  const groups = new Map<
    string,
    {
      novel: LatestChapterItem["volume"]["novel"];
      chapters: LatestChapterItem[];
    }
  >();

  for (const chapter of chapters) {
    const novel = chapter.volume.novel;
    const group = groups.get(novel.id) ?? { novel, chapters: [] };
    group.chapters.push(chapter);
    groups.set(novel.id, group);
  }

  return Array.from(groups.values());
}

export function formatLaunchAge(createdAt: Date | string, now = new Date()) {
  const createdAtDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const hours = Math.max(
    0,
    Math.floor((now.getTime() - createdAtDate.getTime()) / 3_600_000),
  );

  if (hours < 24) {
    return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
