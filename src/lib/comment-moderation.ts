export const PUBLIC_COMMENT_STATUSES = [
  "PENDING",
  "APPROVED",
  "REMOVED",
] as const;

export function getPublicCommentStatusFilter() {
  return { in: [...PUBLIC_COMMENT_STATUSES] };
}
