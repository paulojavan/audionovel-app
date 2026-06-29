export type NovelContinuationNode = {
  id: string;
  continuationId: string | null;
};

export type NovelContinuationError =
  | "NOT_FOUND"
  | "SELF_REFERENCE"
  | "CYCLE";

export function validateNovelContinuation(
  novelId: string,
  continuationId: string | null,
  novels: NovelContinuationNode[],
): NovelContinuationError | null {
  if (!continuationId) return null;
  if (continuationId === novelId) return "SELF_REFERENCE";

  const byId = new Map(novels.map((novel) => [novel.id, novel]));
  if (!byId.has(continuationId)) return "NOT_FOUND";

  const visited = new Set<string>();
  let currentId: string | null = continuationId;

  while (currentId) {
    if (currentId === novelId || visited.has(currentId)) return "CYCLE";
    visited.add(currentId);
    currentId = byId.get(currentId)?.continuationId ?? null;
  }

  return null;
}

export function getNovelContinuationErrorMessage(
  error: NovelContinuationError,
) {
  if (error === "NOT_FOUND") {
    return "A continuação selecionada não existe.";
  }
  if (error === "SELF_REFERENCE") {
    return "Uma novel não pode ser continuação dela mesma.";
  }
  return "O vínculo criaria um ciclo entre novels.";
}
