import { listParties, listFactories } from "@/server/services/masters";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { listPackagingOrders } from "@/server/services/packaging-orders";
import { listRegularOrders } from "@/server/services/regular-orders";
import { ExpenseForm } from "@/components/forms/expense-form";
import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";
import { bn } from "@/lib/bn";

export const dynamic = "force-dynamic";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ packagingOrderId?: string; regularOrderId?: string; taskId?: string }>;
}) {
  const sp = await searchParams;
  const [parties, factories, accounts, packagingActive, regularActive] = await Promise.all([
    listParties(),
    listFactories(),
    listAccountsWithBalances(),
    listPackagingOrders({ tab: "active" }),
    listRegularOrders({ tab: "active" }),
  ]);
  const orderOptions = [
    ...packagingActive.slice(0, 100).map((r) => ({
      kind: "packaging" as const,
      id: r.order.id,
      label: `PKG-${r.order.orderNo} · ${r.party.name}`,
    })),
    ...regularActive.slice(0, 100).map((r) => ({
      kind: "regular" as const,
      id: r.order.id,
      label: `#${r.order.orderNo} · ${r.customer.name}`,
    })),
  ];  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন খরচ" sub="পরিমাণ → ক্যাটাগরি → বিবরণ → মেথড → সেভ" />
      <Card className="p-4 sm:p-5">
        <ExpenseForm
          accounts={accounts}
          parties={parties}
          factories={factories}
          orderOptions={orderOptions}
          initialPackagingOrderId={sp.packagingOrderId}
          initialRegularOrderId={sp.regularOrderId}
        />
      </Card>
    </div>
  );
}
