import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getNovelStatusLabel } from "./novel-status";
import { PUBLIC_NOVEL_SELECT } from "./page-data-select";

test("traduz status conhecidos da novel para portugues", () => {
  assert.equal(getNovelStatusLabel("ONGOING"), "Em andamento");
  assert.equal(getNovelStatusLabel("COMPLETED"), "Concluida");
  assert.equal(getNovelStatusLabel("PAUSED"), "Pausada");
});

test("mantem status desconhecido visivel para diagnostico", () => {
  assert.equal(getNovelStatusLabel("ARCHIVED"), "ARCHIVED");
});

test("pagina publica carrega e exibe status como selo sobre a capa", () => {
  assert.equal(PUBLIC_NOVEL_SELECT.status, true);

  const publicPage = readFileSync(join(process.cwd(), "src", "app", "novels", "[slug]", "page.tsx"), "utf8");
  assert.match(publicPage, /getNovelStatusLabel\(novel\.status\)/);
  assert.match(publicPage, /absolute/);
  assert.match(publicPage, /Status/);
});

test("painel administrativo usa o mesmo rotulo traduzido", () => {
  const adminList = readFileSync(join(process.cwd(), "src", "app", "admin", "conteudo", "page.tsx"), "utf8");
  const adminPanel = readFileSync(join(process.cwd(), "src", "app", "admin", "conteudo", "[id]", "page.tsx"), "utf8");

  assert.match(adminList, /getNovelStatusLabel\(novel\.status\)/);
  assert.match(adminPanel, /getNovelStatusLabel\(novel\.status\)/);
});
