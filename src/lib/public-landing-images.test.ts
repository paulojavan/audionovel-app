import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const landingSource = readFileSync(
  join(process.cwd(), "src", "components", "public-landing.tsx"),
  "utf8",
);

test("imagens da landing possuem dimensoes intrinsecas e nao dependem de fill", () => {
  assert.match(
    landingSource,
    /src="\/hero-audio-novel-br\.png"[\s\S]*?width=\{1731\}[\s\S]*?height=\{909\}/,
  );
  assert.match(
    landingSource,
    /src="\/logo-audio-novel-br\.png"[\s\S]*?width=\{40\}[\s\S]*?height=\{40\}/,
  );
  assert.match(
    landingSource,
    /src="\/logo-audio-novel-br\.png"[\s\S]*?width=\{1254\}[\s\S]*?height=\{1254\}/,
  );

  const imageBlocks = landingSource.match(/<Image\b[\s\S]*?\/>/g) ?? [];

  for (const imageSource of [
    "/hero-audio-novel-br.png",
    "/logo-audio-novel-br.png",
  ]) {
    const matchingImages = imageBlocks.filter((block) =>
      block.includes(`src="${imageSource}"`),
    );

    assert.ok(matchingImages.length > 0);
    assert.ok(matchingImages.every((block) => !/\sfill(?:\s|=|\/>)/.test(block)));
  }
});

test("hero preserva a arte completa no mobile e usa recorte apenas no desktop", () => {
  const imageBlocks = landingSource.match(/<Image\b[\s\S]*?\/>/g) ?? [];
  const heroImage = imageBlocks.find((block) =>
    block.includes('src="/hero-audio-novel-br.png"'),
  );

  assert.ok(heroImage);
  assert.match(heroImage, /className="[^"]*\bh-auto\b[^"]*\bw-full\b/);
  assert.match(heroImage, /className="[^"]*\blg:absolute\b[^"]*\blg:object-cover\b/);
  assert.match(heroImage, /\bpreload\b/);
  assert.doesNotMatch(heroImage, /\bpriority\b/);
  assert.match(
    landingSource,
    /pt-24 sm:pt-28 lg:min-h-\[72svh\] lg:flex-1 lg:pt-0/,
  );
});
