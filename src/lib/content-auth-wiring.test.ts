import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalogSource = readFileSync("src/app/novels/page.tsx", "utf8");
const novelSource = readFileSync("src/app/novels/[slug]/page.tsx", "utf8");
const chapterSource = readFileSync("src/app/chapters/[id]/page.tsx", "utf8");

test("catalogo exige sessao antes de consultar os dados", () => {
  const authCheck = catalogSource.indexOf("await getActiveServerSession()");
  const dataQuery = catalogSource.indexOf("getCachedCatalogPage(");

  assert.ok(authCheck >= 0);
  assert.ok(dataQuery > authCheck);
  assert.match(catalogSource, /redirect\(`\/login\?callbackUrl=\$\{encodeURIComponent\(callbackUrl\)\}`\)/);
});

test("pagina da novel exige sessao e preserva o destino apos o login", () => {
  const authCheck = novelSource.indexOf("await getActiveServerSession()");
  const dataQuery = novelSource.indexOf("getCachedPublicNovel(slug)", authCheck);

  assert.ok(authCheck >= 0);
  assert.ok(dataQuery > authCheck);
  assert.match(novelSource, /encodeURIComponent\(`\/novels\/\$\{slug\}`\)/);
});

test("pagina do capitulo exige sessao e preserva o destino apos o login", () => {
  const authCheck = chapterSource.indexOf("await getActiveServerSession()");
  const accessCheck = chapterSource.indexOf("canPlayChapter(", authCheck);

  assert.ok(authCheck >= 0);
  assert.ok(accessCheck > authCheck);
  assert.match(chapterSource, /encodeURIComponent\(`\/chapters\/\$\{id\}`\)/);
});
