"use client";

import * as React from "react";
import { Button, Field, Input, Textarea, Spinner } from "@/components/ui";
import { ConfirmSheet } from "@/components/sheet";
import { createCreditorAction, settleCreditorAction } from "@/app/actions/creditors";
import { useSubmit } from "./use-submit";
import { bnMoney } from "@/lib/bn";

export function CreditorForm() {
  const { pending, submit, refresh } = useSubmit();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const amt = Number(amount) || 0;

  const reset = () => {
    setName("");
    setPhone("");
    setAmount("");
    setNotes("");
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => createCreditorAction({ name: name.trim(), phone: phone.trim(), amount: amt, notes: notes.trim() }), {
          success: "পাওনাদার যোগ হয়েছে",
          onOk: () => {
            reset();
            refresh();
          },
        });
      }}
    >
      <Field label="পাওনাদারের নাম" required hint="যাকে আমাদের টাকা দিতে হবে">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম লিখুন…" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="কত টাকা পাবে (৳)" required>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="যেমন 50000" inputMode="decimal" />
        </Field>
        <Field label="ফোন নম্বর" hint="ঐচ্ছিক">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" />
        </Field>
      </div>
      <Field label="বিবরণ" hint="ঐচ্ছিক — কী কারণে পাবে লিখতে পারেন">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="যেমন: মাল বাকি / সার্ভিস চার্জ / আগের হিসাব…" />
      </Field>
      <Button type="submit" full size="lg" disabled={pending || name.trim().length < 2 || amt <= 0}>
        {pending ? <Spinner /> : null} পাওনাদার সেভ করুন{amt > 0 ? ` (${bnMoney(amt)})` : ""}
      </Button>
    </form>
  );
}

export function SettleCreditorButton({ id, name, amount }: { id: string; name: string; amount: number }) {
  const { pending, submit, refresh } = useSubmit();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button size="sm" variant="subtle" onClick={() => setOpen(true)} disabled={pending}>
        পরিশোধ
      </Button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          submit(() => settleCreditorAction(id), {
            success: "পাওনা বন্ধ হয়েছে",
            onOk: () => {
              setOpen(false);
              refresh();
            },
          })
        }
        pending={pending}
        title="পাওনা পরিশোধ/বন্ধ?"
        message={
          <span>
            «<b>{name}</b>» — {bnMoney(amount)} পাওনা তালিকা থেকে সরাবেন? টাকা দিলে খরচ/ক্যাশ এন্ট্রি আলাদা করে দিন।
          </span>
        }
        confirmLabel="পরিশোধ/বন্ধ করুন"
      />
    </>
  );
}
