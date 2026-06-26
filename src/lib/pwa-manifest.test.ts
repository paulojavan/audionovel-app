import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function readPublicManifest() {
  const manifestPath = join(process.cwd(), "public", "manifest.webmanifest");
  assert.equal(existsSync(manifestPath), true, "public/manifest.webmanifest deve existir para nao cair em HTML do app");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as {
    name?: string;
    short_name?: string;
    id?: string;
    start_url?: string;
    scope?: string;
    display?: string;
    display_override?: string[];
    prefer_related_applications?: boolean;
    theme_color?: string;
    background_color?: string;
    icons?: Array<{ src?: string; sizes?: string; purpose?: string }>;
  };
}

test("manifest permite instalacao como aplicativo standalone", () => {
  const appManifest = readPublicManifest();
  const icons = appManifest.icons ?? [];

  assert.equal(appManifest.name, "Audio Novel BR");
  assert.equal(appManifest.short_name, "Audio Novel");
  assert.equal(appManifest.id, "/");
  assert.equal(appManifest.start_url, "/");
  assert.equal(appManifest.scope, "/");
  assert.equal(appManifest.display, "standalone");
  assert.notEqual(appManifest.display_override?.[0], "browser");
  assert.equal(appManifest.prefer_related_applications, false);
  assert.equal(appManifest.theme_color, "#18b7bd");
  assert.equal(appManifest.background_color, "#03191c");

  assert.ok(icons.some((icon) => icon.src === "/icons/icon-192x192.png" && icon.sizes === "192x192"));
  assert.ok(icons.some((icon) => icon.src === "/icons/icon-512x512.png" && icon.sizes === "512x512"));
  assert.ok(icons.some((icon) => icon.src === "/icons/maskable-512x512.png" && icon.purpose === "maskable"));
});
