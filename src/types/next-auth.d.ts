import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string | null;
      plan?: string | null;
      subscriptionStatus?: string | null;
      premiumUntil?: string | null;
      isBlocked?: boolean | null;
      sessionId?: string | null;
      sessionInvalid?: boolean | null;
    };
  }

  interface User {
    role?: string | null;
    plan?: string | null;
    subscriptionStatus?: string | null;
    premiumUntil?: string | null;
    isBlocked?: boolean | null;
    sessionId?: string | null;
    sessionInvalid?: boolean | null;
    sessionCheckedAt?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string | null;
    plan?: string | null;
    subscriptionStatus?: string | null;
    premiumUntil?: string | null;
    isBlocked?: boolean | null;
    sessionId?: string | null;
    sessionInvalid?: boolean | null;
  }
}
