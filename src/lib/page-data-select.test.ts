import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_CONTENT_NOVEL_SELECT,
  ADMIN_DASHBOARD_PAYMENT_SELECT,
  ADMIN_MODERATION_COMMENT_SELECT,
  ADMIN_NOVEL_PANEL_SELECT,
  ADMIN_PAYMENT_SELECT,
  ADMIN_USER_DETAIL_SELECT,
  CHAPTER_PAGE_SELECT,
  CHAPTER_PROGRESS_SELECT,
  CATALOG_TAG_SELECT,
  LIBRARY_USER_SELECT,
  NOTIFICATION_SELECT,
  OFFLINE_DOWNLOAD_SELECT,
  PROFILE_USER_SELECT,
  PUBLIC_NOVEL_SELECT,
  REQUIRE_USER_SELECT,
  SUBSCRIPTION_PLAN_SELECT,
} from "./page-data-select";

test("lista publica de capitulos exclui payloads de reproducao", () => {
  const chapter = PUBLIC_NOVEL_SELECT.volumes.select.chapters.select;

  assert.equal("transcriptJson" in chapter, false);
  assert.equal("audioUrl" in chapter, false);
  assert.equal("youtubeUrl" in chapter, false);
  assert.equal(chapter.chapterPartsJson, true);
  assert.equal(chapter.title, true);
});

test("lista administrativa de conteudo carrega apenas contadores dos capitulos", () => {
  const chapter = ADMIN_CONTENT_NOVEL_SELECT.volumes.select.chapters.select;

  assert.deepEqual(Object.keys(chapter).sort(), ["position", "positionEnd", "premiumOnly"]);
});

test("biblioteca exclui senha e payloads grandes de capitulos", () => {
  assert.equal("passwordHash" in LIBRARY_USER_SELECT, false);
  const chapter = LIBRARY_USER_SELECT.listeningProgress.select.chapter.select;
  assert.equal("transcriptJson" in chapter, false);
  assert.equal(chapter.title, true);
});

test("perfil e offline nao carregam dados privados ou transcricoes", () => {
  assert.equal("passwordHash" in PROFILE_USER_SELECT, false);
  assert.equal("transcriptJson" in OFFLINE_DOWNLOAD_SELECT.chapter.select, false);
});

test("progresso da pagina de capitulo carrega apenas a posicao", () => {
  assert.deepEqual(Object.keys(CHAPTER_PROGRESS_SELECT), ["positionSec"]);
});

test("painel da novel e pagamentos administrativos usam selecoes minimas", () => {
  const chapter = ADMIN_NOVEL_PANEL_SELECT.volumes.select.chapters.select;

  assert.equal("transcriptJson" in chapter, false);
  assert.equal(chapter.createdAt, true);
  assert.deepEqual(ADMIN_PAYMENT_SELECT.user.select, { email: true });
});

test("notificacoes e planos retornam apenas campos exibidos", () => {
  assert.deepEqual(Object.keys(NOTIFICATION_SELECT).sort(), [
    "createdAt",
    "href",
    "id",
    "message",
    "readAt",
    "title",
  ]);
  assert.equal("createdAt" in SUBSCRIPTION_PLAN_SELECT, false);
  assert.equal(SUBSCRIPTION_PLAN_SELECT.premiumDays, true);
});

test("pagina de capitulo restringe a novel relacionada", () => {
  const novel = CHAPTER_PAGE_SELECT.volume.select.novel.select;

  assert.deepEqual(Object.keys(novel).sort(), ["coverUrl", "slug", "title"]);
  assert.equal(CHAPTER_PAGE_SELECT.audioUrl, true);
  assert.equal(CHAPTER_PAGE_SELECT.transcriptJson, true);
});

test("dashboard e moderacao nao carregam modelos relacionados completos", () => {
  assert.deepEqual(ADMIN_DASHBOARD_PAYMENT_SELECT.user.select, { email: true });
  assert.deepEqual(ADMIN_MODERATION_COMMENT_SELECT.user.select, { name: true, email: true });
});

test("detalhe administrativo do usuario nao carrega senha nem transcricoes", () => {
  assert.equal("passwordHash" in ADMIN_USER_DETAIL_SELECT, false);
  const chapter = ADMIN_USER_DETAIL_SELECT.listeningProgress.select.chapter.select;
  assert.equal("transcriptJson" in chapter, false);
  assert.equal(chapter.volume.select.novel.select.slug, true);
});

test("autorizacao de APIs carrega identidade, bloqueio e estado Premium", () => {
  assert.deepEqual(Object.keys(REQUIRE_USER_SELECT).sort(), [
    "email",
    "id",
    "isBlocked",
    "name",
    "premiumUntil",
    "role",
    "subscriptionStatus",
  ]);
});

test("filtros do catalogo nao carregam metadados internos das tags", () => {
  assert.deepEqual(Object.keys(CATALOG_TAG_SELECT).sort(), ["id", "name", "slug"]);
});
