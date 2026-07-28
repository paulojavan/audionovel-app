import { createHash } from "node:crypto";

export function hashSessionValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
