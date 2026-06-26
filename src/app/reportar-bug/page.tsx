import { redirect } from "next/navigation";
import { BugReportForm } from "@/components/bug-report-form";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export default async function ReportBugPage() {
  const session = await getActiveServerSession();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-8">
      <BugReportForm />
    </div>
  );
}
