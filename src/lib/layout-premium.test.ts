import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layoutSource = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);

test("cabecalho mobile troca o nome da marca pela contagem Premium", () => {
  const mobileHomeLink = layoutSource.match(
    /<Link href="\/" className="[^"]*md:hidden">([\s\S]*?)<\/Link>/,
  )?.[1];

  assert.ok(mobileHomeLink, "link mobile da home deve existir");
  assert.match(mobileHomeLink, /\{premiumDaysLabel\}/);
  assert.doesNotMatch(mobileHomeLink, />Audio Novel BR</);
});

test("cabecalho desktop continua exibindo a contagem Premium", () => {
  assert.match(
    layoutSource,
    /className="hidden text-sm font-bold text-\[#8ff7ff\] md:block">\s*\{premiumDaysLabel\}/,
  );
});
