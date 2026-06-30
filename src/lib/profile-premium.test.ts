import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileSource = readFileSync(
  new URL("../app/perfil/page.tsx", import.meta.url),
  "utf8",
);

test("perfil exibe a mesma contagem de dias Premium usada no cabecalho", () => {
  assert.match(
    profileSource,
    /const premiumDaysLabel = getPremiumDaysLabel\(user\);/,
  );
  assert.match(
    profileSource,
    /<span[^>]*>\{premiumDaysLabel\}<\/span>/,
  );
});
