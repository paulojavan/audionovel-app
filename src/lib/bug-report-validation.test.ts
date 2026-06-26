import assert from "node:assert/strict";
import { test } from "node:test";
import { bugReportSchema, bugReportStatusSchema } from "./bug-report-validation";

test("normaliza reporte de bug enviado pelo usuario", () => {
  const parsed = bugReportSchema.parse({
    title: "  Erro no player  ",
    description: "  O audio parou ao trocar de capitulo.  ",
    pageUrl: "/chapters/abc",
  });

  assert.deepEqual(parsed, {
    title: "Erro no player",
    description: "O audio parou ao trocar de capitulo.",
    pageUrl: "/chapters/abc",
  });
});

test("rejeita reporte de bug vazio ou status invalido", () => {
  assert.equal(bugReportSchema.safeParse({ title: "", description: "" }).success, false);
  assert.equal(bugReportStatusSchema.safeParse({ status: "DONE" }).success, false);
  assert.equal(bugReportStatusSchema.safeParse({ status: "RESOLVED" }).success, true);
});
