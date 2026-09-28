"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, Spinner, Badge } from "@/components/ui";
import { EntityPicker, type PickerValue } from "./entity-picker";
import { AccountChips } from "./account-chips";
import { Sheet } from "@/components/sheet";
import { createPaymentAction, getOrdersForPayerAction, afterPaymentSaved } from "@/app/actions/money";
import { bnMoney, bn } from "@/lib/bn";
import { PACKAGING_STAGE_BN } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Opt = { id: string; name: string; phone: string | null };
type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };
type DueOrder = { id: string; orderNo: number; stage: string; totalBill: number; paid: number; due: number; createdAt: Date | string };
type Warning = { message: string; matches: { id: string; amount: number; description: string; date: Date | string }[] };

export function PaymentForm({
  parties,
  customers,
  accounts,
  initialPartyId,
  initialCustomerId,
}: {
  parties: Opt[];
  customers: Opt[];
  accounts: AccountRow[];
  initialPartyId?: string;
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [payerKind, setPayerKind] = React.useState<"party" | "customer">(initialCustomerId ? "customer" : "party");
  const [payer, setPayer] = React.useState<PickerValue>(() => {
    const init = initialPartyId
      ? parties.find((p) => p.id === initialPartyId)
      : initialCustomerId
        ? customers.find((c) => c.id === initialCustomerId)
        : null;
    return init ? { id: init.id, name: init.name } : { id: null, name: "" };
  });
  const [orders, setOrders] = React.useState<DueOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Record<string, { checked: boolean; amount: string }>>({});
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isAdvance, setIsAdvance] = React.useState(false);
  const inCollections = true;
  const [pending, setPending] = React.useState(false);
  const [warning, setWarning] = React.useState<Warning | null>(null);
  const initialLoaded = React.useRef(false);

  const payerOptions = (payerKind === "party" ? parties : customers).map((o) => ({ id: o.id, name: o.name, sub: o.phone ?? undefined }));

  // Load active orders for selected payer
  React.useEffect(() => {
    if (!payer.id) {
      setOrders([]);
      return;
    }
    let live = true;
    setOrdersLoading(true);
    getOrdersForPayerAction(payerKind, payer.id)
      .then((rows) => {
        if (!live) return;
        setOrders(rows);
        const preselect: Record<string, { checked: boolean; amount: string }> = {};
        for (const o of rows) {
          if (initialLoaded.current && initialPartyId) {
            preselect[o.id] = { checked: o.due > 0, amount: String(o.due > 0 ? o.due : 0) };
          } else {
            preselect[o.id] = { checked: false, amount: String(o.due > 0 ? o.due : 0) };
          }
        }
        setSelected(preselect);
      })
      .finally(() => live && setOrdersLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payer.id, payerKind]);

  // Preselect when coming from an order page ("এই অর্ডারে কালেকশন")
  React.useEffect(() => {
    if (initialPartyId && orders.length > 0 && !initialLoaded.current) {
      initialLoaded.current = true;
      const dueSum = orders.filter((o) => o.due > 0).reduce((s, o) => s + o.due, 0);
      if (dueSum > 0) setAmount(String(Math.round(dueSum * 100) / 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const selectedList = orders.filter((o) => selected[o.id]?.checked);
  const allocSum = Math.round(selectedList.reduce((s, o) => s + (Number(selected[o.id]?.amount) || 0), 0) * 100) / 100;
  const amountNum = Number(amount) || 0;
  const unallocated = Math.round((amountNum - allocSum) * 100) / 100;
  const overAllocated = allocSum > amountNum + 0.009 && amountNum > 0;

  async function doSave(confirmed: boolean) {
    const allocations = selectedList
      .map((o) => ({
        amount: Number(selected[o.id]?.amount) || 0,
        ...(payerKind === "party" ? { packagingOrderId: o.id } : { regularOrderId: o.id }),
      }))
      .filter((a) => a.amount > 0);
    const r = await createPaymentAction(
      {
        amount: amountNum,
        accountId,
        partyId: payerKind === "party" ? payer.id! : "",
        customerId: payerKind === "customer" ? payer.id! : "",
        notes,
        isAdvance: payerKind === "party" && isAdvance,
        inCollections,
        allocations,
      },
      confirmed
    );
    if ("warning" in r && r.warning) {
      setWarning(r.warning as Warning);
      return false;
    }
    if (r.ok && "paymentId" in r) {
      toast.success(`কালেকশন TXN-${r.txnNo} সেভ হয়েছে`);
      await afterPaymentSaved();
      setPayer({ id: null, name: "" });
      setOrders([]);
      setSelected({});
      setAmount("");
      setAccountId("");
      setNotes("");
      setIsAdvance(false);
      router.refresh();
      return true;
    }
    toast.error("error" in r && r.error ? r.error : "সমস্যা হয়েছে — আবার চেষ্টা করুন");
    return false;
  }

  const canSave = !pending && payer.id && amountNum > 0 && accountId && !overAllocated;

  return (
    <div className="space-y-4">
      {/* Party → Order → Amount → Account → Save */}
      <Field label="কার কাছ থেকে টাকা" required>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {(
            [
              ["party", "প্যাকেজিং পার্টি"],
              ["customer", "রেগুলার কাস্টমার"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setPayerKind(k);
                setPayer({ id: null, name: "" });
              }}
              className={cn(
                "min-h-[44px] rounded-xl border px-3 text-sm font-bold transition",
                payerKind === k ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <EntityPicker
          options={payerOptions}
          value={payer}
          onChange={(v) => setPayer(v)}
          placeholder={payerKind === "party" ? "পার্টির নাম…" : "কাস্টমারের নাম…"}
          allowNew={false}
        />
        {!payer.id && <p className="mt-1 text-xs text-slate-500">নতুন পার্টি/কাস্টমার হলে আগে অর্ডারের মাধ্যমে তৈরি করুন</p>}
      </Field>

      {/* Active orders with due */}
      {payer.id && (
        <div className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 px-3 py-2.5 text-sm font-bold text-slate-700">
            চলমান অর্ডার {ordersLoading ? "…" : `(${bn(orders.length)})`}
            <span className="ml-1 text-xs font-medium text-slate-400">— যেগুলোতে কালেকশন বসাতে চান সিলেক্ট করুন</span>
          </div>
          {ordersLoading ? (
            <p className="px-3 py-4 text-sm text-slate-400">লোড হচ্ছে…</p>
          ) : orders.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-400">কোনো চলমান অর্ডার নেই — সাধারণ কালেকশন হিসেবে সেভ হবে</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {orders.map((o) => {
                const sel = selected[o.id] ?? { checked: false, amount: "0" };
                return (
                  <li key={o.id} className={cn("flex items-center gap-2.5 border-b border-slate-50 px-3 py-2.5", sel.checked && "bg-brand-50/50")}>
                    <input
                      type="checkbox"
                      checked={sel.checked}
                      onChange={(e) => setSelected((s) => ({ ...s, [o.id]: { ...sel, checked: e.target.checked } }))}
                      className="h-5 w-5 rounded border-slate-300 accent-brand-700"
                      aria-label="অর্ডার সিলেক্ট"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        {payerKind === "party" ? "PKG-" : "#"}
                        {bn(o.orderNo)}
                        <span className="ml-1.5 text-xs font-medium text-slate-400">{PACKAGING_STAGE_BN[o.stage] ?? o.stage}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        বিল {bnMoney(o.totalBill)} · জমা {bnMoney(o.paid)} ·{" "}
                        <span className={cn("font-bold", o.due > 0 ? "text-red-600" : "text-emerald-600")}>বাকি {bnMoney(o.due)}</span>
                      </p>
                    </div>
                    {sel.checked && (
                      <div className="w-28">
                        <Input
                          value={sel.amount}
                          inputMode="decimal"
                          onChange={(e) => setSelected((s) => ({ ...s, [o.id]: { ...sel, amount: e.target.value } }))}
                          className="h-10 text-right"
                          aria-label="বণ্টনের পরিমাণ"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {selectedList.length > 0 && (
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-600">বণ্টন মোট</span>
              <span className={cn("font-extrabold", overAllocated ? "text-red-600" : "text-slate-900")}>{bnMoney(allocSum)}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="মোট কালেকশন (৳)" required>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="যেমন 50000" inputMode="decimal" />
        </Field>
        <div className="flex items-end pb-1">
          {amountNum > 0 && selectedList.length > 0 && !overAllocated && (
            <p className="text-xs text-slate-500">
              {unallocated > 0 ? (
                <>
                  <span className="font-bold text-amber-600">{bnMoney(unallocated)}</span> অবণ্টিত থাকবে (পার্টির বাকি থেকে কমবে)
                </>
              ) : (
                <span className="font-semibold text-emerald-600">✓ পুরোটা বণ্টন হয়ে গেছে</span>
              )}
            </p>
          )}
          {overAllocated && <p className="text-xs font-bold text-red-600">বণ্টন ({bnMoney(allocSum)}) কালেকশনের ({bnMoney(amountNum)}) চেয়ে বেশি</p>}
        </div>
      </div>

      {payerKind === "party" && (
        <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isAdvance}
            onChange={(e) => setIsAdvance(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 accent-brand-700"
          />
          এটি অ্যাডভান্স কালেকশন
        </label>
      )}

      <Field label="টাকা কোথায় এসেছে" required>
        <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />
      </Field>

      <Field label="বিবরণ">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ঐচ্ছিক…" />
      </Field>

      <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-white via-white to-transparent px-1 pb-1 pt-6">
        <Button
          full
          size="lg"
          disabled={!canSave}
          onClick={async () => {
            setPending(true);
            await doSave(false);
            setPending(false);
          }}
        >
          {pending ? <Spinner /> : null} {pending ? "সেভ হচ্ছে…" : `কালেকশন সেভ করুন${amountNum > 0 ? ` (${bnMoney(amountNum)})` : ""}`}
        </Button>
      </div>

      {/* Duplicate warning */}
      <Sheet open={!!warning} onClose={() => setWarning(null)} title="⚠️ মিল পাওয়া গেছে">
        <p className="text-sm text-slate-600">{warning?.message}</p>
        {warning && warning.matches.length > 0 && (
          <ul className="mt-3 space-y-2">
            {warning.matches.map((m) => (
              <li key={m.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm ring-1 ring-inset ring-amber-200">
                <span className="font-bold">{bnMoney(m.amount)}</span> — {m.description}{" "}
                <span className="text-xs text-slate-500">
                  ({new Date(m.date).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })})
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setWarning(null)}>
            বাতিল
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const ok = await doSave(true);
              if (ok) setWarning(null);
              setPending(false);
            }}
          >
            {pending ? <Spinner /> : null} তারপরও সেভ করুন
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
