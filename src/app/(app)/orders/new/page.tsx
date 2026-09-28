import { listCustomers } from "@/server/services/masters";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { RegularOrderForm } from "@/components/forms/regular-order-form";
import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [customers, accounts] = await Promise.all([listCustomers(), listAccountsWithBalances()]);
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন রেগুলার অর্ডার" sub="কাস্টমার → মোট টাকা → কালেকশন → সেভ" />
      <Card className="p-4 sm:p-5">
        <RegularOrderForm customers={customers} accounts={accounts} />
      </Card>
    </div>
  );
}
