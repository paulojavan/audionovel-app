const NOVEL_STATUS_LABELS: Record<string, string> = {
  ONGOING: "Em andamento",
  COMPLETED: "Concluida",
  PAUSED: "Pausada",
};

export function getNovelStatusLabel(status: string) {
  return NOVEL_STATUS_LABELS[status] ?? status;
}
