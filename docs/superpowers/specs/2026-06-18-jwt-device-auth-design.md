# JWT and Device Session Auth Design

## Goal

Replace Google/NextAuth authentication with local database registration, password login, JWT cookies, device-limited sessions, and suspicious behavior detection for Audio Novel BR.

The new system must keep the current protected app behavior working while adding account-sharing resistance:

- Users register with name, email, and password.
- Users login with email and password.
- Authenticated state is represented by a signed JWT in an `httpOnly` cookie.
- Every JWT maps to an active server-side session stored in the database.
- Each login creates a unique session associated with a user/device.
- A user can have at most 2 active devices.
- Suspicious behavior revokes all sessions for that user and creates an admin-visible alert.
- Suspicious behavior does not automatically block the account.

## Current Context

The app currently uses NextAuth with Google OAuth and a development credentials provider. The main dependencies on NextAuth are:

- `src/lib/auth.ts`: NextAuth provider/callback configuration.
- `src/proxy.ts`: reads NextAuth JWT with `getToken`.
- `src/lib/api.ts`: `requireUser()` uses `getServerSession(authOptions)`.
- Server pages use `getServerSession(authOptions)` directly.
- Client components use `signIn` and `signOut` from `next-auth/react`.
- The route `src/app/api/auth/[...nextauth]/route.ts` exposes NextAuth handlers.
- Session typing lives in `src/types/next-auth.d.ts`.

The replacement must provide equivalent user data to existing pages:

- `id`
- `name`
- `email`
- `role`
- `plan`
- `subscriptionStatus`
- `premiumUntil`
- `isBlocked`

## Chosen Approach

Use a hybrid model:

- JWT in a secure cookie for request authentication.
- Server-side `UserSession` row for revocation, device limit, and activity tracking.

This is preferred over JWT-only auth because JWT-only sessions are hard to revoke and cannot reliably enforce active-device limits. It is preferred over opaque-session-only auth because the requested architecture explicitly asks for JWT authentication.

## Authentication Flows

### Registration

Route:

- `POST /api/auth/register`

Request body:

- `name`
- `email`
- `password`

Validation:

- Name required, trimmed.
- Email normalized to lowercase.
- Password minimum 8 characters.
- Reject duplicate email.
- Respect the existing `registrationsEnabled` system setting.
- Rate-limit registration attempts by IP.

Behavior:

- Hash password with a secure password hashing helper.
- Create user with role `USER`, plan `FREE`, subscription status `NONE`.
- Do not login automatically unless explicitly chosen during implementation. The initial design will redirect/show success and ask the user to login.

Password hashing:

- Use Node `crypto.scrypt` with random salt and timing-safe comparison.
- Store hashes in a structured string: `scrypt$N$r$p$salt$hash`.
- Keep hashing logic isolated in `src/lib/password.ts`.

### Login

Route:

- `POST /api/auth/login`

Request body:

- `email`
- `password`
- `deviceId`
- optional `deviceName`

Validation:

- Email normalized to lowercase.
- Password required.
- Device ID required or generated client-side before submit.
- Rate-limit login attempts by IP and by email.

Behavior:

1. Find user by email.
2. Validate password hash.
3. Reject blocked users with existing blocked-user message.
4. Check failed-attempt history.
5. Create a cryptographically random session ID.
6. Create a cryptographically random JWT ID.
7. Create or update device metadata.
8. Enforce active-device limit.
9. If the login is allowed, store a `UserSession`.
10. Sign JWT with claims:
    - `sub`: user ID.
    - `sid`: session ID.
    - `jti`: JWT ID.
    - `role`: user role.
    - `iat`.
    - `exp`.
11. Set `auth_token` as `httpOnly`, `sameSite=lax`, `secure` in production.
12. Return success and optional redirect target.

If active-device limit or suspicious behavior is detected:

- Revoke all active sessions for that user.
- Create a `SecurityEvent`.
- Clear auth cookie.
- Return a security error telling the user to login again.
- Do not block the user automatically.

### Logout

Route:

- `POST /api/auth/logout`

Behavior:

- Read current session from cookie.
- Revoke current `UserSession`.
- Clear auth cookie.
- Redirect or return success.

### Logout All Devices

Route:

- `POST /api/auth/logout-all`

Behavior:

- Requires active user.
- Revoke all active sessions for the user.
- Clear current auth cookie.
- Create optional security/audit event.

This route can be used later from the user profile.

## Session and Device Model

Add model `UserSession`:

- `id`: primary ID, random/cuid.
- `userId`.
- `sessionId`: unique, random, not guessable.
- `jwtIdHash`: hash of JWT ID or token identifier.
- `deviceIdHash`: hash of stable device ID.
- `deviceName`: optional label.
- `userAgent`: full or truncated user-agent.
- `userAgentHash`: normalized hash for comparison.
- `ipAddress`: latest IP string.
- `ipPrefix`: privacy-preserving prefix for comparison.
- `createdAt`.
- `lastSeenAt`.
- `expiresAt`.
- `revokedAt`.
- `revokedReason`.
- `suspiciousScore`: integer.

Indexes:

- `userId`, `revokedAt`, `expiresAt`.
- `sessionId`.
- `deviceIdHash`.

Add model `LoginAttempt`:

- `id`.
- `email`.
- `userId` optional.
- `ipAddress`.
- `userAgent`.
- `success`.
- `reason`.
- `createdAt`.

Indexes:

- `email`, `createdAt`.
- `ipAddress`, `createdAt`.

Add model `SecurityEvent`:

- `id`.
- `userId`.
- `type`.
- `severity`.
- `message`.
- `metadataJson`.
- `resolvedAt`.
- `createdAt`.

Event types:

- `DEVICE_LIMIT_EXCEEDED`
- `SESSION_USER_AGENT_CHANGED`
- `SESSION_IP_CHANGED_FREQUENTLY`
- `LOGIN_FAILURE_SPIKE`
- `SESSION_REVOKED_ALL`

Add relation fields to `User`:

- `sessions`
- `loginAttempts`
- `securityEvents`

## Device Limit Rule

Limit:

- Maximum 2 active devices per user.

Definition of active device:

- A non-revoked, non-expired `UserSession` grouped by `deviceIdHash`.

On login:

1. Load active sessions for user.
2. Count distinct active `deviceIdHash` values.
3. If current device already has an active session, allow login and revoke older sessions for that same device if needed.
4. If current device is new and there are fewer than 2 active devices, allow login.
5. If current device is new and there are already 2 active devices:
   - Revoke all user sessions.
   - Create `SecurityEvent` type `DEVICE_LIMIT_EXCEEDED`.
   - Return security error.

This means a user may use 2 devices normally. A third device triggers a forced reset of all sessions, which makes account sharing inconvenient without permanently blocking legitimate users.

## Suspicious Behavior Detection

Initial detection should be deterministic and conservative.

Signals:

1. Third active device attempts login.
2. Same session appears with a materially different user-agent hash.
3. Same session changes IP prefix too often within a short window.
4. Too many failed login attempts for one email within a time window.
5. Too many failed login attempts from one IP within a time window.

Initial thresholds:

- Device limit: more than 2 active devices.
- Email failures: 8 failed attempts in 15 minutes.
- IP failures: 20 failed attempts in 15 minutes.
- User-agent change: immediate security event and session revocation.
- IP prefix churn: 4 distinct prefixes for the same session in 30 minutes.

Actions for high-confidence events:

- Revoke all active sessions for the user.
- Create `SecurityEvent`.
- Clear cookie.
- Redirect/return `SESSION_REVOKED_SECURITY`.
- Do not set `User.isBlocked`.

Actions for lower-confidence events:

- Create `SecurityEvent`.
- Increment session suspicious score.
- Keep session unless threshold is reached.

## Auth Helpers

Create `src/lib/session.ts`:

- `getCurrentSession()`
- `getCurrentUser()`
- `requireUser()`
- `requireAdmin()`
- `createSessionForUser()`
- `revokeSession()`
- `revokeAllUserSessions()`
- `validateSessionToken()`

The return shape should mimic the current session user shape enough that pages can be migrated predictably:

```ts
type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  subscriptionStatus: string;
  premiumUntil: Date | null;
  isBlocked: boolean;
};
```

Create `src/lib/jwt.ts`:

- Sign JWT.
- Verify JWT.
- Read cookie name.
- Clear cookie helper.

Implementation can use Web Crypto or Node crypto HMAC. If adding a library is preferred during planning, use `jose`; otherwise implement HS256 carefully with Node crypto.

## Cookie Design

Cookie:

- Name: `auth_token`.
- `httpOnly: true`.
- `sameSite: "lax"`.
- `secure: process.env.NODE_ENV === "production"`.
- Path `/`.
- Expiration aligned with JWT/session expiration.

Session lifetime:

- Default 30 days.
- Extend `lastSeenAt` opportunistically, not on every static asset.

## Proxy Design

Replace NextAuth `getToken` in `src/proxy.ts`.

Proxy should:

- Allow public pages:
  - `/`
  - `/login`
  - `/cadastro`
- Allow public auth APIs:
  - `/api/auth/login`
  - `/api/auth/register`
  - `/api/auth/logout`
- Allow static assets.
- For protected pages:
  - Verify JWT signature and expiration.
  - Decode `sub` and `sid`.
  - Perform an optimistic check only.

Important Next.js 16 note:

- Proxy should not become the only full authorization layer.
- Full session validation against the database must happen in server helpers and APIs.

Because database work in Proxy is discouraged, Proxy can verify the token cryptographically and redirect obviously invalid requests. Server pages/APIs must call `getCurrentUser()` or `requireUser()` to confirm the database session is active.

## Server Page Migration

Replace direct `getServerSession(authOptions)` calls with:

- `getCurrentUser()` for optional session pages.
- `requirePageUser()` or `getCurrentUser()` + `redirect()` for required session pages.
- `requireAdmin()` for admin layout.

Pages affected:

- root layout.
- home page.
- admin layout.
- profile.
- offline.
- chapters.
- subscriptions.
- novel page.
- library.
- notifications.

## API Migration

Update `src/lib/api.ts` so existing API routes keep importing:

- `requireUser()`
- `canPlayChapter()`

`requireUser()` should use the new JWT/session validation.

APIs affected include:

- comments.
- progress.
- notifications.
- admin routes.
- offline prepare.
- reactions.
- billing checkout.
- favorites.
- chapter audio.

## UI Changes

### Login Page

Replace Google login button with:

- Email input.
- Password input.
- Submit button.
- Error message area.
- Link to cadastro.

The form calls:

- `POST /api/auth/login`.

On success:

- Redirect to callback URL or `/`.

### Cadastro Page

Replace Google copy with:

- Name input.
- Email input.
- Password input.
- Confirm password input.
- Submit button.
- Link to login.

The form calls:

- `POST /api/auth/register`.

On success:

- Show success and link to login, or redirect to login with status message.

### User Menu Logout

Replace NextAuth `signOut()` with:

- `POST /api/auth/logout`.
- redirect to `/`.

### Blocked Session Logout

Replace NextAuth `signOut()` with local logout/clear-cookie behavior or remove the component if server redirects handle this fully.

## Admin Security Alerts

Add admin visibility for `SecurityEvent`.

Minimum scope:

- On admin dashboard, show recent unresolved security events.
- On user detail page, show security events for that user.

Optional action:

- Mark event as resolved.

The first implementation should show:

- Type.
- Severity.
- Message.
- Created date.
- User email/name.
- Resolved/unresolved state.

## Existing Data Migration

Existing seeded users have placeholder hashes:

- `GOOGLE_OAUTH`
- `DEV_AUTH_BYPASS`

The seed must be updated to create real password hashes for local testing.

Recommended test accounts:

- Admin:
  - Email: `admin@audio-novel-br.local`
  - Password: `Admin12345`
  - Role: `ADMIN`
- User:
  - Email: `teste@audio-novel-br.local`
  - Password: `Teste12345`
  - Role: `USER`

Existing real Google users cannot login until they set/reset a password. Since password reset is outside this design, the initial migration can leave them unable to login unless an admin or seed sets a password hash.

## Error Messages

Login errors should avoid revealing whether an email exists.

Examples:

- Invalid credentials: "Email ou senha invalidos."
- Blocked user: "Usuario bloqueado. Entre em contato com o administrador via Discord."
- Device/security reset: "Sessao encerrada por seguranca. Entre novamente."
- Too many attempts: "Muitas tentativas. Aguarde alguns minutos e tente novamente."
- Registration disabled: "Novos cadastros estao temporariamente desativados."

## Security Requirements

- Never store plain passwords.
- Never expose JWT secret to client.
- Use `httpOnly` cookies.
- Hash session/JWT identifiers stored in database where practical.
- Use random bytes for session IDs and JWT IDs.
- Normalize emails.
- Rate-limit login and registration.
- Validate all request bodies with Zod.
- Keep admin routes guarded server-side.
- Keep blocked-user checks server-side.
- Revoke sessions on suspicious high-confidence behavior.
- Do not auto-block accounts for suspicious behavior in this phase.

## Testing Strategy

Unit tests:

- Password hash and verify.
- JWT sign/verify/expiry.
- Device limit rule.
- Suspicious behavior thresholds.
- Session revocation.

Integration-level route tests if feasible:

- Register creates user with hash.
- Login creates session and cookie.
- Third device login revokes all sessions.
- Revoked session cannot access protected API.
- Logout revokes current session.

Manual verification:

- Register user.
- Login.
- Access protected page.
- Logout.
- Login on 2 devices/browsers.
- Attempt third device.
- Confirm sessions revoked.
- Confirm admin event appears.
- Confirm blocked users cannot login.
- Confirm premium/admin flows still work.

## Rollout Plan

1. Add schema and auth helpers while keeping existing code untouched.
2. Add tests for password, JWT, sessions, device policy.
3. Add register/login/logout APIs.
4. Replace UI login/cadastro/logout.
5. Replace `requireUser()` internals.
6. Migrate server pages from `getServerSession`.
7. Replace proxy token validation.
8. Remove NextAuth route/provider/types/imports.
9. Add admin security event views.
10. Update seed and environment docs.
11. Run tests, lint, build.

## Out of Scope For This Change

- Email verification.
- Password reset by email.
- Two-factor authentication.
- Geolocation by IP provider.
- Push/email alerting for security events.
- Automatic account blocking.
- Device management UI for the user.

These can be added later without changing the core session model.

