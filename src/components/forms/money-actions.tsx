"use client";

import * as React from "react";
import { Button, Field, Input, Select, Textarea, Spinner } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { AccountChips } from "./account-chips";
import { useSubmit } from "./use-submit";
import { voidPaymentAction, voidExpenseAction, createAdjustmentAction, createAccountAction } from "@/app/actions/money";
import { bnMoney } from "@/lib/bn";

/** Void (safe delete) a collection — balances reverse automatically. */
export function VoidPaymentButton({ paymentId, amount }: { paymentId: string; amount: number }) {
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  return (
    <>
      <Button variant="outlineDanger" size="sm" onClick={() => setOpen(true)} disabled={pending}>
        বাতিল করুন
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="কালেকশন বাতিল">
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {bnMoney(amount)} কালেকশনটি বাতিল হবে এবং অ্যাকাউন্ট ব্যালান্স/অর্ডারের জমা থেকে বাদ যাবে।
        </p>
        <Field label="কারণ" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="কেন বাতিল হচ্ছে…" autoFocus />
        </Field>
        <Button
          full
          variant="danger"
          size="lg"
          className="mt-4"
          disabled={pending || reason.trim().length < 2}
          onClick={() =>
            submit(() => voidPaymentAction(paymentId, reason), { success: "কালেকশন বাতিল হয়েছে", onOk: () => setOpen(false) })
          }
        >
          {pending ? <Spinner /> : null} বাতিল করুন
        </Button>
      </Sheet>
    </>
  );
}

export function VoidExpenseButton({ expenseId, amount }: { expenseId: string; amount: number }) {
  const { pending, submit } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  return (
    <>
      <Button variant="outlineDanger" size="sm" onClick={() => setOpen(true)} disabled={pending}>
        বাতিল করুন
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="খরচ বাতিল">
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {bnMoney(amount)} খরচটি বাতিল হবে এবং অ্যাকাউন্টে টাকা ফিরে আসবে।
        </p>
        <Field label="কারণ" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="কেন বাতিল হচ্ছে…" autoFocus />
        </Field>
        <Button
          full
          variant="danger"
          size="lg"
          className="mt-4"
          disabled={pending || reason.trim().length < 2}
          onClick={() =>
            submit(() => voidExpenseAction(expenseId, reason), { success: "খরচ বাতিল হয়েছে", onOk: () => setOpen(false) })
          }
        >
          {pending ? <Spinner /> : null} বাতিল করুন
        </Button>
      </Sheet>
    </>
  );
}

// ── OWNER: account adjustment + add account ─────────────────────────────────
export function AdjustmentForm({ accounts, onDone }: { accounts: { id: string; nameBn: string }[]; onDone?: () => void }) {
  const { pending, submit } = useSubmit();
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const num = Number(amount) || 0;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => createAdjustmentAction({ accountId, amount: num, reason }), {
          success: "অ্যাজাস্টমেন্ট হয়েছে",
          onOk: () => {
            setAmount("");
            setReason("");
            onDone?.();
          },
        });
      }}
    >
      <Field label="অ্যাকাউন্ট" required>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameBn}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="পরিমাণ (৳)" required hint="বাড়াতে চাইলে ধনাত্মক (+), কমাতে চাইলে ঋণাত্মক (−) লিখুন">
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="যেমন 500 বা -500" inputMode="decimal" autoFocus />
      </Field>
      <Field label="কারণ" required>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="যেমন: আগের ব্যালান্স ঠিক করা" />
      </Field>
      <Button type="submit" full size="lg" disabled={pending || num === 0 || reason.trim().length < 3}>
        {pending ? <Spinner /> : null} অ্যাজাস্টমেন্ট সেভ করুন
      </Button>
    </form>
  );
}

export function AddAccountForm({ onDone }: { onDone?: () => void }) {
  const { pending, submit } = useSubmit();
  const [nameBn, setNameBn] = React.useState("");
  const [kind, setKind] = React.useState<"CASH" | "BANK" | "MOBILE">("BANK");
  const [openingBalance, setOpeningBalance] = React.useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => createAccountAction({ nameBn: nameBn.trim(), kind, openingBalance: Number(openingBalance) || 0 }), {
          success: "নতুন অ্যাকাউন্ট যোগ হয়েছে",
          onOk: () => {
            setNameBn("");
            setOpeningBalance("");
            onDone?.();
          },
        });
      }}
    >
      <Field label="ব্যাংক/মাধ্যমের নাম" required hint="যেমন: সিটি ব্যাংক, রকেট">
        <Input value={nameBn} onChange={(e) => setNameBn(e.target.value)} autoFocus />
      </Field>
      <Field label="ধরন" required>
        <Select value={kind} onChange={(e) => setKind(e.target.value as never)}>
          <option value="BANK">ব্যাংক</option>
          <option value="MOBILE">মোবাইল ব্যাংকিং</option>
          <option value="CASH">ক্যাশ</option>
        </Select>
      </Field>
      <Field label="প্রারম্ভিক ব্যালান্স (৳)">
        <Input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="০" inputMode="decimal" />
      </Field>
      <Button type="submit" full size="lg" disabled={pending || nameBn.trim().length < 2}>
        {pending ? <Spinner /> : null} অ্যাকাউন্ট যোগ করুন
      </Button>
    </form>
  );
}
