import assert from "node:assert/strict";
import test from "node:test";
import { chapterSchema } from "./admin-chapter-validation";

const baseChapter = {
  volumeId: "volume-1",
  title: "Capitulo teste",
  position: 1,
  positionEnd: 10,
  contentType: "AUDIO" as const,
  durationSec: 600,
  audioUrl: "https://pub-975120676aa7420e9b84ddf23e7919b5.r2.dev/audio.mp3",
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

test("aceita capitulo zero sem fim de intervalo", () => {
  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: 0, positionEnd: null }).success, true);
});

test("aceita posicao decimal", () => {
  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: 8.5 }).success, true);
});

test("rejeita posicao negativa", () => {
  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: -0.5 }).success, false);
});
