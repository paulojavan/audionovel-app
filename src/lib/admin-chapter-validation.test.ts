import assert from "node:assert/strict";
import test from "node:test";
import { chapterBatchSchema, chapterSchema } from "./admin-chapter-validation";

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
  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: 8.5, positionEnd: null }).success, true);
});

test("rejeita partes agrupadas com posicao decimal", () => {
  const chapterParts = [
    { position: 8, title: "Capitulo 8", startSec: 0, endSec: 60 },
    { position: 8.5, title: "Capitulo 8.5", startSec: 60, endSec: 120 },
    { position: 9, title: "Capitulo 9", startSec: 120, endSec: 180 },
  ];

  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: 8, chapterParts }).success, false);
});

test("aceita partes agrupadas com posicoes inteiras consecutivas", () => {
  const chapterParts = [
    { position: 8, title: "Capitulo 8", startSec: 0, endSec: 60 },
    { position: 9, title: "Capitulo 9", startSec: 60, endSec: 120 },
    { position: 10, title: "Capitulo 10", startSec: 120, endSec: 180 },
  ];

  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: 8, chapterParts }).success, true);
});

test("rejeita partes agrupadas com lacuna na sequencia", () => {
  const chapterParts = [
    { position: 8, title: "Capitulo 8", startSec: 0, endSec: 60 },
    { position: 10, title: "Capitulo 10", startSec: 60, endSec: 120 },
  ];

  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: 8, chapterParts }).success, false);
});

test("batch da rota rejeita posicoes decimais", () => {
  const chapters = [
    { ...baseChapter, position: 8, title: "Capitulo 8" },
    { ...baseChapter, position: 8.5, title: "Capitulo 8.5" },
    { ...baseChapter, position: 9, title: "Capitulo 9" },
  ];

  assert.equal(chapterBatchSchema.safeParse({ chapters }).success, false);
});

test("batch da rota rejeita lacuna entre posicoes", () => {
  const chapters = [
    { ...baseChapter, position: 8, title: "Capitulo 8" },
    { ...baseChapter, position: 10, title: "Capitulo 10" },
  ];

  assert.equal(chapterBatchSchema.safeParse({ chapters }).success, false);
});

test("aceita lote consecutivo hospedado em novo bucket R2", () => {
  const chapters = [96, 97, 98, 99, 100].map((position) => ({
    ...baseChapter,
    position,
    title: `Capitulo ${position}`,
    audioUrl: "https://pub-4684220593db49858eb8eea0e3b7b910.r2.dev/audio.mp3",
  }));

  assert.equal(chapterBatchSchema.safeParse({ chapters }).success, true);
});

test("rejeita posicao negativa", () => {
  assert.equal(chapterSchema.safeParse({ ...baseChapter, position: -0.5 }).success, false);
});
