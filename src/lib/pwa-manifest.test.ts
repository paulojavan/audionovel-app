import assert from "node:assert/strict";
import { test } from "node:test";
import manifest from "../app/manifest";

test("manifest permite instalacao como aplicativo standalone", () => {
  const appManifest = manifest();
  const icons = appManifest.icons ?? [];

  assert.equal(appManifest.name, "Audio Novel BR");
  assert.equal(appManifest.short_name, "Audio Novel");
  assert.equal(appManifest.id, "/");
  assert.equal(appManifest.start_url, "/");
  assert.equal(appManifest.scope, "/");
  assert.equal(appManifest.display, "standalone");
  assert.equal(appManifest.prefer_related_applications, false);
  assert.equal(appManifest.theme_color, "#18b7bd");
  assert.equal(appManifest.background_color, "#03191c");

  assert.ok(icons.some((icon) => icon.src === "/icons/icon-192x192.png" && icon.sizes === "192x192"));
  assert.ok(icons.some((icon) => icon.src === "/icons/icon-512x512.png" && icon.sizes === "512x512"));
  assert.ok(icons.some((icon) => icon.src === "/icons/maskable-512x512.png" && icon.purpose === "maskable"));
});
