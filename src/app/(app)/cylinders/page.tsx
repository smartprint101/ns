import { listCylinders, listFactories } from "@/server/services/masters";
import { PageHead } from "@/components/page-head";
import { CylindersClient } from "@/components/forms/masters-client";
import { bn } from "@/lib/bn";

export const dynamic = "force-dynamic";

export default async function CylindersPage() {
  const [rows, factories] = await Promise.all([listCylinders(), listFactories()]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="সিলিন্ডার" sub={`${bn(rows.length)}টি সিলিন্ডার — কোনটা কোন ফ্যাক্টরিতে আছে`} />
      <CylindersClient
        rows={rows.map((c) => ({ id: c.id, name: c.name, factoryId: c.factoryId, factoryName: c.factory.name, notes: c.notes }))}
        factories={factories.map((f) => ({ id: f.id, name: f.name }))}
      />
    </div>
  );
}
