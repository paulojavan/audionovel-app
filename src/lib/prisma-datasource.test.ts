import assert from "node:assert/strict";
import test from "node:test";
import {
  getPrismaDatasourceUrl,
  normalizeConnectionLimit,
} from "./prisma-datasource";

test("limita o pool implicito da URL para proteger os slots do banco", () => {
  const result = getPrismaDatasourceUrl(
    "postgresql://user:secret@db.example:5432/app?sslmode=require&connection_limit=18",
    undefined,
  );
  const url = new URL(result!);

  assert.equal(url.searchParams.get("connection_limit"), "3");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.password, "secret");
});

test("preserva um limite da URL menor que o teto seguro", () => {
  const result = getPrismaDatasourceUrl(
    "postgresql://user:secret@db.example:5432/app?connection_limit=2",
    undefined,
  );

  assert.equal(new URL(result!).searchParams.get("connection_limit"), "2");
});

test("permite configurar um limite explicito dentro da faixa segura", () => {
  assert.equal(normalizeConnectionLimit("5"), 5);
  assert.equal(normalizeConnectionLimit("0"), 3);
  assert.equal(normalizeConnectionLimit("100"), 3);
  assert.equal(normalizeConnectionLimit("invalido"), 3);
});

test("usa tres conexoes quando URL e ambiente nao configuram o limite", () => {
  const result = getPrismaDatasourceUrl(
    "postgresql://user:secret@db.example:5432/app?sslmode=require",
    undefined,
  );

  assert.equal(new URL(result!).searchParams.get("connection_limit"), "3");
});

test("override explicito tem precedencia sobre o limite da URL", () => {
  const result = getPrismaDatasourceUrl(
    "postgresql://user:secret@db.example:5432/app?connection_limit=18",
    "5",
  );

  assert.equal(new URL(result!).searchParams.get("connection_limit"), "5");
});
