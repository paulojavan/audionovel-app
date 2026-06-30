import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogWhere, normalizeCatalogQuery } from "./catalog-query";

test("normaliza filtros vazios e paginas invalidas", () => {
  assert.deepEqual(normalizeCatalogQuery({ q: " ", tag: "", author: "", page: "0" }), {
    query: "",
    selectedTag: "",
    selectedAuthor: "",
    currentPage: 1,
  });
});

test("preserva filtros limpos e pagina positiva", () => {
  assert.deepEqual(normalizeCatalogQuery({ q: "  magia ", tag: "acao", author: "Ana", page: "3" }), {
    query: "magia",
    selectedTag: "acao",
    selectedAuthor: "Ana",
    currentPage: 3,
  });
});

test("constroi filtro serializavel do catalogo", () => {
  assert.deepEqual(
    buildCatalogWhere({ query: "magia", selectedTag: "acao", selectedAuthor: "Ana" }),
    {
      AND: [
        {
          OR: [
            { title: { contains: "magia" } },
            { author: { contains: "magia" } },
            { synopsis: { contains: "magia" } },
          ],
        },
        { tags: { some: { tag: { slug: "acao" } } } },
        { author: "Ana" },
      ],
    },
  );
});
