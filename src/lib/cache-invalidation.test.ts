import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

test("cadastro de tag invalida tags e conteudo publico", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/api/admin/tags/route.ts"), "utf8");

  assert.match(source, /revalidateTag\(CACHE_TAGS\.tags,\s*"max"\)/);
  assert.match(source, /revalidateTag\(CACHE_TAGS\.content,\s*"max"\)/);
});
