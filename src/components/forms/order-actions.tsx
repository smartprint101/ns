"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, Spinner } from "@/components/ui";
import { Sheet, ConfirmSheet } from "@/components/sheet";
import { useSubmit } from "./use-submit";
import {
  advanceRegularStageAction,
  cancelRegularOrderAction,
  updateRegularOrderAction,
  advancePackagingStageAction,
  cancelPackagingOrderAction,
  updatePackagingOrderAction,
} from "@/app/actions/orders";
import { EntityPicker } from "./entity-picker";
import { bnMoney } from "@/lib/bn";

const reasonCls = undefined;

export function CancelOrderButton({ kind, id, label }: { kind: "regular" | "packaging"; id: string; label: string }) {
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  void reasonCls;
  return (
    <>
      <Button variant="outlineDanger" size="md" onClick={() => setOpen(true)} disabled={pending}>
        {label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="অর্ডার বাতিল">
        <Field label="বাতিলের কারণ" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="কেন বাতিল হচ্ছে…" autoFocus />
        </Field>
        <Button
          full
          variant="danger"
          size="lg"
          className="mt-4"
          disabled={pending || reason.trim().length < 2}
          onClick={() =>
            submit(() => (kind === "regular" ? cancelRegularOrderAction(id, reason) : cancelPackagingOrderAction(id, reason)), {
              success: "অর্ডার বাতিল হয়েছে",
              onOk: () => setOpen(false),
            })
          }
        >
          {pending ? <Spinner /> : null} বাতিল করুন
        </Button>
      </Sheet>
    </>
  );
}

export function AdvanceStageButton({ kind, id, label, disabled }: { kind: "regular" | "packaging"; id: string; label: string; disabled?: boolean }) {
  const { pending, submit } = useSubmit();
  return (
    <Button
      size="lg"
      full
      disabled={pending || disabled}
      onClick={() =>
        submit(() => (kind === "regular" ? advanceRegularStageAction(id) : advancePackagingStageAction(id)), {
          success: "পরের ধাপে যাওয়া হয়েছে",
        })
      }
    >
      {pending ? <Spinner /> : null} {label}
    </Button>
  );
}

// ── Edit sheets ──────────────────────────────────────────────────────────────
type RegularEditable = {
  productName: string;
  quantity: number;
  price: number;
  deliveryCharge: number;
  hasCondition: boolean;
  address: string | null;
  notes: string | null;
};

export function EditRegularOrderButton({ orderId, order }: { orderId: string; order: RegularEditable }) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({ ...order, address: order.address ?? "", notes: order.notes ?? "" });
  const total = (Number(v.quantity) || 0) * (Number(v.price) || 0) + (Number(v.deliveryCharge) || 0);
  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        ✏️ তথ্য এডিট
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="অর্ডার এডিট" wide>
        <div className="space-y-4">
          <Field label="পণ্যের নাম" required>
            <Input value={v.productName} onChange={(e) => setV({ ...v, productName: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="পরিমাণ" required>
              <Input value={String(v.quantity)} onChange={(e) => setV({ ...v, quantity: Number(e.target.value) || 0 })} inputMode="decimal" />
            </Field>
            <Field label="দাম (৳)" required>
              <Input value={String(v.price)} onChange={(e) => setV({ ...v, price: Number(e.target.value) || 0 })} inputMode="decimal" />
            </Field>
            <Field label="ডেলিভারি চার্জ">
              <Input value={String(v.deliveryCharge)} onChange={(e) => setV({ ...v, deliveryCharge: Number(e.target.value) || 0 })} inputMode="decimal" />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
            <span className="text-sm font-semibold text-slate-600">মোট টাকা</span>
            <span className="font-extrabold">{bnMoney(total)}</span>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={v.hasCondition} onChange={(e) => setV({ ...v, hasCondition: e.target.checked })} className="h-5 w-5 rounded border-slate-300 accent-brand-700" />
            কন্ডিশন আছে
          </label>
          <Field label="ঠিকানা">
            <Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
          </Field>
          <Field label="নোট">
            <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={2} />
          </Field>
          <Button
            full
            size="lg"
            disabled={pending || total <= 0 || !v.productName.trim()}
            onClick={() =>
              submit(() => updateRegularOrderAction(orderId, { ...v, quantity: Number(v.quantity), price: Number(v.price), deliveryCharge: Number(v.deliveryCharge) }), {
                success: "আপডেট হয়েছে",
                onOk: () => {
                  setOpen(false);
                  router.refresh();
                },
              })
            }
          >
            {pending ? <Spinner /> : null} আপডেট করুন
          </Button>
        </div>
      </Sheet>
    </>
  );
}

type PackagingEditable = {
  totalKg: number;
  extraKg: number;
  finalKg: number;
  totalBill: number;
  factoryId: string;
  cylinderId: string | null;
  notes: string | null;
};

export function EditPackagingOrderButton({
  orderId,
  order,
  factories,
  cylinders,
}: {
  orderId: string;
  order: PackagingEditable;
  factories: { id: string; name: string }[];
  cylinders: { id: string; name: string; factoryId: string; factoryName: string }[];
}) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({ ...order, cylinderId: order.cylinderId ?? "", notes: order.notes ?? "" });
  const selectedCylinder = cylinders.find((c) => c.id === v.cylinderId);
  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        ✏️ তথ্য এডিট
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="প্যাকেজিং অর্ডার এডিট" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="মোট কেজি" required>
              <Input value={String(v.totalKg)} onChange={(e) => setV({ ...v, totalKg: Number(e.target.value) || 0 })} inputMode="decimal" />
            </Field>
            <Field label="এক্সট্রা কেজি">
              <Input value={String(v.extraKg)} onChange={(e) => setV({ ...v, extraKg: Number(e.target.value) || 0 })} inputMode="decimal" />
            </Field>
            <Field label="ফাইনাল কেজি" required>
              <Input value={String(v.finalKg)} onChange={(e) => setV({ ...v, finalKg: Number(e.target.value) || 0 })} inputMode="decimal" />
            </Field>
          </div>
          <Field label="টোটাল বিল (৳)" required>
            <Input value={String(v.totalBill)} onChange={(e) => setV({ ...v, totalBill: Number(e.target.value) || 0 })} inputMode="decimal" />
          </Field>
          <Field label="সিলিন্ডার">
            <EntityPicker
              options={cylinders.map((c) => ({ id: c.id, name: c.name, sub: c.factoryName }))}
              value={{ id: v.cylinderId || null, name: selectedCylinder?.name ?? "" }}
              onChange={(cv) => setV((prev) => ({ ...prev, cylinderId: cv.id ?? "", ...(cv.id ? { factoryId: cylinders.find((c) => c.id === cv.id)!.factoryId } : {}) }))}
              placeholder="সিলিন্ডার খুঁজুন…"
              allowNew={false}
            />
          </Field>
          <Field label="ফ্যাক্টরি" required>
            <Select value={v.factoryId} onChange={(e) => setV({ ...v, factoryId: e.target.value })}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="নোট">
            <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={2} />
          </Field>
          <Button
            full
            size="lg"
            disabled={pending || v.totalBill <= 0 || v.finalKg < v.totalKg}
            onClick={() =>
              submit(
                () =>
                  updatePackagingOrderAction(orderId, {
                    totalKg: Number(v.totalKg),
                    extraKg: Number(v.extraKg),
                    finalKg: Number(v.finalKg),
                    totalBill: Number(v.totalBill),
                    factoryId: v.factoryId,
                    cylinderId: v.cylinderId || "",
                    notes: v.notes,
                  }),
                {
                  success: "আপডেট হয়েছে",
                  onOk: () => {
                    setOpen(false);
                    router.refresh();
                  },
                }
              )
            }
          >
            {pending ? <Spinner /> : null} আপডেট করুন
          </Button>
        </div>
      </Sheet>
    </>
  );
}
