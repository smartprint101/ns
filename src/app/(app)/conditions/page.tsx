import { listPendingConditions } from "@/server/services/regular-orders";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { PageHead } from "@/components/page-head";
import { ConditionReceive } from "@/components/forms/condition-receive";

export const dynamic = "force-dynamic";

export default async function ConditionsPage() {
  const [accounts, pending] = await Promise.all([listAccountsWithBalances(), listPendingConditions()]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="কন্ডিশন রিসিভ" sub="টাকার পরিমাণ লিখে কাছাকাছি কন্ডিশন খুঁজে নিন" />
      <ConditionReceive
        accounts={accounts}
        pendingList={pending.map((p) => ({
          orderId: p.order.id,
          orderNo: p.order.orderNo,
          customerName: p.customer.name,
          totalAmount: p.order.totalAmount,
          createdAt: p.order.createdAt,
        }))}
      />
    </div>
  );
}
