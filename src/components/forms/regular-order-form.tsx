"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, Spinner } from "@/components/ui";
import { EntityPicker, type PickerValue } from "./entity-picker";
import { useSubmit } from "./use-submit";
import { createRegularOrderAction } from "@/app/actions/orders";
import { bnMoney } from "@/lib/bn";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CustomerRow = { id: string; name: string; phone: string | null; address: string | null };

export function RegularOrderForm({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [customer, setCustomer] = React.useState<PickerValue>({ id: null, name: "" });
  const [phone, setPhone] = React.useState("");
  const [customerAddress, setCustomerAddress] = React.useState("");
  const [productName, setProductName] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [deliveryCharge, setDeliveryCharge] = React.useState("");
  const [hasCondition, setHasCondition] = React.useState(false);
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const qty = Number(quantity) || 0;
  const prc = Number(price) || 0;
  const del = Number(deliveryCharge) || 0;
  const total = Math.round((qty * prc + del) * 100) / 100;

  const reset = () => {
    setCustomer({ id: null, name: "" });
    setPhone("");
    setCustomerAddress("");
    setProductName("");
    setQuantity("");
    setPrice("");
    setDeliveryCharge("");
    setHasCondition(false);
    setAddress("");
    setNotes("");
  };

  const canSave = !pending && (customer.id || customer.name.trim().length >= 2) && productName.trim() && qty > 0 && total > 0;

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
              productName: productName.trim(),
              quantity: qty,
              price: prc,
              deliveryCharge: del,
              hasCondition,
              address,
              notes,
            }),
          {
            success: "অর্ডার তৈরি হয়েছে",
            onOk: (r) => {
              const no = (r as unknown as { data?: { orderNo?: number } }).data?.orderNo;
              toast.success(`রেগুলার অর্ডার #${no} তৈরি হয়েছে`);
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
          onChange={(v, opt) => {
            setCustomer(v);
            const row = customers.find((c) => c.id === v.id);
            if (row) {
              setPhone(row.phone ?? "");
              setCustomerAddress(row.address ?? "");
              if (!address) setAddress(row.address ?? "");
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

      <Field label="পণ্যের নাম" required>
        <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="যেমন: ডাল ৫০ কেজি / চাল / তেল…" />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="পরিমাণ" required>
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
        <Field label="দাম (৳)" required>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
        <Field label="ডেলিভারি চার্জ">
          <Input value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} placeholder="০" inputMode="decimal" />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
        <span className="text-sm font-semibold text-slate-600">মোট টাকা</span>
        <span className="text-lg font-extrabold text-slate-900">{bnMoney(total)}</span>
      </div>

      {/* কন্ডিশন toggle */}
      <button
        type="button"
        onClick={() => setHasCondition((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition",
          hasCondition ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"
        )}
      >
        <span>
          <span className={cn("block text-sm font-bold", hasCondition ? "text-amber-800" : "text-slate-700")}>কন্ডিশন আছে?</span>
          <span className="block text-xs text-slate-500">কুরিয়ারের মাধ্যমে টাকা পরে আসবে</span>
        </span>
        <span className={cn("relative h-7 w-12 rounded-full transition", hasCondition ? "bg-amber-500" : "bg-slate-300")}>
          <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition", hasCondition ? "left-[22px]" : "left-0.5")} />
        </span>
      </button>

      <Field label="ডেলিভারির ঠিকানা" hint="না দিলে কাস্টমারের ঠিকানা ব্যবহার হবে">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঠিকানা" />
      </Field>

      <Field label="নোট">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="অতিরিক্ত কিছু লিখতে চাইলে…" rows={2} />
      </Field>

      <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-white via-white to-transparent px-1 pb-1 pt-6">
        <Button type="submit" full size="lg" disabled={!canSave}>
          {pending ? <Spinner /> : null} {pending ? "সেভ হচ্ছে…" : "অর্ডার সেভ করুন"}
        </Button>
      </div>
    </form>
  );
}
