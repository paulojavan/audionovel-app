import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const coverBadge = readFileSync(join(process.cwd(), "src", "components", "novel-status-cover.tsx"), "utf8");
const playerSettingsMenu = readFileSync(join(process.cwd(), "src", "components", "player-settings-menu.tsx"), "utf8");
const audioPlayer = readFileSync(join(process.cwd(), "src", "components", "audio-player.tsx"), "utf8");
const homePage = readFileSync(join(process.cwd(), "src", "app", "page.tsx"), "utf8");
const catalogPage = readFileSync(join(process.cwd(), "src", "app", "novels", "page.tsx"), "utf8");
const libraryPage = readFileSync(join(process.cwd(), "src", "app", "biblioteca", "page.tsx"), "utf8");
const rankingSwitcher = readFileSync(join(process.cwd(), "src", "components", "home-ranking-switcher.tsx"), "utf8");
const publicData = readFileSync(join(process.cwd(), "src", "lib", "public-data.ts"), "utf8");

test("menu de configuracoes pode abrir para cima no karaoke", () => {
  assert.match(playerSettingsMenu, /placement\?:\s*"bottom"\s*\|\s*"top"/);
  assert.match(playerSettingsMenu, /createPortal/);
  assert.match(playerSettingsMenu, /getBoundingClientRect/);
  assert.match(playerSettingsMenu, /position:\s*"fixed"/);
  assert.match(playerSettingsMenu, /window\.innerHeight - rect\.top \+ MENU_GAP/);
  assert.match(playerSettingsMenu, /rect\.bottom \+ MENU_GAP/);
  assert.match(playerSettingsMenu, /document\.body/);
  assert.doesNotMatch(playerSettingsMenu, /className="absolute right-0/);
  assert.doesNotMatch(playerSettingsMenu, /bottom-full|mt-2/);
  assert.match(audioPlayer, /placement="top"/);
});

test("selo de status da capa usa rotulo traduzido", () => {
  assert.match(coverBadge, /getNovelStatusLabel\(status\)/);
  assert.match(coverBadge, /absolute/);
  assert.match(coverBadge, /showStatus = true/);
});

test("home, catalogo e biblioteca renderizam capas com selo de status onde a capa comporta o selo", () => {
  assert.match(homePage, /NovelStatusCover/);
  assert.match(catalogPage, /NovelStatusCover/);
  assert.match(libraryPage, /NovelStatusCover/);
  assert.match(rankingSwitcher, /NovelStatusCover/);
  assert.match(homePage, /showStatus=\{false\}/);
  assert.match(rankingSwitcher, /showStatus=\{false\}/);
});

test("home busca doze capitulos para lancamentos", () => {
  assert.match(publicData, /prisma\.chapter\.findMany\(\{[\s\S]*take:\s*12/);
});
