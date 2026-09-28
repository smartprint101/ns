import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";
import { CollectionForm } from "@/components/forms/collection-forms";

export const dynamic = "force-dynamic";

export default function NewCollectionPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন কুরিয়ার কালেকশন" sub="কুরিয়ার থেকে কত টাকা আনার কথা আছে লিখে রাখুন" />
      <Card className="p-4 sm:p-5">
        <CollectionForm />
      </Card>
    </div>
  );
}
