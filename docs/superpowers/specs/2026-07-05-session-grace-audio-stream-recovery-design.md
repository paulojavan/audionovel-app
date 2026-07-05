# Session Grace and Audio Stream Recovery Design

## Goal

Keep an already validated user session usable through a short, transient Prisma outage and recover online audio playback when the R2 upstream closes a response mid-stream.

The changes must preserve the existing security rules: a revoked, expired, blocked, or missing session remains invalid; a database outage must not allow a new login; and audio authorization, rate limits, offline keys, and URL validation remain enforced.

## Session availability

The JWT stores the timestamp of its last successful device-session validation. A successful validation refreshes this timestamp.

When device-session validation throws a recognized transient Prisma or connectivity error, the JWT callback may preserve the existing session only when:

- the token already has a user ID and device-session ID;
- the token is not already marked invalid;
- its last successful validation occurred no more than five minutes ago.

The transient failure does not count as a successful validation. Requests during the grace window may retry validation at the existing validation interval. Once five minutes have elapsed without a successful validation, the session fails closed.

An explicit validation result showing a missing, expired, revoked, or suspicious session bypasses the grace window and invalidates the token immediately. A user record successfully loaded as blocked also remains blocked immediately. New login attempts continue to require a working database.

Existing JWTs deployed before this change may use their current successful `sessionCheckedAt` value as the initial last-success timestamp. A token with no trustworthy successful timestamp receives no grace.

## Prisma error classification and logging

A small server-only helper classifies only these transient Prisma connection and pool codes: `P1001`, `P1002`, `P1008`, `P1017`, `P2024`, and `P2037`. Unknown errors and known non-transient Prisma errors are rethrown and do not receive grace.

Before the JWT callback preserves a session, it emits one structured, sanitized log entry containing:

- a stable event name;
- UTC timestamp;
- operation name;
- Prisma error code when available;
- whether grace was applied;
- remaining grace duration.

The log must not contain the connection string, SQL, email, session ID, user ID, tokens, or Prisma metadata that could include sensitive values.

## Resumable online audio proxy

The audio Route Handler keeps its existing authorization, chapter lookup, distributed rate limit, media URL validation, offline-key validation, redirect rejection, and response headers.

After the initial R2 response is accepted, the route wraps the upstream body in a server-owned `ReadableStream`. It tracks the number of bytes successfully forwarded. If reading throws or ends before the declared response length, the proxy may make up to two continuation requests using a single open-ended `Range` beginning at the next missing byte.

Continuation is permitted only when the original request and upstream response describe a range that can be resumed unambiguously. Every continuation response must be successful, contain a body, return HTTP 206, and start at the exact requested byte. An invalid continuation terminates recovery instead of risking duplicated or corrupted audio.

Each upstream connection keeps the existing header timeout. The downstream response retains the original status, content type, content range, and total content length so the browser receives one continuous response.

When the browser cancels the request, the proxy aborts the active R2 fetch and reader. Expected downstream cancellation is handled without starting another continuation attempt. Genuine upstream failures receive a sanitized structured log with attempt and byte-offset information.

## Player fallback

The browser player retains its current URL-based streaming behavior. If the media element reports a terminal network error after server recovery is exhausted, the player performs at most one automatic reload:

- remember the current absolute playback position and whether playback was active;
- reload the same application audio endpoint with a retry query value;
- restore the position after metadata loads;
- resume only if playback had been active.

The retry state resets after metadata loads successfully. If the retry also fails, the player stops and shows the existing connection-oriented playback error instead of looping.

Offline encrypted playback and its existing three-attempt Range download remain unchanged.

## Testing

Tests cover:

- grace granted for a previously validated session during a recognized transient Prisma failure;
- grace expires after five minutes;
- successful validation refreshes the timestamp;
- explicit revocation, expiration, suspicious-device result, and blocked user never receive grace;
- unknown errors remain failures;
- sanitized logs exclude identity and connection details;
- an interrupted R2 stream resumes at the exact next byte;
- premature EOF also resumes;
- invalid continuation status or `Content-Range` fails safely;
- client cancellation aborts upstream without retry;
- retry count is bounded;
- the player restores position once and never loops;
- existing offline Range retry behavior remains passing.

The final verification includes targeted tests, the full test suite, lint, and a production build. Database reachability warnings during build are reported separately from the build exit status.

## Non-goals

- Keeping sessions alive indefinitely while the database is unavailable.
- Granting grace to new logins or JWTs without a prior successful validation.
- Bypassing the application by exposing or redirecting users directly to R2.
- Changing subscription, device-limit, offline-expiration, or media-host rules.
- Changing database schema or deployment environment variables.
