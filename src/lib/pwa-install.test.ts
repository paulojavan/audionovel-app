import assert from "node:assert/strict";
import { test } from "node:test";
import { getPwaInstallPromptState } from "./pwa-install";

test("mostra instrucao iOS quando app ainda nao esta instalado", () => {
  assert.deepEqual(
    getPwaInstallPromptState({
      isIos: true,
      isStandalone: false,
      hasNativeInstallPrompt: false,
      dismissed: false,
    }),
    "ios-instructions",
  );
});

test("mostra acao nativa quando Chrome oferece beforeinstallprompt", () => {
  assert.deepEqual(
    getPwaInstallPromptState({
      isIos: false,
      isStandalone: false,
      hasNativeInstallPrompt: true,
      dismissed: false,
    }),
    "native-prompt",
  );
});

test("nao mostra prompt quando instalado ou dispensado", () => {
  assert.equal(
    getPwaInstallPromptState({
      isIos: true,
      isStandalone: true,
      hasNativeInstallPrompt: false,
      dismissed: false,
    }),
    "hidden",
  );
  assert.equal(
    getPwaInstallPromptState({
      isIos: false,
      isStandalone: false,
      hasNativeInstallPrompt: true,
      dismissed: true,
    }),
    "hidden",
  );
});
