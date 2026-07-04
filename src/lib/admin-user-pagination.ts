export const ADMIN_USERS_PAGE_SIZE = 50;

export function normalizeAdminUsersPage(page: string | undefined) {
  const parsedPage = Number.parseInt(page ?? "1", 10);
  return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

export function buildAdminUsersPageHref(query: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/admin/usuarios?${suffix}` : "/admin/usuarios";
}
