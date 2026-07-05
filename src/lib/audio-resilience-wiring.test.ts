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
const audioUpstream = readFileSync(
  join(process.cwd(), "src", "lib", "audio-upstream.ts"),
  "utf8",
);
const playerRetry = readFileSync(
  join(process.cwd(), "src", "lib", "audio-player-retry.ts"),
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

test("player tenta uma unica recarga retomavel sem baixar o audio online inteiro", () => {
  assert.match(player, /shouldRetryMediaError/);
  assert.match(player, /buildAudioRetrySource/);
  assert.match(player, /const \[audioSource,\s*setAudioSource\] = useState\(src\)/);
  assert.match(player, /src=\{audioSource\}/);
  assert.match(player, /playbackActiveRef/);
  assert.match(player, /pendingRetryRef/);
  assert.match(player, /onError=/);
  assert.doesNotMatch(player, /downloadAudioBuffer|decryptAudio|audio-cache/);
  assert.match(playerRetry, /searchParams\.set\("streamRetry"/);
});

test("player redefine a tentativa apenas quando a origem muda", () => {
  assert.match(
    player,
    /if \(sourceProp !== src\) \{[\s\S]*setAudioSource\(src\);[\s\S]*\}/,
  );
  assert.match(
    player,
    /useEffect\(\(\) => \{[\s\S]*audioRetryStateRef\.current = \{[\s\S]*automaticRetryCount:\s*0,[\s\S]*\};[\s\S]*\}, \[src\]\)/,
  );
  const metadataHandler = player.match(/onLoadedMetadata=\{\(event\) => \{[\s\S]*?\n\s*\}\}/)?.[0] ?? "";
  assert.doesNotMatch(metadataHandler, /automaticRetryCount:\s*0/);
});

test("player registra intencao antes de play e nao a apaga em pause induzido por erro", () => {
  assert.match(player, /desiredPlaybackRef\.current = true;[\s\S]*?\.play\(\)/);
  assert.match(player, /shouldResume:\s*desiredPlaybackRef\.current/);
  const pauseHandler = player.match(/onPause=\{\(\) => \{[\s\S]*?\n\s*\}\}/)?.[0] ?? "";
  assert.doesNotMatch(pauseHandler, /desiredPlaybackRef\.current = false/);
});

test("play manual depois de erro inicia nova revisao sem sobrepor recarga pendente", () => {
  assert.match(player, /if \(pendingRetryRef\.current\) return/);
  assert.match(player, /playbackError \|\| audio\.error/);
  assert.match(player, /reason:\s*"manual"/);
  assert.match(player, /advanceAudioRetryState/);
  assert.match(player, /role="alert"/);
});

test("servidor preserva conclusao e nao aborta streaming depois dos cabecalhos", () => {
  assert.match(progressRoute, /completed:\s*parsed\.data\.completed \? true : undefined/);
  assert.match(audioUpstream, /new AbortController/);
  assert.match(audioUpstream, /clearTimeout/);
  assert.doesNotMatch(audioUpstream, /AbortSignal\.timeout/);
});

test("rota usa stream retomavel e propaga cancelamento", () => {
  assert.match(audioRoute, /createResumableAudioStream/);
  assert.match(audioRoute, /downstreamSignal:\s*request\.signal/);
  assert.match(audioRoute, /openRange:\s*\(headers,\s*continuationSignal\)/);
  assert.match(
    audioRoute,
    /openAudioUpstream\(\s*[^,]+,\s*headers,\s*AbortSignal\.any\(\[request\.signal,\s*continuationSignal\]\),?\s*\)/,
  );
});

test("rota preserva respostas Range validas que nao podem ser retomadas", () => {
  assert.match(audioRoute, /isSafeAudioPassThroughResponse\(range,\s*upstream\)/);
  assert.match(
    audioRoute,
    /isSafeAudioPassThroughResponse\(range,\s*upstream\)\s*\?\s*upstream\.body\s*:/,
  );
});

test("rota protege criacao sincrona do stream e registra apenas campos sanitizados", () => {
  assert.match(audioRoute, /try\s*\{[\s\S]*createResumableAudioStream/);
  assert.match(audioRoute, /await upstream\.body\?\.cancel/);
  assert.match(
    audioRoute,
    /event:\s*"audio_upstream_interrupted"[\s\S]*timestamp:[\s\S]*attempt[\s\S]*byteOffset/,
  );
  const logBlock = audioRoute.match(
    /onFailure\(\{ attempt, byteOffset \}\)[\s\S]*?console\.warn\(JSON\.stringify\(\{[\s\S]*?\}\)\);/,
  )?.[0];
  assert.ok(logBlock);
  assert.doesNotMatch(
    logBlock,
    /(?:chapter|user|media\.audioUrl|headers|error)/,
  );
});

test("rota preserva autorizacao, validacao offline e rejeicao de redirect", () => {
  assert.match(audioRoute, /canPlayChapter\(id, session\?\.user\?\.id\)/);
  assert.match(audioRoute, /if \(!access\.allowed \|\| !access\.chapter\)/);
  assert.match(audioRoute, /enforceRateLimit\(/);
  assert.match(audioRoute, /if \(!session\?\.user\?\.id\)/);
  assert.match(audioRoute, /prisma\.offlineDownload\.findFirst/);
  assert.match(audioRoute, /prisma\.offlineDownload\.update/);
  assert.match(audioRoute, /upstream\.status >= 300 && upstream\.status < 400/);
});

test("rota encaminha apenas Range inicialmente e preserva metadados da resposta", () => {
  assert.match(audioRoute, /const initialHeaders = new Headers\(\)/);
  assert.match(audioRoute, /if \(range\) initialHeaders\.set\("Range", range\)/);
  assert.match(audioRoute, /upstream\.headers\.get\("content-type"\)/);
  assert.match(audioRoute, /headers\.set\("Accept-Ranges", "bytes"\)/);
  assert.doesNotMatch(audioRoute, /upstream\.headers\.get\("accept-ranges"\)/);
  assert.match(audioRoute, /\["content-length", "content-range"\]/);
  assert.match(audioRoute, /status:\s*upstream\.status/);
  assert.match(audioRoute, /"Cache-Control", "private, no-store"/);
});

test("rota cancela corpos upstream rejeitados antes de responder 502", () => {
  const redirectBlock = audioRoute.match(
    /if \(upstream\.status >= 300 && upstream\.status < 400\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const unavailableBlock = audioRoute.match(
    /if \(!upstream\.ok \|\| !upstream\.body\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.match(redirectBlock ?? "", /upstream\.body\?\.cancel/);
  assert.match(unavailableBlock ?? "", /upstream\.body\?\.cancel/);
});
