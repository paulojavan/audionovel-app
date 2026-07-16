import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const settingsHook = readFileSync(join(process.cwd(), "src", "hooks", "use-audio-player-settings.ts"), "utf8");
const settingsMenu = readFileSync(join(process.cwd(), "src", "components", "player-settings-menu.tsx"), "utf8");
const onlinePlayer = readFileSync(join(process.cwd(), "src", "components", "audio-player.tsx"), "utf8");
const offlinePlayer = readFileSync(join(process.cwd(), "src", "components", "offline-listen-panel.tsx"), "utf8");
const chapterPage = readFileSync(join(process.cwd(), "src", "app", "chapters", "[id]", "page.tsx"), "utf8");
const karaokeVolumeMenuPath = join(process.cwd(), "src", "components", "karaoke-volume-menu.tsx");
const karaokeVolumeMenu = existsSync(karaokeVolumeMenuPath)
  ? readFileSync(karaokeVolumeMenuPath, "utf8")
  : "";

test("configuracoes do player persistem com pausas e proximo capitulo desligados por padrao", () => {
  assert.match(settingsHook, /audio-novel-player-settings-v1/);
  assert.match(settingsHook, /pauseAtChapterEnd:\s*false/);
  assert.match(settingsHook, /autoPlayNextChapter:\s*false/);
  assert.match(settingsHook, /playMode:\s*"karaoke"/);
  assert.match(settingsHook, /normalizePlayMode/);
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
  assert.match(onlinePlayer, /playMode/);
  assert.match(onlinePlayer, /updateSettings\(\{ playMode: "karaoke" \}\)/);
  assert.match(onlinePlayer, /updateSettings\(\{ playMode: "page" \}\)/);
  assert.doesNotMatch(onlinePlayer, /setPlayMode/);
  assert.doesNotMatch(onlinePlayer, /setPauseAtChapterEnd/);
  assert.doesNotMatch(onlinePlayer, /setPlaybackRate/);
});

test("karaoke usa icone que abre o controle de volume acima dos controles", () => {
  assert.match(onlinePlayer, /KaraokeVolumeMenu/);
  assert.doesNotMatch(onlinePlayer, /function KaraokeVolumeControl/);
  assert.match(karaokeVolumeMenu, /createPortal/);
  assert.match(karaokeVolumeMenu, /bottom:/);
  assert.match(karaokeVolumeMenu, /event\.key === "Escape"/);
  assert.match(karaokeVolumeMenu, /pointerdown/);
  assert.match(karaokeVolumeMenu, /aria-expanded=\{open\}/);
  assert.match(karaokeVolumeMenu, /Volume \{Math\.round/);
});

test("modo pagina mantem volume ao lado das configuracoes e abre o controle abaixo", () => {
  assert.match(
    onlinePlayer,
    /<KaraokeVolumeMenu[\s\S]*?placement="bottom"[\s\S]*?\/>\s*<PlayerSettingsMenu/,
  );
  assert.doesNotMatch(onlinePlayer, /function PageVolumeControl/);
  assert.doesNotMatch(onlinePlayer, /playing && playMode === "page" \? \(/);
  assert.match(karaokeVolumeMenu, /placement\?: "top" \| "bottom"/);
  assert.match(karaokeVolumeMenu, /placement === "top"/);
  assert.match(karaokeVolumeMenu, /top:/);
});

test("proximo capitulo automatico inicia playback no capitulo carregado", () => {
  assert.match(onlinePlayer, /NEXT_CHAPTER_AUTOPLAY_KEY/);
  assert.match(onlinePlayer, /sessionStorage\.setItem\(NEXT_CHAPTER_AUTOPLAY_KEY,\s*nextChapterHref\)/);
  assert.match(onlinePlayer, /sessionStorage\.getItem\(NEXT_CHAPTER_AUTOPLAY_KEY\)/);
  assert.match(onlinePlayer, /targetUrl\.pathname === window\.location\.pathname/);
  assert.match(onlinePlayer, /window\.setTimeout\(\(\) => \{[\s\S]*void playDownloadedAudio\(\)/);
  assert.match(onlinePlayer, /window\.clearTimeout\(autoplayTimer\)/);
  assert.match(onlinePlayer, /setKaraokeMode\(playMode === "karaoke"\)/);
});

test("player offline compartilha o mesmo menu de configuracoes e avanca fila salva", () => {
  assert.match(offlinePlayer, /useAudioPlayerSettings/);
  assert.match(offlinePlayer, /PlayerSettingsMenu/);
  assert.match(offlinePlayer, /autoPlayNextChapter/);
  assert.match(offlinePlayer, /playNextOfflineItem/);
  assert.doesNotMatch(offlinePlayer, /setPauseAtChapterEnd/);
  assert.doesNotMatch(offlinePlayer, /setPlaybackRate/);
});

test("player offline le somente o audio selecionado e nao faz preflight duplicado", () => {
  const playBlock = offlinePlayer.match(
    /function playItem\(item: OfflineItem\)[\s\S]*?\r?\n  }\r?\n\r?\n  function toggle/,
  )?.[0] ?? "";

  assert.match(playBlock, /getSavedEncryptedAudioUrl\(accountScope, item\.chapterId\)/);
  assert.match(playBlock, /removeOfflineItem\(accountScope, item\.chapterId\)/);
  assert.match(playBlock, /error instanceof OfflineAudioInvalidError/);
  assert.doesNotMatch(playBlock, /hasValidEncryptedAudio/);
  assert.doesNotMatch(playBlock, /getEncryptedAudioUrl/);
});

test("pagina de capitulo entrega link do proximo capitulo ao player", () => {
  assert.match(chapterPage, /nextChapterHref=\{nextChapter \? `\/chapters\/\$\{nextChapter\.id\}` : null\}/);
});
