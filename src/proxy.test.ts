import assert from "node:assert/strict";
import { test } from "node:test";
import * as proxyModule from "./proxy";

test("identifica chamadas de Server Action em app que nao possui Server Actions", () => {
  const isUnexpectedServerActionRequest = (
    proxyModule as typeof proxyModule & {
      isUnexpectedServerActionRequest?: (headers: Headers) => boolean;
    }
  ).isUnexpectedServerActionRequest;
  assert.equal(typeof isUnexpectedServerActionRequest, "function");
  if (!isUnexpectedServerActionRequest) return;

  assert.equal(isUnexpectedServerActionRequest(new Headers({ "Next-Action": "x" })), true);
  assert.equal(isUnexpectedServerActionRequest(new Headers()), false);
});
