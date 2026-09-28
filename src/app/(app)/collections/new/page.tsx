import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";
import { DirectCollectionForm } from "@/components/forms/collection-forms";
import { listAccountsWithBalances } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  const accounts = await listAccountsWithBalances();
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন কালেকশন" sub="আয়ের নাম, কত টাকা এবং টাকা কোথায় এসেছে লিখে সেভ করুন" />
      <Card className="p-4 sm:p-5">
        <DirectCollectionForm accounts={accounts} />
      </Card>
    </div>
  );
}
