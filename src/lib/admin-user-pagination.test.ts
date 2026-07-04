import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminUsersPageHref,
  normalizeAdminUsersPage,
} from "./admin-user-pagination";

test("normaliza paginas administrativas invalidas para a primeira pagina", () => {
  assert.equal(normalizeAdminUsersPage(undefined), 1);
  assert.equal(normalizeAdminUsersPage("0"), 1);
  assert.equal(normalizeAdminUsersPage("abc"), 1);
  assert.equal(normalizeAdminUsersPage("3"), 3);
});

test("monta links de paginacao preservando a pesquisa", () => {
  assert.equal(buildAdminUsersPageHref("ana", 1), "/admin/usuarios?q=ana");
  assert.equal(buildAdminUsersPageHref("ana", 2), "/admin/usuarios?q=ana&page=2");
  assert.equal(buildAdminUsersPageHref(undefined, 1), "/admin/usuarios");
});
