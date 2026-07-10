import { CommentActions } from "./comment-actions";
import { CommentBodyText } from "./comment-body-text";

type CommentThreadProps = {
  target: "novel" | "chapter";
  targetId: string;
  isLoggedIn: boolean;
  currentUserId?: string | null;
  comments: CommentItem[];
};

type CommentItem = {
  id: string;
  body: string;
  status: string;
  editedAt: Date | null;
  createdAt: Date;
  userId: string;
  user: { name: string };
  replies: ReplyItem[];
};

type ReplyItem = {
  id: string;
  body: string;
  status: string;
  editedAt: Date | null;
  createdAt: Date;
  userId: string;
  user: { name: string };
};

export function CommentThread({ target, targetId, isLoggedIn, currentUserId, comments }: CommentThreadProps) {
  if (!comments.length) {
    return <p className="rounded-md bg-[#06272b] p-4 text-zinc-400">Nenhum comentario ainda.</p>;
  }

  return (
    <div className="grid gap-3">
      {comments.map((comment) => (
        <article key={comment.id} id={`comment-${comment.id}`} className="rounded-md bg-[#06272b] p-3">
          <CommentBody comment={comment} />
          {comment.status !== "REMOVED" ? (
            <CommentActions
              target={target}
              targetId={targetId}
              commentId={comment.id}
              body={comment.body}
              isLoggedIn={isLoggedIn}
              canEdit={currentUserId === comment.userId}
              allowReply
            />
          ) : null}
          {comment.replies.length ? (
            <div className="mt-3 grid gap-2 border-l border-white/10 pl-3">
              {comment.replies.map((reply) => (
                <div key={reply.id} id={`comment-${reply.id}`} className="rounded-md bg-black/35 p-3">
                  <CommentBody comment={reply} />
                  {reply.status !== "REMOVED" ? (
                    <CommentActions
                      target={target}
                      targetId={targetId}
                      commentId={reply.id}
                      body={reply.body}
                      isLoggedIn={isLoggedIn}
                      canEdit={currentUserId === reply.userId}
                      allowReply={false}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function CommentBody({ comment }: { comment: CommentItem | ReplyItem }) {
  const removed = comment.status === "REMOVED";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold">{removed ? "Moderacao" : comment.user.name}</p>
        <span className="text-xs text-zinc-500">{comment.createdAt.toLocaleString("pt-BR")}</span>
        {comment.editedAt && !removed ? <span className="text-xs text-zinc-500">editado</span> : null}
      </div>
      {removed ? (
        <p className="mt-1 whitespace-pre-wrap italic text-zinc-500">
          Comentario removido pelo administrador.
        </p>
      ) : (
        <CommentBodyText key={comment.body} body={comment.body} />
      )}
    </>
  );
}
