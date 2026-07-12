import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const player = readFileSync(join(process.cwd(), "src", "components", "audio-player.tsx"), "utf8");
const offlinePlayer = readFileSync(
  join(process.cwd(), "src", "components", "offline-listen-panel.tsx"),
  "utf8",
);
const chapterPage = readFileSync(join(process.cwd(), "src", "app", "chapters", "[id]", "page.tsx"), "utf8");
const progressRoute = readFileSync(join(process.cwd(), "src", "app", "api", "progress", "route.ts"), "utf8");
const audioRoute = readFileSync(
  join(process.cwd(), "src", "app", "api", "chapters", "[id]", "audio", "route.ts"),
  "utf8",
);
const audioCache = readFileSync(join(process.cwd(), "src", "lib", "audio-cache.ts"), "utf8");
const audioUpstream = readFileSync(
  join(process.cwd(), "src", "lib", "audio-upstream.ts"),
  "utf8",
);
const downloadModalPath = join(process.cwd(), "src", "components", "audio-download-modal.tsx");
const downloadModal = existsSync(downloadModalPath) ? readFileSync(downloadModalPath, "utf8") : "";

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

test("player baixa o audio completo no cache criptografado antes de entregar o blob ao elemento audio", () => {
  assert.match(player, /getEncryptedAudioUrl/);
  assert.match(player, /mode:\s*"temporary"/);
  assert.match(player, /URL\.revokeObjectURL/);
  assert.match(player, /src=\{activeAudioSource \|\| undefined\}/);
  assert.match(downloadModal, /Baixando audio/);
  assert.match(player, /downloadPercent/);
  assert.match(player, /AudioDownloadModal/);
  assert.doesNotMatch(player, /h-3 overflow-hidden[\s\S]{0,300}downloadPercent/);
  assert.doesNotMatch(player, /preload="metadata"/);
});

test("player online usa streaming direto somente quando o cache permite fallback", () => {
  assert.match(
    player,
    /import \{ resolveOnlineAudioFailure \} from "@\/lib\/online-audio-playback"/,
  );
  assert.match(
    player,
    /getEncryptedAudioUrl\(chapterId, src,[\s\S]*?catch \(error\)[\s\S]*?resolveOnlineAudioFailure\(error\)/,
  );
  assert.match(
    player,
    /if \(failure\.kind === "error"\) \{[\s\S]*?setPlaybackError\(failure\.message\);[\s\S]*?return;/,
  );
  assert.match(player, /playbackSource = src/);
  assert.match(
    player,
    /activeAudio\.getAttribute\("src"\) !== playbackSource/,
  );
  assert.match(player, /activeAudio\.src = playbackSource/);
  assert.doesNotMatch(
    offlinePlayer,
    /resolveOnlineAudioFailure|playbackSource = src/,
  );
});

test("download mostra modal circular bloqueante sem fechamento manual", () => {
  assert.match(downloadModal, /createPortal/);
  assert.match(downloadModal, /if \(!open\) return null/);
  assert.match(downloadModal, /role="dialog"/);
  assert.match(downloadModal, /aria-modal="true"/);
  assert.match(downloadModal, /animate-spin/);
  assert.match(downloadModal, /fixed inset-0 z-\[100\]/);
  assert.match(downloadModal, /percent === null \? "\.\.\."/);
  assert.doesNotMatch(downloadModal, /onClose|aria-label="Fechar"|<X\b/);
});

test("player descarta downloads antigos quando a origem muda", () => {
  assert.match(player, /URL\.revokeObjectURL\(downloadedAudio\.objectUrl\)/);
  assert.match(player, /audioSource\?\.source === src \? audioSource\.objectUrl : ""/);
  assert.match(player, /}, \[src\]\)/);
  assert.doesNotMatch(player, /sourceProp/);
});

test("player registra intencao antes de play e nao a apaga em pause induzido por erro", () => {
  assert.match(player, /desiredPlaybackRef\.current = true;[\s\S]*?\.play\(\)/);
  const pauseHandler = player.match(/onPause=\{\(\) => \{[\s\S]*?\n\s*\}\}/)?.[0] ?? "";
  assert.doesNotMatch(pauseHandler, /desiredPlaybackRef\.current = false/);
});

test("play manual baixa uma unica vez e bloqueia interacoes durante o download", () => {
  assert.match(player, /if \(downloadPromiseRef\.current\) return downloadPromiseRef\.current/);
  assert.match(audioCache, /credentials:\s*"include"/);
  assert.match(player, /if \(!audio \|\| downloadingAudio\) return/);
  assert.match(player, /disabled=\{downloadingAudio\}/);
  assert.match(player, /role="alert"/);
});

test("toggle baixa antes de reproduzir quando o audio esta pausado", () => {
  const toggleStart = player.indexOf("function toggle()");
  const toggleEnd = player.indexOf("function decreaseKaraokeFont", toggleStart);
  const toggleBlock = player.slice(toggleStart, toggleEnd);
  const downloadIndex = toggleBlock.indexOf("playDownloadedAudio");
  const pausedIndex = toggleBlock.indexOf("if (audio.paused)");
  assert.ok(downloadIndex >= 0);
  assert.ok(pausedIndex >= 0);
  assert.ok(downloadIndex > pausedIndex);
});

test("capitulo ja concluido pode ser reproduzido novamente do inicio", () => {
  assert.match(chapterPage, /initialCompleted=\{progress\?\.completed \?\? false\}/);
  assert.match(player, /initialCompleted \|\| isPlaybackComplete\(initialPosition, duration\) \? 0 : initialPosition/);
  assert.match(player, /useState\(initialResumePosition\)/);
  assert.match(player, /activeAudio\.ended \|\| isPlaybackComplete\(currentRelativePosition, progressDuration\)/);
  assert.match(player, /shouldReplayFromBeginning[\s\S]*\? startOffset/);
  assert.match(player, /startOffset \+ initialResumePosition/);
  assert.doesNotMatch(player, /startOffset \+ initialPosition/);
});

test("erro do elemento local nao tenta reiniciar streaming", () => {
  const errorHandler = player.match(/onError=\{\(event\) => \{[\s\S]*?\n\s*\}\}/)?.[0] ?? "";
  assert.doesNotMatch(errorHandler, /resolveInterruptedAudioRetry|beginAudioReload|shouldRetryMediaError/);
  assert.match(errorHandler, /setPlaybackError\(PLAYBACK_CONNECTION_ERROR\)/);
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

test("rota permite varias retomadas antes de desistir do audio", () => {
  assert.match(audioRoute, /maxContinuations:\s*12/);
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
