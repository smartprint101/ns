import { listFactorySummaries } from "@/server/services/masters";
import { requireUser } from "@/server/auth";
import { PageHead } from "@/components/page-head";
import { FactoriesClient } from "@/components/forms/masters-client";
import { bn } from "@/lib/bn";

export const dynamic = "force-dynamic";

export default async function FactoriesPage() {
  const user = await requireUser();
  const rows = await listFactorySummaries();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="ফ্যাক্টরি" sub={`${bn(rows.length)}টি ফ্যাক্টরি — কোথায় কী কাজ দেওয়া আছে সব এখানে`} />
      <FactoriesClient rows={rows} role={user.role} />
    </div>
  );
}
