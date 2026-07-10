import assert from "node:assert/strict";
import { test } from "node:test";
import { getPwaInstallPromptState, isMobileUserAgent, isPwaInstalled } from "./pwa-install";

test("detecta PWA instalado nos modos standalone, fullscreen e iOS", () => {
  assert.equal(isPwaInstalled({ standalone: true, fullscreen: false, iosStandalone: false }), true);
  assert.equal(isPwaInstalled({ standalone: false, fullscreen: true, iosStandalone: false }), true);
  assert.equal(isPwaInstalled({ standalone: false, fullscreen: false, iosStandalone: true }), true);
  assert.equal(isPwaInstalled({ standalone: false, fullscreen: false, iosStandalone: false }), false);
});

test("mostra instrucao iOS quando app ainda nao esta instalado", () => {
  assert.deepEqual(
    getPwaInstallPromptState({
      isIos: true,
      isMobile: true,
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
      isMobile: true,
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
      isMobile: true,
      isStandalone: true,
      hasNativeInstallPrompt: false,
      dismissed: false,
    }),
    "hidden",
  );
  assert.equal(
    getPwaInstallPromptState({
      isIos: false,
      isMobile: true,
      isStandalone: false,
      hasNativeInstallPrompt: true,
      dismissed: true,
    }),
    "hidden",
  );
});

test("mostra instrucao no celular quando o prompt nativo ainda nao chegou", () => {
  assert.equal(
    getPwaInstallPromptState({
      isIos: false,
      isMobile: true,
      isStandalone: false,
      hasNativeInstallPrompt: false,
      dismissed: false,
    }),
    "browser-instructions",
  );
});

test("nao mostra instrucao generica em desktop sem prompt nativo", () => {
  assert.equal(
    getPwaInstallPromptState({
      isIos: false,
      isMobile: false,
      isStandalone: false,
      hasNativeInstallPrompt: false,
      dismissed: false,
    }),
    "hidden",
  );
});

test("detecta user-agent movel para orientar instalacao", () => {
  assert.equal(isMobileUserAgent("Mozilla/5.0 (Linux; Android 15; Pixel) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36"), true);
  assert.equal(isMobileUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"), false);
});
