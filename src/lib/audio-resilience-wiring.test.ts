import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const player = readFileSync(join(process.cwd(), "src", "components", "audio-player.tsx"), "utf8");
const progressRoute = readFileSync(join(process.cwd(), "src", "app", "api", "progress", "route.ts"), "utf8");
const audioRoute = readFileSync(
  join(process.cwd(), "src", "app", "api", "chapters", "[id]", "audio", "route.ts"),
  "utf8",
);

test("troca para karaoke fica bloqueada durante reproducao em modo pagina", () => {
  assert.match(player, /disabled=\{playing && playMode === "page"\}/);
});

test("player salva checkpoints e conclusao durante o ciclo em segundo plano", () => {
  assert.match(player, /shouldSaveCheckpoint/);
  assert.match(player, /isPlaybackComplete/);
  assert.match(player, /keepalive/);
  assert.match(player, /pagehide/);
  assert.match(player, /visibilitychange/);
  assert.match(player, /if \(!response\.ok\) throw/);
  assert.match(player, /const logicalDuration =/);
});

test("player integra controles nativos quando Media Session esta disponivel", () => {
  assert.match(player, /navigator\.mediaSession/);
  assert.match(player, /new MediaMetadata/);
});

test("servidor preserva conclusao e nao aborta streaming depois dos cabecalhos", () => {
  assert.match(progressRoute, /completed:\s*parsed\.data\.completed \? true : undefined/);
  assert.match(audioRoute, /new AbortController/);
  assert.match(audioRoute, /clearTimeout/);
  assert.doesNotMatch(audioRoute, /AbortSignal\.timeout/);
});
