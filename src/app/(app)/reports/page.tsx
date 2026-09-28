import { getReport } from "@/server/services/reports";
import { PageHead } from "@/components/page-head";
import { Badge, Card, CardTitle, Empty } from "@/components/ui";
import { EXPENSE_CATEGORY_BN, STATUS_BN } from "@/lib/labels";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDate, startOfMonth, toDateInputValue } from "@/lib/dates";
import { m2 } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const from = sp.from ? new Date(sp.from + "T00:00:00") : startOfMonth();
  const to = sp.to ? new Date(sp.to + "T23:59:59") : new Date();
  const r = await getReport(from, to);

  return (
    <div className="space-y-4">
      <PageHead title="রিপোর্ট" sub={`${fmtDate(from)} — ${fmtDate(to)}`} />

      <form action="/reports" method="get" className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">শুরু</label>
          <input type="date" name="from" defaultValue={toDateInputValue(from)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500">শেষ</label>
          <input type="date" name="to" defaultValue={toDateInputValue(to)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm" />
        </div>
        <button type="submit" className="h-11 rounded-xl bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800">
          দেখুন
        </button>
      </form>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SumCard label="মোট কালেকশন" value={bnMoney(r.totals.collection)} tone="text-emerald-700" />
        <SumCard label="মোট খরচ" value={bnMoney(r.totals.expense)} tone="text-red-600" />
        <SumCard label="পার্টির কাছে মোট পাওনা" value={bnMoney(m2(r.partyDues.reduce((s, p) => s + Math.max(p.due, 0), 0)))} tone="text-amber-600" />
        <SumCard
          label="কালেকশন − খরচ"
          value={bnMoney(m2(r.totals.collection - r.totals.expense))}
          tone={r.totals.collection - r.totals.expense >= 0 ? "text-emerald-700" : "text-red-600"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daily */}
        <Card>
          <CardTitle>দৈনিক কালেকশন ও খরচ</CardTitle>
          {r.daily.length === 0 ? (
            <Empty text="এই সময়ে কিছু নেই" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="py-1.5 font-semibold">তারিখ</th>
                    <th className="py-1.5 text-right font-semibold">কালেকশন</th>
                    <th className="py-1.5 text-right font-semibold">খরচ</th>
                  </tr>
                </thead>
                <tbody>
                  {r.daily.map((d) => (
                    <tr key={d.key} className="border-b border-slate-50">
                      <td className="py-2 font-semibold text-slate-700">{d.label}</td>
                      <td className="py-2 text-right font-bold text-emerald-700">{d.collection ? bnMoney(d.collection) : "—"}</td>
                      <td className="py-2 text-right font-bold text-red-600">{d.expense ? bnMoney(d.expense) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Monthly + category */}
        <div className="space-y-4">
          <Card>
            <CardTitle>মাসিক সারসংক্ষেপ</CardTitle>
            {r.monthly.length === 0 ? (
              <Empty text="কিছু নেই" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="py-1.5 font-semibold">মাস</th>
                    <th className="py-1.5 text-right font-semibold">কালেকশন</th>
                    <th className="py-1.5 text-right font-semibold">খরচ</th>
                  </tr>
                </thead>
                <tbody>
                  {r.monthly.map((m) => (
                    <tr key={m.key} className="border-b border-slate-50">
                      <td className="py-2 font-semibold text-slate-700">{m.label}</td>
                      <td className="py-2 text-right font-bold text-emerald-700">{bnMoney(m.collection)}</td>
                      <td className="py-2 text-right font-bold text-red-600">{bnMoney(m.expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card>
            <CardTitle>ক্যাটাগরি অনুযায়ী খরচ</CardTitle>
            {r.byCategory.length === 0 ? (
              <Empty text="কিছু নেই" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {r.byCategory.map((c) => (
                  <li key={c.category} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-semibold text-slate-700">{EXPENSE_CATEGORY_BN[c.category] ?? c.category}</span>
                    <span className="font-bold text-red-600">{bnMoney(c.sum)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Party dues */}
      <Card>
        <CardTitle>পার্টির বাকি (Party Due)</CardTitle>
        {r.partyDues.length === 0 ? (
          <Empty text="কোনো পার্টি নেই" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-1.5 font-semibold">পার্টি</th>
                  <th className="py-1.5 text-right font-semibold">মোট বিল</th>
                  <th className="py-1.5 text-right font-semibold">জমা</th>
                  <th className="py-1.5 text-right font-semibold">বাকি</th>
                </tr>
              </thead>
              <tbody>
                {r.partyDues.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="py-2 font-semibold text-slate-700">{p.name}</td>
                    <td className="py-2 text-right text-slate-700">{bnMoney(p.bill)}</td>
                    <td className="py-2 text-right text-emerald-700">{bnMoney(p.paid)}</td>
                    <td className={`py-2 text-right font-bold ${p.due > 0 ? "text-red-600" : "text-emerald-700"}`}>{bnMoney(p.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Factory ledger */}
        <Card>
          <CardTitle>ফ্যাক্টরি লেজার (Supplier/Factory)</CardTitle>
          {r.factories.length === 0 ? (
            <Empty text="কোনো ফ্যাক্টরি নেই" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-1.5 font-semibold">ফ্যাক্টরি</th>
                  <th className="py-1.5 text-right font-semibold">আগের বাকি</th>
                  <th className="py-1.5 text-right font-semibold">কালেকশন</th>
                  <th className="py-1.5 text-right font-semibold">বাকি</th>
                </tr>
              </thead>
              <tbody>
                {r.factories.map((f) => (
                  <tr key={f.id} className="border-b border-slate-50">
                    <td className="py-2 font-semibold text-slate-700">
                      {f.name} {f.workCount > 0 && <Badge tone="blue" className="ml-1">{bn(f.workCount)} কাজ</Badge>}
                    </td>
                    <td className="py-2 text-right text-slate-700">{bnMoney(f.openingDue)}</td>
                    <td className="py-2 text-right text-emerald-700">{bnMoney(f.paid)}</td>
                    <td className={`py-2 text-right font-bold ${f.due > 0 ? "text-red-600" : "text-emerald-700"}`}>{bnMoney(f.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Orders + tasks */}
        <div className="space-y-4">
          <Card>
            <CardTitle>অর্ডারের অবস্থা</CardTitle>
            <div className="grid grid-cols-2 gap-2">
              <OrderBox title="রেগুলার" counts={r.orderCounts.regular} />
              <OrderBox title="প্যাকেজিং" counts={r.orderCounts.packaging} />
            </div>
          </Card>
          <Card>
            <CardTitle>স্টাফ টাস্ক</CardTitle>
            {r.tasks.length === 0 ? (
              <Empty text="কিছু নেই" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="py-1.5 font-semibold">নাম</th>
                    <th className="py-1.5 text-right font-semibold">বাকি</th>
                    <th className="py-1.5 text-right font-semibold">সম্পন্ন</th>
                    <th className="py-1.5 text-right font-semibold">বাতিল</th>
                  </tr>
                </thead>
                <tbody>
                  {r.tasks.map((t) => (
                    <tr key={t.userId} className="border-b border-slate-50">
                      <td className="py-2 font-semibold text-slate-700">{t.userName}</td>
                      <td className={`py-2 text-right font-bold ${t.pending > 0 ? "text-amber-600" : "text-slate-500"}`}>{bn(t.pending)}</td>
                      <td className="py-2 text-right font-bold text-emerald-700">{bn(t.completed)}</td>
                      <td className="py-2 text-right text-slate-500">{bn(t.cancelled)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {r.customerDues.length > 0 && (
            <Card>
              <CardTitle>রেগুলার কাস্টমারের বাকি</CardTitle>
              <ul className="divide-y divide-slate-100">
                {r.customerDues
                  .filter((c) => c.due !== 0)
                  .slice(0, 20)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-semibold text-slate-700">
                        {c.name} {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                      </span>
                      <span className={`font-bold ${c.due > 0 ? "text-red-600" : "text-emerald-700"}`}>{bnMoney(c.due)}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SumCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-lg font-extrabold ${tone}`}>{value}</p>
    </Card>
  );
}

function OrderBox({ title, counts }: { title: string; counts: { active: number; completed: number; cancelled: number } }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
      <p className="mb-2 text-sm font-bold text-slate-700">{title}</p>
      {(["ACTIVE", "COMPLETED", "CANCELLED"] as const).map((s) => (
        <p key={s} className="flex justify-between text-[13px] text-slate-600">
          <span>{STATUS_BN[s]}</span>
          <span className="font-bold">{bn(s === "ACTIVE" ? counts.active : s === "COMPLETED" ? counts.completed : counts.cancelled)}</span>
        </p>
      ))}
    </div>
  );
}
