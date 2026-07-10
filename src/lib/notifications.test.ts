import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "src", "lib", "notifications.ts"), "utf8");

test("contador de notificacoes nao derruba layout em falha transitoria do banco", () => {
  assert.match(source, /isTransientPrismaSessionError/);
  assert.match(source, /try\s*\{[\s\S]*prisma\.notification\.count/);
  assert.match(source, /catch \(error\)[\s\S]*isTransientPrismaSessionError\(error\)[\s\S]*return 0/);
  assert.match(source, /event:\s*"notification_count_database_failure"/);
});
