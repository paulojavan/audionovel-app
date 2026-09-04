import assert from "node:assert/strict";
import test from "node:test";
import { volumeCreateSchema, volumeUpdateSchema } from "./admin-volume-validation";

test("aceita volume zero e volume intermediario decimal", () => {
  assert.equal(volumeCreateSchema.safeParse({ novelId: "novel-1", title: "Prologo", position: 0 }).success, true);
  assert.equal(volumeCreateSchema.safeParse({ novelId: "novel-1", title: "Interludio", position: 2.5 }).success, true);
  assert.equal(volumeUpdateSchema.safeParse({ title: "Interludio", position: 2.5 }).success, true);
});

test("rejeita posicao de volume negativa ou nao finita", () => {
  assert.equal(volumeCreateSchema.safeParse({ novelId: "novel-1", title: "Invalido", position: -0.5 }).success, false);
  assert.equal(volumeCreateSchema.safeParse({ novelId: "novel-1", title: "Invalido", position: Number.POSITIVE_INFINITY }).success, false);
});
