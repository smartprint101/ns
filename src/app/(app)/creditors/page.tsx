import { listCreditors, creditorSummary } from "@/server/services/creditors";
import { PageHead, SearchBox } from "@/components/page-head";
import { Badge, Card, CardTitle, Empty } from "@/components/ui";
import { CreditorForm, SettleCreditorButton } from "@/components/forms/creditor-form";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function CreditorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const [rows, summary] = await Promise.all([listCreditors({ q: sp.q }), creditorSummary()]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHead title="পাওনাদার" sub="আমাদের থেকে কারা কত টাকা পাবে — এখানে যোগ করে দেখে রাখুন" />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-amber-200 bg-amber-50/70">
          <p className="text-xs font-bold text-amber-700">মোট পাওনা</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-950">{bnMoney(summary.sum)}</p>
          <p className="mt-1 text-xs font-semibold text-amber-700">{bn(summary.count)} জন/এন্ট্রি পাওনাদার</p>
        </Card>
        <Card className="border-slate-200 bg-white">
          <p className="text-xs font-bold text-slate-400">নিয়ম</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">
            শুধু পাওনা হিসাব রাখবে; টাকা দিলে খরচ/ক্যাশ হিসাব আলাদা করে এন্ট্রি করুন।
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>নতুন পাওনাদার যোগ</CardTitle>
        <CreditorForm />
      </Card>

      <Card>
        <CardTitle right={<Badge tone="amber">{bn(rows.length)}টি</Badge>}>পাওনাদার তালিকা</CardTitle>
        <SearchBox placeholder="নাম / ফোন / বিবরণ দিয়ে খুঁজুন…" defaultValue={sp.q} />
        {rows.length === 0 ? (
          <Empty text={sp.q ? "মিল পাওয়া যায়নি" : "এখনও কোনো পাওনাদার নেই"} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map(({ creditor: c, createdByName }) => (
              <li key={c.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-extrabold text-slate-900">{c.name}</p>
                      {c.phone && <Badge tone="slate">{c.phone}</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {createdByName} · {fmtDateShort(c.createdAt)}
                    </p>
                    {c.notes && <p className="mt-1.5 text-xs text-slate-500">📝 {c.notes}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-extrabold text-amber-700">{bnMoney(c.amount)}</p>
                    <div className="mt-1.5">
                      <SettleCreditorButton id={c.id} name={c.name} amount={c.amount} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
