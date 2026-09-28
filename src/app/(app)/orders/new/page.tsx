import { listCustomers } from "@/server/services/masters";
import { RegularOrderForm } from "@/components/forms/regular-order-form";
import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const customers = await listCustomers();
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন রেগুলার অর্ডার" sub="কাস্টমার → পণ্য → দাম → সেভ" />
      <Card className="p-4 sm:p-5">
        <RegularOrderForm customers={customers} />
      </Card>
    </div>
  );
}
