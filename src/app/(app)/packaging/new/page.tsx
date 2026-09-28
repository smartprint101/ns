import { listParties, listFactories, listCylinders } from "@/server/services/masters";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { PackagingOrderForm } from "@/components/forms/packaging-order-form";
import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewPackagingOrderPage() {
  const [parties, factories, cylinders, accounts] = await Promise.all([
    listParties(),
    listFactories(),
    listCylinders(),
    listAccountsWithBalances(),
  ]);
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন প্যাকেজিং অর্ডার" sub="পার্টি → কাজের ধরন → কেজি → বিল → সেভ" />
      <Card className="p-4 sm:p-5">
        <PackagingOrderForm
          parties={parties}
          factories={factories}
          cylinders={cylinders.map((c) => ({ id: c.id, name: c.name, factoryId: c.factoryId, factoryName: c.factory.name }))}
          accounts={accounts}
        />
      </Card>
    </div>
  );
}
