"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, Spinner } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { AccountChips } from "./account-chips";
import { useSubmit } from "./use-submit";
import {
  advanceRegularStageAction,
  cancelRegularOrderAction,
  updateRegularOrderAction,
  advancePackagingStageAction,
  cancelPackagingOrderAction,
  updatePackagingOrderAction,
  addExtraBillAction,
} from "@/app/actions/orders";
import { bnMoney } from "@/lib/bn";

type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };

export function CancelOrderButton({ kind, id, label }: { kind: "regular" | "packaging"; id: string; label: string }) {
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
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

/**
 * প্যাকেজিং ধাপ এগোনোর স্মার্ট বাটন:
 * - «কারখানায় পাঠানো» ধাপে গেলে → কোন কারখানায় দিলেন সেটা বাছাই করার পপআপ
 * - «কুরিয়ারে পাঠানো» ধাপে গেলে → «পেমেন্ট কি ফুল দিয়েছে?» পপআপ
 */
export function PackagingAdvanceButton({
  orderId,
  nextStage,
  label,
  factories,
  currentFactoryId,
  accounts,
  due,
}: {
  orderId: string;
  nextStage: string;
  label: string;
  factories: { id: string; name: string }[];
  currentFactoryId: string | null;
  accounts: AccountRow[];
  due: number;
}) {
  const { pending, submit } = useSubmit();
  const [factoryOpen, setFactoryOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [factoryId, setFactoryId] = React.useState(currentFactoryId ?? "");
  const [payMode, setPayMode] = React.useState<"full" | "partial" | "none">("full");
  const [payAmount, setPayAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [addToCollections, setAddToCollections] = React.useState(false);

  const amountNum = payMode === "full" ? due : Number(payAmount) || 0;

  const go = (opts?: Parameters<typeof advancePackagingStageAction>[1]) =>
    submit(() => advancePackagingStageAction(orderId, opts), {
      success: "পরের ধাপে যাওয়া হয়েছে",
      onOk: () => {
        setFactoryOpen(false);
        setPayOpen(false);
      },
    });

  const onClick = () => {
    if (nextStage === "PRODUCTION") setFactoryOpen(true);
    else if (nextStage === "DELIVERED" && due > 0) {
      setPayMode("full");
      setPayAmount(String(due));
      setPayOpen(true);
    } else go();
  };

  return (
    <>
      <Button size="lg" full disabled={pending} onClick={onClick}>
        {pending ? <Spinner /> : null} {label}
      </Button>

      {/* কারখানা বাছাই */}
      <Sheet open={factoryOpen} onClose={() => setFactoryOpen(false)} title="কোন কারখানায় কাজ দিয়েছেন?">
        <Field label="কারখানার নাম" required>
          <Select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
            <option value="">— কারখানা বেছে নিন —</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button full size="lg" className="mt-4" disabled={pending || !factoryId} onClick={() => go({ factoryId })}>
          {pending ? <Spinner /> : null} কারখানায় পাঠানো হয়েছে ✓
        </Button>
      </Sheet>

      {/* কুরিয়ারের সময় পেমেন্ট পপআপ */}
      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title="পেমেন্ট কি ফুল দিয়েছে?">
        <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          বকেয়া আছে <b className="text-red-600">{bnMoney(due)}</b> — কুরিয়ারে পাঠানোর সময় কত দিলো?
        </p>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(
            [
              { key: "full", label: "ফুল দিয়েছে" },
              { key: "partial", label: "কিছু দিয়েছে" },
              { key: "none", label: "পরে দেবে" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setPayMode(o.key);
                if (o.key === "full") setPayAmount(String(due));
                if (o.key === "none") setPayAmount("");
              }}
              className={`rounded-xl px-2 py-2.5 text-[13px] font-bold ring-1 ring-inset transition ${
                payMode === o.key ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {payMode !== "none" && (
          <div className="space-y-4">
            <Field label="কত টাকা দিলো (৳)" required>
              <Input value={payMode === "full" ? String(due) : payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" disabled={payMode === "full"} />
            </Field>
            <Field label="টাকা কোথায় জমা হলো" required>
              <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />
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
          </div>
        )}
        <Button
          full
          size="lg"
          className="mt-4"
          disabled={pending || (payMode !== "none" && (amountNum <= 0 || !accountId))}
          onClick={() =>
            go(
              payMode === "none"
                ? undefined
                : { payment: { amount: amountNum, accountId, addToCollections } }
            )
          }
        >
          {pending ? <Spinner /> : null}
          {payMode === "none"
            ? "কুরিয়ারে পাঠানো হয়েছে — বকেয়া থাকলো"
            : amountNum >= due
              ? `কুরিয়ারে পাঠানো + ফুল পেমেন্ট (${bnMoney(amountNum)}) — হিস্ট্রিতে যাবে`
              : `কুরিয়ারে পাঠানো + পেমেন্ট ${bnMoney(amountNum)}`}
        </Button>
      </Sheet>
    </>
  );
}

/** পরে এক্সট্রা টাকা যোগ (টোটাল বিলে যোগ হবে)। */
export function ExtraBillButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const amt = Number(amount) || 0;
  return (
    <>
      <Button variant="subtle" size="md" onClick={() => setOpen(true)}>
        + এক্সট্রা টাকা
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="এক্সট্রা টাকা যোগ">
        <div className="space-y-4">
          <Field label="কত টাকা যোগ হবে (৳)" required>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
          </Field>
          <Field label="কীসের জন্য">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: এক্সট্রা কেজি / ডিজাইন চার্জ…" />
          </Field>
          <Button
            full
            size="lg"
            disabled={pending || amt <= 0}
            onClick={() =>
              submit(() => addExtraBillAction(orderId, amt, note), {
                success: "এক্সট্রা টাকা যোগ হয়েছে",
                onOk: () => {
                  setOpen(false);
                  setAmount("");
                  setNote("");
                  router.refresh();
                },
              })
            }
          >
            {pending ? <Spinner /> : null} যোগ করুন ({bnMoney(amt)})
          </Button>
        </div>
      </Sheet>
    </>
  );
}

// ── Edit sheets ──────────────────────────────────────────────────────────────
type RegularEditable = {
  totalAmount: number;
  hasCondition: boolean;
  address: string | null;
  notes: string | null;
};

export function EditRegularOrderButton({ orderId, order }: { orderId: string; order: RegularEditable }) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({
    totalAmount: order.totalAmount,
    hasCondition: order.hasCondition,
    address: order.address ?? "",
    notes: order.notes ?? "",
  });
  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        ✏️ তথ্য এডিট
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="অর্ডার এডিট">
        <div className="space-y-4">
          <Field label="মোট টাকা (৳)" required>
            <Input value={String(v.totalAmount)} onChange={(e) => setV({ ...v, totalAmount: Number(e.target.value) || 0 })} inputMode="decimal" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={v.hasCondition} onChange={(e) => setV({ ...v, hasCondition: e.target.checked })} className="h-5 w-5 rounded border-slate-300 accent-brand-700" />
            কন্ডিশন আছে
          </label>
          <Field label="ঠিকানা">
            <Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
          </Field>
          <Field label="বিবরণ">
            <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={2} />
          </Field>
          <Button
            full
            size="lg"
            disabled={pending || v.totalAmount <= 0}
            onClick={() =>
              submit(() => updateRegularOrderAction(orderId, { totalAmount: Number(v.totalAmount), hasCondition: v.hasCondition, address: v.address, notes: v.notes }), {
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
  totalBill: number;
  factoryId: string | null;
  notes: string | null;
};

export function EditPackagingOrderButton({
  orderId,
  order,
  factories,
}: {
  orderId: string;
  order: PackagingEditable;
  factories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({
    totalKg: order.totalKg,
    totalBill: order.totalBill,
    factoryId: order.factoryId ?? "",
    notes: order.notes ?? "",
  });
  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        ✏️ তথ্য এডিট
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="প্যাকেজিং অর্ডার এডিট">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="কেজি" required>
              <Input value={String(v.totalKg)} onChange={(e) => setV({ ...v, totalKg: Number(e.target.value) || 0 })} inputMode="decimal" />
            </Field>
            <Field label="টোটাল বিল (৳)" required>
              <Input value={String(v.totalBill)} onChange={(e) => setV({ ...v, totalBill: Number(e.target.value) || 0 })} inputMode="decimal" />
            </Field>
          </div>
          <Field label="কারখানা">
            <Select value={v.factoryId} onChange={(e) => setV({ ...v, factoryId: e.target.value })}>
              <option value="">— এখনো ঠিক হয়নি —</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="বিবরণ">
            <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} rows={2} />
          </Field>
          <Button
            full
            size="lg"
            disabled={pending || v.totalBill <= 0 || v.totalKg <= 0}
            onClick={() =>
              submit(
                () =>
                  updatePackagingOrderAction(orderId, {
                    totalKg: Number(v.totalKg),
                    totalBill: Number(v.totalBill),
                    factoryId: v.factoryId,
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
