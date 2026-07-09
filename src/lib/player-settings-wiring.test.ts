import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const settingsHook = readFileSync(join(process.cwd(), "src", "hooks", "use-audio-player-settings.ts"), "utf8");
const settingsMenu = readFileSync(join(process.cwd(), "src", "components", "player-settings-menu.tsx"), "utf8");
const onlinePlayer = readFileSync(join(process.cwd(), "src", "components", "audio-player.tsx"), "utf8");
const offlinePlayer = readFileSync(join(process.cwd(), "src", "components", "offline-listen-panel.tsx"), "utf8");
const chapterPage = readFileSync(join(process.cwd(), "src", "app", "chapters", "[id]", "page.tsx"), "utf8");

test("configuracoes do player persistem com pausas e proximo capitulo desligados por padrao", () => {
  assert.match(settingsHook, /audio-novel-player-settings-v1/);
  assert.match(settingsHook, /pauseAtChapterEnd:\s*false/);
  assert.match(settingsHook, /autoPlayNextChapter:\s*false/);
  assert.match(settingsHook, /localStorage\.setItem/);
  assert.match(settingsMenu, /Settings/);
  assert.match(settingsMenu, /Velocidade/);
  assert.match(settingsMenu, /Pausar entre capitulos/);
  assert.match(settingsMenu, /Reproduzir proximo capitulo automaticamente/);
});

test("player online usa menu de configuracoes para velocidade, pausa e proximo capitulo", () => {
  assert.match(onlinePlayer, /useAudioPlayerSettings/);
  assert.match(onlinePlayer, /PlayerSettingsMenu/);
  assert.match(onlinePlayer, /autoPlayNextChapter/);
  assert.match(onlinePlayer, /nextChapterHref/);
  assert.match(onlinePlayer, /window\.location\.href = nextChapterHref/);
  assert.doesNotMatch(onlinePlayer, /setPauseAtChapterEnd/);
  assert.doesNotMatch(onlinePlayer, /setPlaybackRate/);
});

test("player offline compartilha o mesmo menu de configuracoes e avanca fila salva", () => {
  assert.match(offlinePlayer, /useAudioPlayerSettings/);
  assert.match(offlinePlayer, /PlayerSettingsMenu/);
  assert.match(offlinePlayer, /autoPlayNextChapter/);
  assert.match(offlinePlayer, /playNextOfflineItem/);
  assert.doesNotMatch(offlinePlayer, /setPauseAtChapterEnd/);
  assert.doesNotMatch(offlinePlayer, /setPlaybackRate/);
});

test("pagina de capitulo entrega link do proximo capitulo ao player", () => {
  assert.match(chapterPage, /nextChapterHref=\{nextChapter \? `\/chapters\/\$\{nextChapter\.id\}` : null\}/);
});
