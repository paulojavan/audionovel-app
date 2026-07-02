import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const profileForm = readFileSync(join(process.cwd(), "src", "components", "profile-edit-form.tsx"), "utf8");
const userMenu = readFileSync(join(process.cwd(), "src", "components", "user-menu.tsx"), "utf8");

test("formulario de perfil mantém uma unica requisicao em andamento", () => {
  assert.match(profileForm, /createSingleFlightGuard/);
  assert.match(profileForm, /await fetch\("\/api\/profile"/);
  assert.match(profileForm, /finally/);
});

test("link de perfil bloqueia navegacao repetida e a rota atual", () => {
  assert.match(userMenu, /onNavigate/);
  assert.match(userMenu, /pathname === "\/perfil"/);
  assert.match(userMenu, /profileNavigationGuardRef/);
});
