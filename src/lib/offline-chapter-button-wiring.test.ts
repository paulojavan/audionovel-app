import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "components", "offline-chapter-button.tsx"),
  "utf8",
);
const volumeList = readFileSync(join(process.cwd(), "src", "components", "novel-volume-list.tsx"), "utf8");

test("botao prepara a pagina somente depois de salvar os metadados locais", () => {
  assert.match(source, /import \{ prepareOfflinePage \} from "@\/lib\/pwa-offline"/);
  assert.match(source, /enqueueOfflineDownload/);
  assert.match(
    source,
    /await saveOfflineItem\(accountScope,[\s\S]*?markAudioSaved\(\)[\s\S]*?await prepareSavedPage\(\)/,
  );
});

test("botao permite tentar preparar a pagina novamente sem baixar o audio", () => {
  const audioSavedBlock = source.match(/if \(audioSaved\) \{[\s\S]*?return;\n    \}/)?.[0] ?? "";
  assert.match(audioSavedBlock, /void prepareSavedPage\(\)/);
  assert.doesNotMatch(audioSavedBlock, /enqueueOfflineDownload/);
  assert.match(
    source,
    /Audio salvo, mas a pagina offline ainda nao ficou pronta\. Toque novamente para tentar\./,
  );
});

test("botao mostra salvo desabilitado quando o capitulo ja esta offline", () => {
  assert.match(source, /initialSaved\?: boolean/);
  assert.match(source, /const ready = initialSaved \|\|/);
  assert.match(source, /setReadyState\(\{ key: nextKey, saved: true \}\)/);
  assert.match(source, /ready \? "Salvo"/);
  assert.match(source, /disabled=\{pending \|\| ready\}/);
});

test("lista da novel propaga capitulos offline salvos para os botoes", () => {
  assert.match(volumeList, /getSavedOfflineItems\(accountScope\)/);
  assert.match(volumeList, /savedOfflineChapterIds/);
  assert.match(volumeList, /new Set\(items\.map\(\(item\) => item\.chapterId\)\)/);
  assert.match(volumeList, /initialSaved=\{canUseOffline && savedOfflineChapterIds\.has\(chapter\.id\)\}/);
});

test("botao reutiliza audio offline valido antes de enfileirar novo download", () => {
  assert.match(source, /hasValidEncryptedAudio\(accountScope, chapterId, "offline"\)/);
  const cacheCheckIndex = source.indexOf('hasValidEncryptedAudio(accountScope, chapterId, "offline")');
  const queueIndex = source.indexOf("await enqueueOfflineDownload", cacheCheckIndex);
  assert.ok(cacheCheckIndex >= 0);
  assert.ok(queueIndex > cacheCheckIndex);
  assert.match(source, /if \(hasOfflineAudio\) \{[\s\S]*?await savePreparedOfflineMetadata\(payload\)[\s\S]*?await prepareSavedPage\(\)/);
});

test("botao coloca downloads simultaneos em fila visual", () => {
  assert.match(source, /type OfflineDownloadQueueStatus/);
  assert.match(source, /setQueueStatus/);
  assert.match(source, /Na fila/);
  assert.match(source, /Aguardando download/);
  assert.match(source, /disabled=\{pending \|\| ready\}/);
});
