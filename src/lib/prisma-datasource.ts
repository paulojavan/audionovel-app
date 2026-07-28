const DEFAULT_CONNECTION_LIMIT = 3;

export function getPrismaDatasourceUrl(
  rawUrl: string | undefined,
  configuredLimit = process.env.PRISMA_CONNECTION_LIMIT,
) {
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    url.searchParams.set(
      "connection_limit",
      String(normalizeConnectionLimit(configuredLimit)),
    );
    return url.toString();
  } catch {
    // Preserve the original value so Prisma emits its normal configuration
    // error without this helper ever logging credentials.
    return rawUrl;
  }
}

export function normalizeConnectionLimit(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 50
    ? parsed
    : DEFAULT_CONNECTION_LIMIT;
}
