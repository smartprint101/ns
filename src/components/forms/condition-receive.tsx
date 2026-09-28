"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Card, CardTitle, Spinner, Badge, Empty } from "@/components/ui";
import { AccountChips } from "./account-chips";
import { ConfirmSheet } from "@/components/sheet";
import { AgeChip } from "@/components/age-chip";
import { findConditionMatchesAction, receiveConditionAction } from "@/app/actions/orders";
import { bnMoney, bn } from "@/lib/bn";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };
type PendingOrder = {
  orderId: string;
  orderNo: number;
  customerName: string;
  totalAmount: number;
  diff?: number;
  createdAt: Date | string;
};

export function ConditionReceive({ accounts, pendingList }: { accounts: AccountRow[]; pendingList: PendingOrder[] }) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [matches, setMatches] = React.useState<PendingOrder[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [accountId, setAccountId] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const amountNum = Number(amount) || 0;
  const selected =
    matches?.find((m) => m.orderId === selectedId) ?? pendingList.find((p) => p.orderId === selectedId) ?? null;

  async function search() {
    if (amountNum <= 0) {
      toast.error("আগে টাকার পরিমাণ লিখুন");
      return;
    }
    setSearching(true);
    try {
      const rows = await findConditionMatchesAction(amountNum);
      setMatches(rows);
      setSelectedId(rows[0]?.orderId ?? null);
      if (rows.length === 0) toast.info("কাছাকাছি কোনো কন্ডিশন পাওয়া যায়নি — নিচের পুরো লিস্ট দেখুন");
    } finally {
      setSearching(false);
    }
  }

  async function confirmReceive() {
    if (!selected) return;
    setPending(true);
    const r = await receiveConditionAction({
      orderId: selected.orderId,
      receivedAmount: amountNum > 0 ? amountNum : selected.totalAmount,
      accountId,
    });
    setPending(false);
    if (r.ok) {
      toast.success(`অর্ডার #${selected.orderNo}-এর কন্ডিশন রিসিভ হয়েছে — অর্ডার সম্পন্ন`);
      setConfirmOpen(false);
      setAmount("");
      setMatches(null);
      setSelectedId(null);
      setAccountId("");
      router.refresh();
    } else {
      toast.error(r.error ?? "সমস্যা হয়েছে");
    }
  }

  const MatchRow = ({ m, showDiff }: { m: PendingOrder; showDiff: boolean }) => (
    <button
      key={m.orderId}
      type="button"
      onClick={() => setSelectedId(m.orderId)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition",
        selectedId === m.orderId ? "border-brand-700 bg-brand-50 ring-1 ring-brand-300" : "border-slate-200 bg-white hover:border-brand-300"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">
          অর্ডার #{bn(m.orderNo)} · {m.customerName}
        </p>
        <p className="text-xs text-slate-500">
          বিল {bnMoney(m.totalAmount)}
          {showDiff && m.diff != null && m.diff > 0 && <span className="ml-1.5 font-bold text-amber-600">Δ {bnMoney(m.diff)}</span>}
        </p>
      </div>
      <AgeChip from={new Date(m.createdAt)} />
    </button>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>কন্ডিশন রিসিভ করুন</CardTitle>
        <div className="space-y-3">
          <Field label="কত টাকা এলো?" required hint="টাকা লিখে খুঁজুন — কাছাকাছি বিলের কন্ডিশন দেখাবে">
            <div className="flex gap-2">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="যেমন 8000"
                inputMode="decimal"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
              />
              <Button onClick={search} disabled={searching || amountNum <= 0} className="shrink-0">
                {searching ? <Spinner /> : "খুঁজুন"}
              </Button>
            </div>
          </Field>

          {matches !== null && matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-700">এই Amount-এর কাছাকাছি কন্ডিশন ({bn(matches.length)}টি):</p>
              {matches.map((m) => (
                <MatchRow key={m.orderId} m={m} showDiff />
              ))}
            </div>
          )}

          {selectedId && (
            <Field label="টাকা কোথায় জমা হলো" required>
              <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />
            </Field>
          )}

          {selectedId && (
            <Button full size="lg" disabled={!accountId || pending} onClick={() => setConfirmOpen(true)}>
              {selected
                ? `অর্ডার #${bn(selected.orderNo)}-এর সঙ্গে মিলিয়ে রিসিভ করুন`
                : "রিসিভ করুন"}
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle right={<Badge tone="amber">{bn(pendingList.length)}টি বাকি</Badge>}>পেন্ডিং কন্ডিশন (পুরোনো আগে)</CardTitle>
        {pendingList.length === 0 ? (
          <Empty text="কোনো কন্ডিশন পেন্ডিং নেই" />
        ) : (
          <ul className="space-y-2">
            {pendingList.map((m) => (
              <li key={m.orderId} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <MatchRow m={m} showDiff={false} />
                </div>
                <Button
                  size="sm"
                  variant="subtle"
                  className="shrink-0"
                  onClick={() => {
                    setAmount(String(m.totalAmount));
                    setMatches(null);
                    setSelectedId(m.orderId);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  রিসিভ
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmReceive}
        pending={pending}
        title="কন্ডিশন রিসিভ নিশ্চিত করুন"
        confirmLabel="রিসিভ করুন"
        message={
          selected ? (
            <span>
              অর্ডার <b>#{bn(selected.orderNo)}</b> ({selected.customerName}) — বিল {bnMoney(selected.totalAmount)} · রিসিভ হবে{" "}
              <b>{bnMoney(amountNum > 0 ? amountNum : selected.totalAmount)}</b>। অর্ডার সম্পন্ন হবে এবং টাকা অ্যাকাউন্টে যোগ হবে।
            </span>
          ) : (
            ""
          )
        }
      />
    </div>
  );
}
