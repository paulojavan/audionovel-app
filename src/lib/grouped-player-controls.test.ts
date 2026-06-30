import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const playerSource = readFileSync(
  new URL("../components/audio-player.tsx", import.meta.url),
  "utf8",
);
const partLinksSource = readFileSync(
  new URL("../components/chapter-part-links.tsx", import.meta.url),
  "utf8",
);

test("titulos agrupados enviam uma solicitacao de seek com autoplay", () => {
  assert.match(partLinksSource, /getChapterPartSeekDetail\(part\)/);
  assert.match(playerSource, /seekToAbsoluteTime\(startSec, autoplay\)/);
});

test("player oferece controles acessiveis entre capitulos agrupados", () => {
  assert.match(playerSource, /aria-label="Capítulo agrupado anterior"/);
  assert.match(playerSource, /aria-label="Próximo capítulo agrupado"/);
});
