"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, Spinner } from "@/components/ui";
import { EntityPicker, type PickerValue } from "./entity-picker";
import { AccountChips } from "./account-chips";
import { useSubmit } from "./use-submit";
import { createPackagingOrderAction } from "@/app/actions/orders";
import { bnMoney } from "@/lib/bn";
import { WORK_TYPE_BN } from "@/lib/labels";
import { toast } from "sonner";

type PartyRow = { id: string; name: string; phone: string | null };
type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };

export function PackagingOrderForm({ parties, accounts }: { parties: PartyRow[]; accounts: AccountRow[] }) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [party, setParty] = React.useState<PickerValue>({ id: null, name: "" });
  const [workType, setWorkType] = React.useState<"CYLINDER_PACKET" | "PACKET" | "ART_PAPER">("PACKET");
  const [totalKg, setTotalKg] = React.useState("");
  const [totalBill, setTotalBill] = React.useState("");
  const [advanceAmount, setAdvanceAmount] = React.useState("");
  const [advanceAccountId, setAdvanceAccountId] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const kg = Number(totalKg) || 0;
  const bill = Number(totalBill) || 0;
  const advance = Number(advanceAmount) || 0;
  const due = Math.round((bill - advance) * 100) / 100;

  const canSave =
    !pending &&
    (party.id || party.name.trim().length >= 2) &&
    kg > 0 &&
    bill > 0 &&
    advance <= bill &&
    (advance <= 0 || !!advanceAccountId);

  const reset = () => {
    setParty({ id: null, name: "" });
    setWorkType("PACKET");
    setTotalKg("");
    setTotalBill("");
    setAdvanceAmount("");
    setAdvanceAccountId("");
    setNotes("");
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            createPackagingOrderAction({
              partyId: party.id ?? "",
              partyName: party.id ? "" : party.name,
              workType,
              totalKg: kg,
              totalBill: bill,
              advanceAmount: advance,
              advanceAccountId,
              addToCollections: advance > 0,
              notes,
            }),
          {
            onOk: (r) => {
              const no = (r as unknown as { data?: { orderNo?: number } }).data?.orderNo;
              toast.success(`প্যাকেজিং অর্ডার PKG-${no} এন্ট্রি হয়েছে`);
              reset();
              router.refresh();
            },
          }
        );
      }}
    >
      <Field label="পার্টি" required hint="লিস্ট থেকে বেছে নিন, অথবা নতুন নাম লিখুন">
        <EntityPicker
          options={parties.map((p) => ({ id: p.id, name: p.name, sub: p.phone ?? undefined }))}
          value={party}
          onChange={(v) => setParty(v)}
          placeholder="পার্টির নাম…"
          autoFocus
        />
      </Field>

      <Field label="কাজের ধরন" required>
        <div className="grid grid-cols-3 gap-2">
          {(["CYLINDER_PACKET", "PACKET", "ART_PAPER"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setWorkType(t)}
              className={`rounded-xl px-2 py-2.5 text-[13px] font-bold ring-1 ring-inset transition ${
                workType === t ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {WORK_TYPE_BN[t]}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="কেজি" required>
          <Input value={totalKg} onChange={(e) => setTotalKg(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
        <Field label="টোটাল বিল (৳)" required>
          <Input value={totalBill} onChange={(e) => setTotalBill(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
      </div>

      <Field label="অ্যাডভান্স কত (৳)" hint="পরে এক্সট্রা টাকা যোগ করা যাবে">
        <Input value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="০" inputMode="decimal" />
      </Field>

      {bill > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
          <span className="text-sm font-semibold text-slate-600">বকেয়া থাকবে</span>
          <span className={`font-extrabold ${due > 0 ? "text-red-600" : "text-emerald-700"}`}>{bnMoney(Math.max(due, 0))}</span>
        </div>
      )}

      {advance > 0 && (
        <>
          <Field label="অ্যাডভান্সের টাকা কোথায় এসেছে" required>
            <AccountChips accounts={accounts} value={advanceAccountId} onChange={setAdvanceAccountId} />
          </Field>
        </>
      )}

      <Field label="বিবরণ" hint="ডিজাইন/সাইজ বা অন্যান্য তথ্য (ঐচ্ছিক)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="যেমন: ২০০ গ্রাম প্যাকেট, নতুন ডিজাইন…" />
      </Field>

      <Button type="submit" full size="lg" disabled={!canSave}>
        {pending ? <Spinner /> : null} অর্ডার সেভ করুন
      </Button>
      <p className="text-center text-xs text-slate-400">কারখানার নাম পরে — «কারখানায় পাঠানো হয়েছে» ধাপে বাছাই করবেন</p>
    </form>
  );
}
