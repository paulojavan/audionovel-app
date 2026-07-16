# Login and Offline Premium Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make login stable across browser/PWA storage conditions, allow three active devices with automatic oldest-device replacement, and keep offline Premium valid until the real subscription expiry.

**Architecture:** Add a server-signed device token with cookie and safe local backup, then serialize device-session replacement inside a database transaction. Upgrade offline licenses to a session-independent v2 device claim, derive every offline expiry from the subscription, and reconcile still-present encrypted downloads before publishing the account-scoped offline shell.

**Tech Stack:** Next.js 16.2.9 App Router and Route Handlers, React 19.2.4, NextAuth 4.24.14 credentials/JWT sessions, Prisma 6.19.3/PostgreSQL, Web Crypto/Node crypto, IndexedDB, service workers, Node test runner with `tsx`.

## Global Constraints

- Read the relevant guides in `node_modules/next/dist/docs/` before changing Next.js APIs; `cookies()` is asynchronous and cookies may only be written in Route Handlers.
- Keep passwords mandatory; a device token identifies a device but never authenticates an account.
- Allow exactly three distinct active device hashes.
- A fourth valid login replaces only the least recently seen device, automatically and transactionally.
- Premium offline expiry for users equals the real `premiumUntil`; admins without Premium retain a 24-hour technical grant.
- Keep private caches, keys, metadata, and licenses isolated by account and device.
- Write each regression test first, run it to observe the intended failure, then add only the implementation required to pass.
- Do not modify or stage the existing untracked `.vscode/` directory.

---

### Task 1: Signed stable device identity

**Files:**
- Create: `src/lib/device-identity.ts`
- Create: `src/lib/device-identity.test.ts`
- Create: `src/app/api/auth/device/route.ts`
- Modify: `src/lib/client-device.ts`
- Modify: `src/lib/client-device.test.ts`
- Modify: `src/components/login-form.tsx`
- Modify: `src/lib/login-rate-limit.test.ts`

**Interfaces:**
- Produces: `createDeviceToken(deviceId, secret?)`, `verifyDeviceToken(token, secret?)`, `getDeviceIdFromToken(token, secret?)`, `ensureClientDeviceToken(fetcher?)`.
- Cookie: `audio_novel_br_device`, signed value `v1.<base64url id>.<base64url HMAC>`; `Secure` in production, `SameSite=Lax`, path `/`, one-year maximum age.

- [ ] **Step 1: Write failing unit and wiring tests**

```ts
test("signed device token round-trips and rejects tampering", () => {
  const token = createDeviceToken("device-1", "secret");
  assert.equal(getDeviceIdFromToken(token, "secret"), "device-1");
  assert.equal(verifyDeviceToken(`${token}x`, "secret"), false);
});

test("client restores a missing cookie from a signed local backup", async () => {
  const writes: string[] = [];
  const token = await ensureClientDeviceToken(async (_url, init) => {
    assert.match(String(init?.body), /signed-backup/);
    return Response.json({ token: "signed-backup" });
  }, createMemoryStorage("signed-backup", writes));
  assert.equal(token, "signed-backup");
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx tsx --test src/lib/device-identity.test.ts src/lib/client-device.test.ts src/lib/login-rate-limit.test.ts`

Expected: FAIL because `device-identity.ts`, the route, and `ensureClientDeviceToken` do not exist.

- [ ] **Step 3: Implement signed identity, Route Handler, and safe client preparation**

```ts
export function createDeviceToken(deviceId = randomBytes(32).toString("base64url"), secret = readSecret()) {
  const encodedId = Buffer.from(deviceId).toString("base64url");
  const body = `v1.${encodedId}`;
  const signature = createHmac("sha256", secret).update(`device:${body}`).digest("base64url");
  return `${body}.${signature}`;
}

export function getDeviceIdFromToken(token: string, secret = readSecret()) {
  const [version, encodedId, signature, extra] = token.split(".");
  if (version !== "v1" || !encodedId || !signature || extra) return null;
  const body = `${version}.${encodedId}`;
  const expected = createHmac("sha256", secret).update(`device:${body}`).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  return Buffer.from(encodedId, "base64url").toString("utf8") || null;
}
```

The POST Route Handler must validate the cookie first, then a JSON `backupToken`, otherwise create a token; set the cookie through `NextResponse.cookies.set`. The login form must await `ensureClientDeviceToken()`, submit the signed token as `deviceToken`, catch preparation/network failures, and always leave the pending state.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/device-identity.test.ts src/lib/client-device.test.ts src/lib/login-rate-limit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/device-identity.ts src/lib/device-identity.test.ts src/app/api/auth/device/route.ts src/lib/client-device.ts src/lib/client-device.test.ts src/components/login-form.tsx src/lib/login-rate-limit.test.ts
git commit -m "feat: add stable signed device identity"
```

### Task 2: Three-device transactional replacement

**Files:**
- Modify: `src/lib/device-session-policy.ts`
- Modify: `src/lib/device-session-policy.test.ts`
- Modify: `src/lib/device-session.ts`
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Consumes: `getDeviceIdFromToken(deviceToken)` from Task 1.
- Produces: `selectDeviceToReplace(activeSessions, currentDeviceHash, 3)` and `createDeviceSession()` that returns `{ allowed: true, sessionId, expiresAt, replacedDeviceHash }`.

- [ ] **Step 1: Write failing policy tests**

```ts
test("accepts three devices and replaces only the least recent fourth", () => {
  assert.equal(evaluateDeviceLogin({ activeDeviceHashes: ["a", "b"], currentDeviceHash: "c", maxDevices: 3 }).reason, "NEW_DEVICE_ALLOWED");
  const replacement = selectDeviceToReplace([
    { deviceIdHash: "a", lastSeenAt: "2026-01-01", createdAt: "2026-01-01", id: "1" },
    { deviceIdHash: "b", lastSeenAt: "2026-02-01", createdAt: "2026-02-01", id: "2" },
    { deviceIdHash: "c", lastSeenAt: "2026-03-01", createdAt: "2026-03-01", id: "3" },
  ], "d", 3);
  assert.equal(replacement, "a");
});
```

- [ ] **Step 2: Run the policy tests and confirm RED**

Run: `npx tsx --test src/lib/device-session-policy.test.ts`

Expected: FAIL because the limit and replacement policy are missing.

- [ ] **Step 3: Implement deterministic policy and transactional persistence**

```ts
export function selectDeviceToReplace(sessions: DeviceSessionCandidate[], current: string, maxDevices: number) {
  const devices = groupOldestSessionPerDevice(sessions);
  if (devices.has(current) || devices.size < maxDevices) return null;
  return [...devices.values()].sort(compareByLastSeenCreatedAndId)[0]?.deviceIdHash ?? null;
}
```

In `createDeviceSession`, run an interactive Prisma transaction, lock the user row with `SELECT ... FOR UPDATE`, load active sessions, revoke the current device or selected oldest device, insert the new session, and insert a `DEVICE_REPLACED` security event when replacement occurs. Set `MAX_ACTIVE_DEVICES = 3`. In `auth.ts`, replace raw client `deviceId` trust with `getDeviceIdFromToken(credentials.deviceToken)` and remove `DEVICE_LIMIT_EXCEEDED` UI behavior.

- [ ] **Step 4: Run auth/device tests and confirm GREEN**

Run: `npx tsx --test src/lib/device-session-policy.test.ts src/lib/client-device.test.ts src/lib/login-rate-limit.test.ts`

Expected: PASS and no test expects mass revocation.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/device-session-policy.ts src/lib/device-session-policy.test.ts src/lib/device-session.ts src/lib/auth.ts
git commit -m "fix: replace oldest device at three-session limit"
```

### Task 3: Offline license v2 and subscription-derived expiry

**Files:**
- Modify: `src/lib/offline-license.ts`
- Modify: `src/lib/offline-license.test.ts`
- Modify: `src/lib/offline-access.ts`
- Modify: `src/lib/offline-access.test.ts`
- Modify: `src/app/offline/page.tsx`
- Modify: `src/components/offline-premium-gate.tsx`
- Modify: `src/lib/offline-premium-gate-wiring.test.ts`

**Interfaces:**
- Produces: v2 payload `{ version: 2, userId, deviceId, issuedAt, expiresAt }` and backward-compatible v1 verification.
- Produces: access states `allowed | expired | clock-rollback | device-mismatch | invalid`.

- [ ] **Step 1: Write failing license and access tests**

```ts
test("premium with thirty days receives thirty days instead of twenty-four hours", () => {
  assert.equal(getOfflineLicenseExpiry("2026-08-09T12:00:00Z", NOW).toISOString(), "2026-08-09T12:00:00.000Z");
});

test("v2 survives session rotation on the same device", async () => {
  const license = createOfflineLicense({ userId: "u", deviceId: "d", premiumUntil: "2026-08-09T12:00:00Z", now: NOW, secret: SECRET });
  const result = await verifyOfflineLicenseForClient({ ...license, userId: "u", deviceId: "d", now: NOW.getTime() + 2 * 86_400_000 });
  assert.equal(result.state, "allowed");
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx tsx --test src/lib/offline-license.test.ts src/lib/offline-access.test.ts src/lib/offline-premium-gate-wiring.test.ts`

Expected: FAIL because expiry is capped at 24 hours and payload v2 is absent.

- [ ] **Step 3: Implement v2, v1 compatibility, and accurate messages**

```ts
export function getOfflineLicenseExpiry(premiumUntil: Date | string | null, now = new Date(), role?: string | null) {
  if (role === "ADMIN" && !premiumUntil) return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiry = premiumUntil ? new Date(premiumUntil) : null;
  if (!expiry || !Number.isFinite(expiry.getTime()) || expiry <= now) throw new Error("Premium expirado.");
  return expiry;
}
```

Create v2 whenever `deviceId` is present. Verify v1 against `sessionId` and v2 against `deviceId`. On the page, read and verify the signed device cookie; if unavailable, retain a v1 fallback for the current online session. The gate must show “Seu Premium venceu” only for `expired`; invalid/device mismatch must ask the user to connect and update access.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/offline-license.test.ts src/lib/offline-access.test.ts src/lib/offline-premium-gate-wiring.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/offline-license.ts src/lib/offline-license.test.ts src/lib/offline-access.ts src/lib/offline-access.test.ts src/app/offline/page.tsx src/components/offline-premium-gate.tsx src/lib/offline-premium-gate-wiring.test.ts
git commit -m "fix: align offline license with premium expiry"
```

### Task 4: Recoverable local audio and bulk renewal

**Files:**
- Create: `src/lib/offline-renewal.ts`
- Create: `src/lib/offline-renewal.test.ts`
- Create: `src/app/api/offline/renew/route.ts`
- Modify: `src/lib/audio-cache.ts`
- Modify: `src/lib/audio-cache.test.ts`

**Interfaces:**
- Produces: `getRecoverableOfflineItems(accountScope)` that does not delete expired blobs.
- Produces: `extendOfflineAudioExpiry(accountScope, chapterId, expiresAt)`.
- Route input: `{ chapterIds: string[] }`, maximum 100 unique IDs.
- Route output: `{ items: Array<{ chapterId, cacheKey, expiresAt }> }`.

- [ ] **Step 1: Write failing renewal tests**

```ts
test("normalizes at most one hundred unique chapter IDs", () => {
  assert.deepEqual(normalizeRenewalChapterIds([" a ", "a", "b"]), ["a", "b"]);
  assert.throws(() => normalizeRenewalChapterIds(Array.from({ length: 101 }, (_, index) => `c${index}`)), /100/);
});

test("extending an expired encrypted record keeps its bytes", async () => {
  const before = await seedExpiredAudioRecord();
  assert.equal(await extendOfflineAudioExpiry("u", "c", FUTURE), true);
  assert.deepEqual((await readSeededAudioRecord()).data, before.data);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx tsx --test src/lib/offline-renewal.test.ts src/lib/audio-cache.test.ts`

Expected: FAIL because raw recovery and renewal functions are absent.

- [ ] **Step 3: Implement validation, authorized renewal, and local expiry extension**

```ts
export function normalizeRenewalChapterIds(values: unknown) {
  if (!Array.isArray(values)) throw new Error("Capitulos invalidos.");
  const ids = [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
  if (ids.length > 100) throw new Error("O limite e de 100 capitulos.");
  return ids;
}
```

The Route Handler must call `requireUser`, rate-limit by user, require active Premium, validate each published audio chapter with existing access rules, and upsert renewal rows with the shared subscription expiry. The audio-cache functions must read raw IndexedDB records without cleanup and update only `expiresAt`, preserving ciphertext, IV, and MIME type.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/offline-renewal.test.ts src/lib/audio-cache.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/offline-renewal.ts src/lib/offline-renewal.test.ts src/app/api/offline/renew/route.ts src/lib/audio-cache.ts src/lib/audio-cache.test.ts
git commit -m "feat: renew recoverable offline audio grants"
```

### Task 5: Online reconciliation and service-worker ordering

**Files:**
- Create: `src/components/offline-entitlement-sync.tsx`
- Create: `src/lib/offline-entitlement-sync.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/lib/account-scope.ts`
- Modify: `src/lib/account-scope.test.ts`
- Modify: `src/lib/pwa-offline.ts`
- Modify: `src/lib/pwa-offline.test.ts`
- Modify: `public/sw.js`
- Modify: `src/lib/pwa-service-worker-runtime.test.ts`

**Interfaces:**
- Produces: client coordinator rendered only for active Premium/admin accounts.
- Changes `SET_ACCOUNT_SCOPE` to acknowledge `{ ok: true, scope }` through `MessageChannel` before `PREPARE_OFFLINE_PAGE`.

- [ ] **Step 1: Write failing coordinator and ordering tests**

```ts
test("preparation acknowledges account scope before publishing offline page", async () => {
  await prepareOfflinePage("user-1", workerHarness);
  assert.deepEqual(messageTypes, ["SET_ACCOUNT_SCOPE", "PREPARE_OFFLINE_PAGE"]);
});

test("layout mounts reconciliation only for a premium session", () => {
  assert.match(layoutSource, /<OfflineEntitlementSync accountScope=\{activeSession\.user\.id\}/);
  assert.match(layoutSource, /hasPremiumAccess\(activeSession\.user\)/);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx tsx --test src/lib/offline-entitlement-sync.test.ts src/lib/account-scope.test.ts src/lib/pwa-offline.test.ts src/lib/pwa-service-worker-runtime.test.ts`

Expected: FAIL because reconciliation and scope acknowledgement are absent.

- [ ] **Step 3: Implement ordered reconciliation**

The component must ensure the signed device token, read recoverable local items, POST their IDs to `/api/offline/renew`, extend each existing encrypted record, update its local metadata, acknowledge account scope, and only then call `prepareOfflinePage`. Use a per-account `sessionStorage` timestamp to avoid repeating within five minutes; failures remain silent except on `/offline`, where the existing gate explains how to reconnect.

Update the worker `SET_ACCOUNT_SCOPE` handler to reply after `setAccountScope` completes. Bump the worker cache version/revision so online clients receive the corrected shell and chunks.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/offline-entitlement-sync.test.ts src/lib/account-scope.test.ts src/lib/pwa-offline.test.ts src/lib/pwa-service-worker-runtime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/offline-entitlement-sync.tsx src/lib/offline-entitlement-sync.test.ts src/app/layout.tsx src/lib/account-scope.ts src/lib/account-scope.test.ts src/lib/pwa-offline.ts src/lib/pwa-offline.test.ts public/sw.js src/lib/pwa-service-worker-runtime.test.ts
git commit -m "feat: reconcile premium offline access online"
```

### Task 6: Full verification

**Files:**
- Modify only files required by failures directly caused by Tasks 1–5.

**Interfaces:**
- Confirms all public interfaces above work together.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all tests PASS with no failures or unhandled rejections.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0; Next.js 16 compiles all pages and Route Handlers.

- [ ] **Step 4: Inspect the final diff and repository state**

Run: `git diff --check; git status --short`

Expected: no whitespace errors; only intentional source/test changes are present, while `.vscode/` remains untouched.
