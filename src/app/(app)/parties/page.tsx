import { listPartySummaries } from "@/server/services/masters";
import { PageHead, SearchBox } from "@/components/page-head";
import { PartiesClient } from "@/components/forms/masters-client";
import { bn } from "@/lib/bn";

export const dynamic = "force-dynamic";

export default async function PartiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await listPartySummaries(q);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="প্যাকেজিং পার্টি" sub={`${bn(rows.length)}টি পার্টি`} />
      <SearchBox placeholder="নাম / ফোন…" defaultValue={q} />
      <PartiesClient rows={rows} />
    </div>
  );
}
