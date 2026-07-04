import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "components", "offline-chapter-button.tsx"),
  "utf8",
);

test("botao prepara a pagina somente depois de salvar os metadados locais", () => {
  assert.match(source, /import \{ prepareOfflinePage \} from "@\/lib\/pwa-offline"/);
  assert.match(
    source,
    /await saveOfflineItem\(accountScope,[\s\S]*?setAudioSaved\(true\)[\s\S]*?await prepareSavedPage\(\)/,
  );
});

test("botao permite tentar preparar a pagina novamente sem baixar o audio", () => {
  assert.match(source, /if \(audioSaved\) \{[\s\S]*?await prepareSavedPage\(\)[\s\S]*?return;/);
  assert.match(
    source,
    /Audio salvo, mas a pagina offline ainda nao ficou pronta\. Toque novamente para tentar\./,
  );
});
