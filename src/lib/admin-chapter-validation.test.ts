import assert from "node:assert/strict";
import test from "node:test";
import { chapterSchema } from "./admin-chapter-validation";

const baseChapter = {
  volumeId: "volume-1",
  position: 1,
  positionEnd: 10,
  contentType: "AUDIO" as const,
  durationSec: 600,
  audioUrl: "https://cdn.example.com/audio.mp3",
  youtubeUrl: "",
  coverUrl: "",
  startSec: 0,
  chapterParts: [],
  transcriptJson: "[]",
  premiumOnly: true,
  published: true,
};

test("aceita titulo longo gerado por capitulos em bloco", () => {
  const title = Array.from({ length: 10 }, (_, index) => `Capitulo ${index + 1} com titulo maior`).join(", ");

  assert.equal(title.length > 180, true);
  assert.equal(chapterSchema.safeParse({ ...baseChapter, title }).success, true);
});
