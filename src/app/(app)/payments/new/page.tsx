import { listParties, listCustomers } from "@/server/services/masters";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { PaymentForm } from "@/components/forms/payment-form";
import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ party?: string; customer?: string }> }) {
  const sp = await searchParams;
  const [parties, customers, accounts] = await Promise.all([listParties(), listCustomers(), listAccountsWithBalances()]);
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন পেমেন্ট" sub="পার্টি → অর্ডার (ঐচ্ছিক) → পরিমাণ → মেথড → সেভ" />
      <Card className="p-4 sm:p-5">
        <PaymentForm parties={parties} customers={customers} accounts={accounts} initialPartyId={sp.party} initialCustomerId={sp.customer} />
      </Card>
    </div>
  );
}
