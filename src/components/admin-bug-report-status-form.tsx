"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const statuses = [
  { value: "OPEN", label: "Aberto" },
  { value: "IN_REVIEW", label: "Em analise" },
  { value: "RESOLVED", label: "Resolvido" },
];

export function AdminBugReportStatusForm({ reportId, status }: { reportId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();

  function updateStatus(nextStatus: string) {
    setValue(nextStatus);
    startTransition(async () => {
      const response = await fetch(`/api/admin/bug-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setValue(status);
        return;
      }

      router.refresh();
    });
  }

  return (
    <select
      value={value}
      onChange={(event) => updateStatus(event.target.value)}
      disabled={pending}
      className="min-h-10 rounded-md border border-white/10 bg-black px-3 py-2 text-sm font-bold text-white outline-none focus:border-[#18b7bd] disabled:opacity-60"
    >
      {statuses.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
