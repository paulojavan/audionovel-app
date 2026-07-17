type ReplyNotificationInput = {
  commentId: string;
  authorId: string;
  authorName: string;
  parentAuthorId: string | null;
  targetTitle: string;
  href: string;
};

export function buildCommentReplyNotification(input: ReplyNotificationInput) {
  if (!input.parentAuthorId || input.parentAuthorId === input.authorId) {
    return null;
  }

  return {
    userId: input.parentAuthorId,
    commentId: input.commentId,
    title: "Seu comentario recebeu uma resposta",
    message: `${input.authorName} respondeu seu comentario em ${input.targetTitle}.`,
    href: input.href,
  };
}
