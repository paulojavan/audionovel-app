import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const chapterPageSource = readFileSync(
  join(process.cwd(), "src", "app", "chapters", "[id]", "page.tsx"),
  "utf8",
);

test("pagina de capitulo nao grava view ou progresso durante renderizacao", () => {
  assert.doesNotMatch(chapterPageSource, /prisma\.chapter\.update/);
  assert.doesNotMatch(chapterPageSource, /completed:\s*true/);
  assert.match(chapterPageSource, /<ChapterViewTracker chapterId=\{id\}/);
});

test("rota de audio nao altera contadores de visualizacao", () => {
  const routeSource = readFileSync(
    join(process.cwd(), "src", "app", "api", "chapters", "[id]", "audio", "route.ts"),
    "utf8",
  );
  assert.doesNotMatch(routeSource, /viewCount/);
});

test("proxy de audio limita tempo, bloqueia redirect e trata falha do upstream", () => {
  const routeSource = readFileSync(
    join(process.cwd(), "src", "app", "api", "chapters", "[id]", "audio", "route.ts"),
    "utf8",
  );
  const upstreamSource = readFileSync(
    join(process.cwd(), "src", "lib", "audio-upstream.ts"),
    "utf8",
  );
  assert.match(upstreamSource, /new AbortController/);
  assert.match(upstreamSource, /setTimeout\(/);
  assert.match(upstreamSource, /15_000/);
  assert.match(upstreamSource, /clearTimeout\(timeout\)/);
  assert.match(upstreamSource, /redirect:\s*"manual"/);
  assert.match(routeSource, /catch/);
});

test("registro de visualizacao preserva contagem anonima com limite por IP", () => {
  const routeSource = readFileSync(
    join(process.cwd(), "src", "app", "api", "chapters", "[id]", "view", "route.ts"),
    "utf8",
  );
  assert.doesNotMatch(routeSource, /requireUser/);
  assert.match(routeSource, /getRequestIdentifier/);
});
