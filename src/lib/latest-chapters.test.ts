import assert from "node:assert/strict";
import { test } from "node:test";
import { formatLaunchAge, groupLatestChapters } from "./latest-chapters";

const novelA = { id: "a", title: "Novel A", slug: "novel-a", coverUrl: "https://example.com/a.jpg" };
const novelB = { id: "b", title: "Novel B", slug: "novel-b", coverUrl: "https://example.com/b.jpg" };

test("groupLatestChapters agrupa por novel sem perder a ordem global", () => {
  const groups = groupLatestChapters([
    {
      id: "a2",
      title: "A2",
      position: 2,
      positionEnd: null,
      premiumOnly: false,
      createdAt: new Date("2026-06-29T12:00:00Z"),
      volume: { title: "V1", position: 1, novel: novelA },
    },
    {
      id: "b1",
      title: "B1",
      position: 1,
      positionEnd: null,
      premiumOnly: true,
      createdAt: new Date("2026-06-29T11:00:00Z"),
      volume: { title: "V1", position: 1, novel: novelB },
    },
    {
      id: "a1",
      title: "A1",
      position: 1,
      positionEnd: null,
      premiumOnly: false,
      createdAt: new Date("2026-06-29T10:00:00Z"),
      volume: { title: "V1", position: 1, novel: novelA },
    },
  ]);

  assert.deepEqual(groups.map((group) => group.novel.id), ["a", "b"]);
  assert.deepEqual(groups[0].chapters.map((chapter) => chapter.id), ["a2", "a1"]);
  assert.equal(groups[1].chapters[0].premiumOnly, true);
});

test("formatLaunchAge usa horas e dias em portugues", () => {
  const now = new Date("2026-06-29T12:00:00Z");

  assert.equal(formatLaunchAge(new Date("2026-06-29T10:00:00Z"), now), "há 2 horas");
  assert.equal(formatLaunchAge(new Date("2026-06-28T12:00:00Z"), now), "há 1 dia");
});

test("formatLaunchAge aceita data serializada pelo cache do Next", () => {
  const now = new Date("2026-06-29T12:00:00Z");

  assert.equal(formatLaunchAge("2026-06-29T10:00:00.000Z", now), "há 2 horas");
});
