"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, Spinner } from "@/components/ui";
import { EntityPicker, type PickerValue } from "./entity-picker";
import { AccountChips } from "./account-chips";
import { useSubmit } from "./use-submit";
import { createRegularOrderAction } from "@/app/actions/orders";
import { bnMoney } from "@/lib/bn";
import { toast } from "sonner";

type CustomerRow = { id: string; name: string; phone: string | null; address: string | null };
type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };

export function RegularOrderForm({ customers, accounts }: { customers: CustomerRow[]; accounts: AccountRow[] }) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [customer, setCustomer] = React.useState<PickerValue>({ id: null, name: "" });
  const [phone, setPhone] = React.useState("");
  const [customerAddress, setCustomerAddress] = React.useState("");
  const [totalAmount, setTotalAmount] = React.useState("");
  const [paidAmount, setPaidAmount] = React.useState("");
  const [paidAccountId, setPaidAccountId] = React.useState("");
  const [addToCollections, setAddToCollections] = React.useState(false);
  const [hasCondition, setHasCondition] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  const total = Number(totalAmount) || 0;
  const paid = Number(paidAmount) || 0;
  const due = Math.round((total - paid) * 100) / 100;

  const reset = () => {
    setCustomer({ id: null, name: "" });
    setPhone("");
    setCustomerAddress("");
    setTotalAmount("");
    setPaidAmount("");
    setPaidAccountId("");
    setAddToCollections(false);
    setHasCondition(false);
    setNotes("");
  };

  const canSave =
    !pending &&
    (customer.id || customer.name.trim().length >= 2) &&
    total > 0 &&
    paid <= total &&
    (paid <= 0 || !!paidAccountId);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            createRegularOrderAction({
              customerId: customer.id ?? "",
              customerName: customer.id ? "" : customer.name,
              phone,
              customerAddress,
              totalAmount: total,
              paidAmount: paid,
              paidAccountId,
              addToCollections,
              hasCondition,
              address: customerAddress,
              notes,
            }),
          {
            success: "অর্ডার তৈরি হয়েছে",
            onOk: (r) => {
              const no = (r as unknown as { data?: { orderNo?: number } }).data?.orderNo;
              toast.success(`অর্ডার #${no} খাতায় লেখা হয়েছে — টাস্কে «স্লিপ করো» যোগ হলো`);
              reset();
              router.refresh();
            },
          }
        );
      }}
    >
      <Field label="কাস্টমার" required hint="লিস্ট থেকে বেছে নিন, অথবা নতুন নাম লিখুন">
        <EntityPicker
          options={customers.map((c) => ({ id: c.id, name: c.name, sub: c.phone ?? undefined }))}
          value={customer}
          onChange={(v) => {
            setCustomer(v);
            const row = customers.find((c) => c.id === v.id);
            if (row) {
              setPhone(row.phone ?? "");
              setCustomerAddress(row.address ?? "");
            }
          }}
          placeholder="কাস্টমারের নাম…"
          autoFocus
        />
      </Field>

      {!customer.id && customer.name.trim().length >= 2 && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="ফোন নম্বর">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" />
          </Field>
          <Field label="ঠিকানা">
            <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="এলাকা, শহর" />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="মোট টাকা (৳)" required>
          <Input value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
        <Field label="পেমেন্ট কত দিয়েছে (৳)">
          <Input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
          <span className="text-sm font-semibold text-slate-600">বকেয়া</span>
          <span className={`font-extrabold ${due > 0 ? "text-red-600" : "text-emerald-700"}`}>{bnMoney(Math.max(due, 0))}</span>
        </div>
      )}

      {paid > 0 && (
        <>
          <Field label="পেমেন্টের টাকা কোথায় জমা হলো" required>
            <AccountChips accounts={accounts} value={paidAccountId} onChange={setPaidAccountId} />
          </Field>
          <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={addToCollections}
              onChange={(e) => setAddToCollections(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 accent-brand-700"
            />
            কালেকশনে এড হবে
          </label>
        </>
      )}

      <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={hasCondition}
          onChange={(e) => setHasCondition(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 accent-brand-700"
        />
        কন্ডিশন আছে (কুরিয়ার থেকে টাকা আসবে)
      </label>

      <Field label="বিবরণ" hint="পণ্য বা অন্যান্য তথ্য — যা দরকার লিখে রাখুন (ঐচ্ছিক)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="যেমন: ডাল ৫০ কেজি, কুরিয়ারে পাঠাতে হবে…" />
      </Field>

      <Button type="submit" full size="lg" disabled={!canSave}>
        {pending ? <Spinner /> : null} অর্ডার সেভ করুন
      </Button>
      <p className="text-center text-xs text-slate-400">সেভ হলেই টাস্কে «নতুন অর্ডারের স্লিপ করো» যোগ হবে</p>
    </form>
  );
}
