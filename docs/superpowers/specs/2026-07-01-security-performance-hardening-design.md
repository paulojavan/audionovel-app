# Security and Performance Hardening Design

## Objective

Correct the security, privacy, performance, duplication, and repository-hygiene findings from the 2026-07-01 audit without discarding the existing uncommitted registration, proxy, and resumable-audio-download work.

The implementation must preserve these product rules:

- The upstream audio URL remains server-only for regular users.
- Offline audio remains available after logout and is reusable only when the same account signs in again.
- The existing PostgreSQL/Aiven database is used for distributed rate limiting; no Redis or new managed service is introduced.
- Existing premium authorization semantics remain unchanged.

## Architecture

### Account-scoped offline storage

Client-side offline state will be partitioned by an opaque account scope derived from the authenticated user ID. The root layout will pass the current account scope to a small client lifecycle component, which will persist it for the service worker and audio cache. Explicit logout or forced blocked-user logout switches to an anonymous scope but does not delete the previous account's audio.

The service worker will stop caching arbitrary authenticated navigation responses. It may cache the public offline fallback and an account-scoped `/offline` shell only. Profile, billing, notification, and admin HTML must never enter CacheStorage. A later login by the same account restores that account's scope; a different account cannot address the prior account's page or audio keys.

Existing unscoped audio records cannot be attributed safely and will be removed during the storage upgrade instead of being assigned to the first account that logs in.

### Audio delivery

Online playback will stream from `/api/chapters/{id}/audio` and will no longer download, buffer, encrypt, and persist the full audio during player mount. The resumable `downloadAudioBuffer` behavior already present in the worktree will remain and will be used only by the explicit offline-download flow.

The upstream URL remains inside the server route. Public chapter-page data will use a DTO/select that omits `audioUrl`; the media route will perform its own narrow source lookup after authorization. The administrative editor may continue receiving the real URL because setting or replacing the source is an administrative capability.

The media proxy will:

- require an explicit hostname allowlist in production;
- reject credentials embedded in URLs;
- disable automatic redirects and validate any deliberately followed redirect hop;
- apply an upstream timeout;
- preserve byte-range behavior;
- avoid incrementing views before a successful playback action.

The browser can still observe the application proxy URL and playable bytes. The design protects the upstream storage URL and authorization boundary; it does not claim to provide DRM.

### View and progress tracking

Chapter pages will not mutate the database during server rendering. A client-side tracker will record a page view only after a real browser mount. Audio playback can also report the first play without duplicate increments. YouTube pages will no longer mark listening progress completed merely because the page rendered.

The view endpoint will authenticate the active session, validate chapter publication/access, apply distributed rate limiting, and perform the counter updates.

### Distributed rate limiting

A Prisma `RateLimitBucket` model and matching PostgreSQL deployment SQL will store:

- a stable hashed key;
- request count;
- window expiration;
- update timestamp.

An atomic PostgreSQL upsert will reset expired windows or increment live windows and return the resulting count. Expired rows will be removed opportunistically. Raw IP/email material will be hashed before storage.

Sensitive anonymous and authenticated endpoints will await the distributed limiter. The credentials provider will enforce both IP and normalized-email limits before password verification. Proxy-derived IP headers will be consumed through one helper with documented Coolify trust assumptions.

### Billing hardening

Mercado Pago webhooks will fail closed when the webhook secret, request ID, signature, or a fresh timestamp is missing or invalid. The route will return a configuration error when the server secret is absent and an authentication error for invalid signatures.

Approved payments will be applied only when:

- the payment belongs to a local checkout intent;
- the intent is unexpired and unused;
- the expected user matches when reconciliation is initiated from a signed-in return;
- paid amount and currency exactly match the active plan;
- the intent is claimed atomically before Premium time is extended.

Provider payment ID and event ID uniqueness remain the idempotency backstop. Legacy external-reference parsing will not be allowed to bypass local intent validation.

### URL and response security

Media and image hosts will be configured from explicit environment variables. Next Image remote patterns will be built from that allowlist instead of accepting all HTTPS hosts.

Production responses will add HSTS, a Content Security Policy compatible with Next.js, YouTube no-cookie embeds, local blobs, and the configured image/media hosts, plus `Permissions-Policy`. Existing `nosniff`, frame, and referrer protections remain.

### Password reset schema

Password-reset requests will stop executing `CREATE TABLE` and `CREATE INDEX` statements. The existing Prisma `PasswordResetToken` model becomes the only runtime access path. Token invalidation and single-use confirmation will use Prisma transactions and conditional updates.

Schema deployment SQL will include both password-reset indexes, if still needed for installations created outside Prisma migrations, and the new rate-limit table. Runtime request handling will contain no DDL.

### Query bounds and shared authorization

Admin users, offline downloads, and unread notifications will have explicit limits and pagination or bounded result sets. Existing focused Prisma selects remain in place.

A shared `requireAdmin()` helper will replace the repeated `requireUser()` plus role check in admin APIs. It will return the same 401/403 response shapes as the current handlers.

### Repository cleanup

The implementation will:

- rewrite `.gitignore` without null bytes while preserving all current ignore rules;
- remove the tracked empty `.codex-next-dev.err`;
- remove unreferenced default Next.js SVG assets;
- keep intentional duplicate PWA icon aliases;
- preserve all unrelated user changes.

## Error handling

- Security configuration missing in production fails closed with a non-secret public error.
- Provider and upstream failures are logged server-side without credentials, reset tokens, or upstream media URLs.
- Offline storage failures fall back to online streaming without crossing account scopes.
- Database rate-limit failures fail closed for login, password reset, registration, billing, and admin mutation endpoints. Non-sensitive progress telemetry may fail without blocking playback, but must not bypass media authorization.
- Invalid or stale payment notifications are acknowledged or rejected without mutating subscription state.

## Testing

Every behavior change will follow red-green-refactor:

- service-worker tests prove private pages are not cached and account scopes are isolated;
- audio-cache tests prove online playback does not trigger full download while explicit offline download remains resumable and account-scoped;
- media URL tests cover allowlists, URL credentials, redirects, and production configuration;
- rate-limit tests cover atomic reset/increment semantics, hashing, login limits, and expired-row cleanup;
- billing tests cover missing secrets, stale signatures, amount/currency mismatch, expired/used intent, idempotency, and successful application;
- chapter tests prove rendering has no database side-effect trigger and the tracker records a bounded view;
- password-reset tests prove runtime DDL is absent and tokens remain single-use;
- admin authorization and query-bound tests protect the shared helper and pagination;
- config/static tests assert CSP/HSTS and removal of wildcard image hosts.

Final verification will run the focused tests during each cycle, followed by the complete `npm test`, `npm run lint`, `npm run build`, `npm audit`, secret scan, and `git diff --check`.

## Deployment notes

The code change will include the PostgreSQL SQL required for `RateLimitBucket` and any password-reset schema/index normalization. It will not mutate the live Aiven database automatically. Deployment must configure the media/image hostname allowlists before the hardened build is promoted.
