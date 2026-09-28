import { listParties } from "@/server/services/masters";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { PackagingOrderForm } from "@/components/forms/packaging-order-form";
import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewPackagingOrderPage() {
  const [parties, accounts] = await Promise.all([listParties(), listAccountsWithBalances()]);
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন প্যাকেজিং অর্ডার" sub="পার্টি → কাজের ধরন → কেজি → টোটাল বিল → অ্যাডভান্স" />
      <Card className="p-4 sm:p-5">
        <PackagingOrderForm parties={parties} accounts={accounts} />
      </Card>
    </div>
  );
}
