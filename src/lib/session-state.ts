type SessionLike = {
  user?: {
    id?: string | null;
    sessionId?: string | null;
    sessionInvalid?: boolean | null;
    isBlocked?: boolean | null;
  } | null;
} | null;

type ActiveSessionLike = {
  user: {
    id: string;
    sessionId: string;
    sessionInvalid?: boolean | null;
    isBlocked?: boolean | null;
  };
};

export function hasActiveSessionUser<T extends SessionLike>(session: T): session is NonNullable<T> & ActiveSessionLike {
  const user = session?.user;
  return Boolean(user?.id && user.sessionId && !user.sessionInvalid && !user.isBlocked);
}
