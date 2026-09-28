import Link from "next/link";
import { listCustomerDues } from "@/server/services/regular-orders";
import { PageHead } from "@/components/page-head";
import { Badge, Card, Empty, LinkButton } from "@/components/ui";
import { AgeChip } from "@/components/age-chip";
import { DuesDemoteButton } from "@/components/forms/dues-actions";
import { bnMoney, bn } from "@/lib/bn";
import { fmtDateShort } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DuesPage() {
  const list = await listCustomerDues();
  const totalDue = list.reduce((s, c) => s + c.totalDue, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead
        title="কাস্টমারের বকেয়া"
        sub="যার বকেয়া যত পুরোনো সে তত উপরে"
        right={
          totalDue > 0 ? (
            <span className="rounded-xl bg-red-50 px-3 py-1.5 text-sm font-extrabold text-red-700 ring-1 ring-inset ring-red-200">
              মোট {bnMoney(totalDue)}
            </span>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <Empty text="কারো কাছে কোনো বকেয়া নেই 🎉" />
      ) : (
        <ul className="space-y-2.5">
          {list.map(({ customer, orders, totalDue, oldest }) => (
            <li key={customer.id}>
              <Card className={`p-3.5 ${customer.duesDemotedAt ? "opacity-75" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">{customer.name}</p>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {customer.phone ? (
                        <a href={`tel:${customer.phone}`} className="font-semibold text-brand-700">
                          📞 {customer.phone}
                        </a>
                      ) : (
                        "ফোন নম্বর নেই"
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-base font-extrabold text-red-600">{bnMoney(totalDue)}</p>
                    <AgeChip from={oldest} prefix="বকেয়া" />
                  </div>
                </div>

                <ul className="mt-2.5 divide-y divide-slate-100 border-t border-slate-100">
                  {orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link href={`/orders/${o.id}`} className="text-[13px] font-bold text-slate-800 hover:text-brand-700">
                          অর্ডার #{bn(o.orderNo)}
                        </Link>
                        <Badge tone={o.stage === "CONDITION_PENDING" ? "red" : "amber"} className="ml-1.5">
                          {o.stage === "CONDITION_PENDING" ? "কুরিয়ার কন্ডিশন বকেয়া" : "বকেয়া"}
                        </Badge>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          মোট {bnMoney(o.totalAmount)} · জমা {bnMoney(o.paid)} · {fmtDateShort(o.courierGivenAt ?? o.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm font-extrabold text-red-600">{bnMoney(Math.max(o.due, 0))}</p>
                    </li>
                  ))}
                </ul>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                  {orders.some((o) => o.stage === "CONDITION_PENDING") && (
                    <LinkButton href="/conditions" size="sm" variant="primary">
                      ৳ কন্ডিশন রিসিভ
                    </LinkButton>
                  )}
                  <LinkButton href={`/payments/new?customer=${customer.id}`} size="sm" variant="subtle">
                    ৳ টাকা পেয়েছি
                  </LinkButton>
                  <div className="ml-auto">
                    <DuesDemoteButton customerId={customer.id} customerName={customer.name} demoted={!!customer.duesDemotedAt} />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">{bn(list.length)} জন কাস্টমারের বকেয়া</p>
    </div>
  );
}
