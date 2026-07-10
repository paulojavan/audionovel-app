import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "components", "offline-chapter-button.tsx"),
  "utf8",
);
const volumeList = readFileSync(join(process.cwd(), "src", "components", "novel-volume-list.tsx"), "utf8");
const audioCache = readFileSync(join(process.cwd(), "src", "lib", "audio-cache.ts"), "utf8");

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
  assert.match(source, /ready \? "Salvo"/);
  assert.match(source, /disabled=\{pending \|\| ready \|\| checkingInitialSaved\}/);
});

test("lista da novel propaga capitulos offline salvos para os botoes", () => {
  assert.match(volumeList, /getSavedOfflineItems\(accountScope\)/);
  assert.match(volumeList, /savedOfflineChapterIds/);
  assert.match(volumeList, /new Set\(items\.map\(\(item\) => item\.chapterId\)\)/);
  assert.match(volumeList, /initialSaved=\{canUseOffline && Boolean\(savedOfflineChapterIds\?\.has\(chapter\.id\)\)\}/);
});

test("lista aguarda uma verificacao centralizada antes de mostrar ouvir offline", () => {
  assert.match(volumeList, /useState<Set<string> \| null>\(null\)/);
  assert.match(
    volumeList,
    /checkingInitialSaved=\{canUseOffline && savedOfflineChapterIds === null\}/g,
  );
  assert.match(source, /checkingInitialSaved\?: boolean/);
  assert.match(source, /checkingInitialSaved \? "Verificando\.\.\."/);
  assert.match(source, /disabled=\{pending \|\| ready \|\| checkingInitialSaved\}/);
  assert.doesNotMatch(source, /useEffect\(\(\) => \{[\s\S]*?hasValidEncryptedAudio\(accountScope, chapterId, "offline"\)/);
});

test("leitura em lote de capitulos salvos limpa o cache apenas uma vez", () => {
  const getSavedItemsBlock = audioCache.match(
    /export async function getSavedOfflineItems[\s\S]*?\n}\n\nexport async function getEncryptedAudioUrl/,
  )?.[0] ?? "";

  assert.match(getSavedItemsBlock, /cleanupExpiredAudioCache\(\)/);
  assert.match(getSavedItemsBlock, /getValidCachedRecord\(accountScope, item\.chapterId, "offline"\)/);
  assert.doesNotMatch(getSavedItemsBlock, /hasValidEncryptedAudio\(/);
});

test("download concluido sincroniza o estado salvo entre os layouts da lista", () => {
  assert.match(source, /onSaved\?: \(chapterId: string\) => void/);
  assert.match(source, /onSaved\?\.\(chapterId\)/);
  assert.match(volumeList, /function markChapterSaved\(chapterId: string\)/);
  assert.match(volumeList, /onSaved=\{markChapterSaved\}/g);
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
  assert.match(source, /disabled=\{pending \|\| ready \|\| checkingInitialSaved\}/);
});
