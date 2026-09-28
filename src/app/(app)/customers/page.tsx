import { listCustomerSummaries } from "@/server/services/masters";
import { PageHead, SearchBox } from "@/components/page-head";
import { CustomersClient } from "@/components/forms/masters-client";
import { bn } from "@/lib/bn";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await listCustomerSummaries(q);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="রেগুলার কাস্টমার" sub={`${bn(rows.length)} জন কাস্টমার`} />
      <SearchBox placeholder="নাম / ফোন…" defaultValue={q} />
      <CustomersClient rows={rows} />
    </div>
  );
}
