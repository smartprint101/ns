"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, Spinner } from "@/components/ui";
import { EntityPicker, type PickerValue } from "./entity-picker";
import { AccountChips } from "./account-chips";
import { useSubmit } from "./use-submit";
import { createPackagingOrderAction } from "@/app/actions/orders";
import { bnMoney, bn } from "@/lib/bn";
import { WORK_TYPE_BN } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PartyRow = { id: string; name: string; phone: string | null };
type FactoryRow = { id: string; name: string };
type CylinderRow = { id: string; name: string; factoryId: string; factoryName: string };
type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };

export function PackagingOrderForm({
  parties,
  factories,
  cylinders,
  accounts,
}: {
  parties: PartyRow[];
  factories: FactoryRow[];
  cylinders: CylinderRow[];
  accounts: AccountRow[];
}) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [party, setParty] = React.useState<PickerValue>({ id: null, name: "" });
  const [workType, setWorkType] = React.useState<"CYLINDER_PACKET" | "PACKET" | "ART_PAPER">("PACKET");
  const [totalKg, setTotalKg] = React.useState("");
  const [extraKg, setExtraKg] = React.useState("");
  const [finalKg, setFinalKg] = React.useState("");
  const finalTouched = React.useRef(false);
  const [totalBill, setTotalBill] = React.useState("");
  const [factoryId, setFactoryId] = React.useState("");
  const [cylinderId, setCylinderId] = React.useState("");
  const [advanceAmount, setAdvanceAmount] = React.useState("");
  const [advanceAccountId, setAdvanceAccountId] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const total = Number(totalKg) || 0;
  const extra = Number(extraKg) || 0;
  React.useEffect(() => {
    if (!finalTouched.current) setFinalKg(total || extra ? String(total + extra) : "");
  }, [total, extra]);

  const cylOptions = cylinders.map((c) => ({ id: c.id, name: c.name, sub: c.factoryName }));
  const selectedCylinder = cylinders.find((c) => c.id === cylinderId);
  const advance = Number(advanceAmount) || 0;
  const bill = Number(totalBill) || 0;

  const canSave =
    !pending &&
    (party.id || party.name.trim().length >= 2) &&
    total > 0 &&
    bill > 0 &&
    factoryId &&
    (advance <= 0 || (advanceAccountId && advance <= bill));

  const reset = () => {
    setParty({ id: null, name: "" });
    setWorkType("PACKET");
    setTotalKg("");
    setExtraKg("");
    setFinalKg("");
    finalTouched.current = false;
    setTotalBill("");
    setFactoryId("");
    setCylinderId("");
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
              totalKg: total,
              extraKg: extra,
              finalKg: Number(finalKg) || total + extra,
              totalBill: bill,
              factoryId,
              cylinderId: cylinderId || "",
              advanceAmount: advance,
              advanceAccountId,
              notes,
            }),
          {
            onOk: (r) => {
              const no = (r as unknown as { data?: { orderNo?: number } }).data?.orderNo;
              toast.success(`প্যাকেজিং অর্ডার PKG-${no} তৈরি হয়েছে`);
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
              className={cn(
                "min-h-[48px] rounded-xl border px-2 py-2 text-[13px] font-bold transition",
                workType === t ? "border-brand-700 bg-brand-700 text-white shadow-sm" : "border-slate-300 bg-white text-slate-700 hover:border-brand-400"
              )}
            >
              {WORK_TYPE_BN[t]}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="মোট কেজি" required>
          <Input value={totalKg} onChange={(e) => setTotalKg(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
        <Field label="এক্সট্রা কেজি">
          <Input value={extraKg} onChange={(e) => setExtraKg(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
        <Field label="ফাইনাল কেজি" hint="স্বয়ংক্রিয়: মোট + এক্সট্রা">
          <Input
            value={finalKg}
            onChange={(e) => {
              finalTouched.current = true;
              setFinalKg(e.target.value);
            }}
            placeholder="০"
            inputMode="decimal"
          />
        </Field>
      </div>

      <Field label="টোটাল বিল (৳)" required hint="ম্যানুয়ালি লিখুন">
        <Input value={totalBill} onChange={(e) => setTotalBill(e.target.value)} placeholder="যেমন 80000" inputMode="decimal" />
      </Field>

      {workType !== "ART_PAPER" && (
        <Field
          label="সিলিন্ডার"
          hint={
            workType === "CYLINDER_PACKET"
              ? "নতুন সিলিন্ডার বানালে খালি রাখুন; আগের সিলিন্ডার হলে বেছে নিন"
              : "আগের সিলিন্ডার থাকলে বেছে নিন — ফ্যাক্টরি নিজে থেকে বসে যাবে"
          }
        >
          <EntityPicker
            options={cylOptions.map((o) => ({ id: o.id, name: o.name, sub: o.sub, badge: "আছে" }))}
            value={{ id: cylinderId || null, name: selectedCylinder?.name ?? "" }}
            onChange={(v) => {
              setCylinderId(v.id ?? "");
              const cyl = cylinders.find((c) => c.id === v.id);
              if (cyl) setFactoryId(cyl.factoryId); // cylinder → factory auto-fill
            }}
            placeholder="সিলিন্ডার খুঁজুন…"
            allowNew={false}
          />
        </Field>
      )}

      <Field label="ফ্যাক্টরি" required hint={selectedCylinder ? "সিলিন্ডার থেকে নিজে থেকে এসেছে — চাইলে বদলাতে পারেন" : undefined}>
        <Select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
          <option value="">— ফ্যাক্টরি বেছে নিন —</option>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <Field label="অ্যাডভান্স (৳) — থাকলে" hint={advance > 0 ? "টাকা কোন অ্যাকাউন্টে এলো নিচে বেছে নিন" : undefined}>
          <Input value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
        {advance > 0 && (
          <div className="mt-3">
            <AccountChips accounts={accounts} value={advanceAccountId} onChange={setAdvanceAccountId} />
          </div>
        )}
        {advance > 0 && advance > bill && <p className="mt-2 text-xs font-bold text-red-600">অ্যাডভান্স বিলের চেয়ে বেশি হয়েছে</p>}
      </div>

      <Field label="নোট">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="অতিরিক্ত কিছু লিখতে চাইলে…" rows={2} />
      </Field>

      <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-white via-white to-transparent px-1 pb-1 pt-6">
        <Button type="submit" full size="lg" disabled={!canSave}>
          {pending ? <Spinner /> : null} {pending ? "সেভ হচ্ছে…" : `অর্ডার সেভ করুন${bill > 0 ? ` (${bnMoney(bill)})` : ""}`}
        </Button>
      </div>
    </form>
  );
}
