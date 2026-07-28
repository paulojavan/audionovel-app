import assert from "node:assert/strict";
import test from "node:test";
import {
  getPrismaDatasourceUrl,
  normalizeConnectionLimit,
} from "./prisma-datasource";

test("limita cada processo Prisma a tres conexoes por padrao", () => {
  const result = getPrismaDatasourceUrl(
    "postgresql://user:secret@db.example:5432/app?sslmode=require&connection_limit=18",
    undefined,
  );
  const url = new URL(result!);

  assert.equal(url.searchParams.get("connection_limit"), "3");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.password, "secret");
});

test("permite configurar um limite explicito dentro da faixa segura", () => {
  assert.equal(normalizeConnectionLimit("5"), 5);
  assert.equal(normalizeConnectionLimit("0"), 3);
  assert.equal(normalizeConnectionLimit("100"), 3);
  assert.equal(normalizeConnectionLimit("invalido"), 3);
});
