import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readSource(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const player = readSource(join(process.cwd(), "src", "components", "audio-player.tsx"));
const downloadModal = readSource(join(process.cwd(), "src", "components", "audio-download-modal.tsx"));
const volumeMenu = readSource(join(process.cwd(), "src", "components", "karaoke-volume-menu.tsx"));

test("player entrega estado atual aos overlays e os chunks entram no bundle do capitulo", () => {
  assert.match(player, /<AudioDownloadModal open=\{downloadingAudio\} percent=\{downloadPercent\} \/>/);
  assert.match(player, /<KaraokeVolumeMenu/);
  assert.match(volumeMenu, /"use client"/);
  assert.match(downloadModal, /"use client"/);
});

test("modal restaura a rolagem e some somente quando open fica falso", () => {
  assert.match(downloadModal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(downloadModal, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(downloadModal, /if \(!open\) return null/);
  assert.doesNotMatch(downloadModal, /button|onClick|onKeyDown/);
});
