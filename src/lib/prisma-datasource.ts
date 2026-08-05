const DEFAULT_CONNECTION_LIMIT = 3;

export function getPrismaDatasourceUrl(
  rawUrl: string | undefined,
  configuredLimit = process.env.PRISMA_CONNECTION_LIMIT,
) {
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    const connectionLimit =
      normalizeConfiguredConnectionLimit(configuredLimit) ??
      getSafeImplicitConnectionLimit(
        url.searchParams.get("connection_limit") ?? undefined,
      );
    url.searchParams.set(
      "connection_limit",
      String(connectionLimit),
    );
    return url.toString();
  } catch {
    // Preserve the original value so Prisma emits its normal configuration
    // error without this helper ever logging credentials.
    return rawUrl;
  }
}

function getSafeImplicitConnectionLimit(value: string | undefined) {
  const urlLimit = normalizeConfiguredConnectionLimit(value);
  return urlLimit === null
    ? DEFAULT_CONNECTION_LIMIT
    : Math.min(urlLimit, DEFAULT_CONNECTION_LIMIT);
}

export function normalizeConnectionLimit(value: string | undefined) {
  return normalizeConfiguredConnectionLimit(value) ?? DEFAULT_CONNECTION_LIMIT;
}

function normalizeConfiguredConnectionLimit(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 50
    ? parsed
    : null;
}
