export const MAX_OFFLINE_RENEWAL_CHAPTERS = 100;

export function normalizeRenewalChapterIds(values: unknown) {
  if (!Array.isArray(values)) {
    throw new Error("Capitulos invalidos.");
  }

  const chapterIds = Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  if (chapterIds.length > MAX_OFFLINE_RENEWAL_CHAPTERS) {
    throw new Error("O limite e de 100 capitulos.");
  }
  return chapterIds;
}
