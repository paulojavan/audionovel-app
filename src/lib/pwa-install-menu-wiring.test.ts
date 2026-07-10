import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const readSource = (...segments: string[]) => readFileSync(join(process.cwd(), ...segments), "utf8");
const installItem = readSource("src", "components", "pwa-install-menu-item.tsx");
const lifecycle = readSource("src", "components", "pwa-lifecycle.tsx");
const userMenu = readSource("src", "components", "user-menu.tsx");
const mobileNav = readSource("src", "components", "mobile-app-nav.tsx");
const layout = readSource("src", "app", "layout.tsx");

test("item Instalar app desaparece quando o PWA ja esta instalado", () => {
  assert.match(installItem, /isPwaInstalled/);
  assert.match(installItem, /appinstalled/);
  assert.match(installItem, /if \(!visible\) return null/);
  assert.match(installItem, /Instalar app/);
});

test("item do menu solicita o fluxo de instalacao ja existente", () => {
  assert.match(installItem, /pwa-install-requested/);
  assert.match(lifecycle, /pwa-install-requested/);
  assert.match(lifecycle, /setManualInstallRequested\(true\)/);
});

test("menu desktop e menu inferior mobile oferecem instalacao", () => {
  assert.match(layout, /<PwaInstallMenuItem variant="sidebar"/);
  assert.match(mobileNav, /<PwaInstallMenuItem variant="mobile"/);
});

test("cabecalho nao repete notificacoes nem bug e rodape lateral nao repete perfil", () => {
  assert.doesNotMatch(userMenu, /href="\/notificacoes"/);
  assert.doesNotMatch(userMenu, /href="\/reportar-bug"/);
  assert.doesNotMatch(layout, /className="mt-auto rounded-md bg\[#06272b\]/);
  assert.match(layout, /href="\/notificacoes"/);
  assert.match(layout, /href="\/reportar-bug"/);
  assert.match(mobileNav, /href: "\/notificacoes"/);
  assert.match(mobileNav, /href: "\/reportar-bug"/);
});
