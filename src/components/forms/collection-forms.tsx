"use client";

import * as React from "react";
import { Button, Field, Input, Textarea, Spinner } from "@/components/ui";
import { Sheet, ConfirmSheet } from "@/components/sheet";
import { AccountChips } from "./account-chips";
import { useSubmit } from "./use-submit";
import { createCollectionAction, receiveCollectionAction, cancelCollectionAction, createCashSaleAction } from "@/app/actions/money";
import { bnMoney } from "@/lib/bn";

type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };

/** সরাসরি টাকা আসার এন্ট্রি — আলাদা পেমেন্ট অপশন নয়, সবই কালেকশন। */
export function DirectCollectionForm({ accounts, onDone }: { accounts: AccountRow[]; onDone?: () => void }) {
  const { pending, submit, router } = useSubmit();
  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const amt = Number(amount) || 0;

  const reset = () => {
    setTitle("");
    setAmount("");
    setNotes("");
    setAccountId("");
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => createCashSaleAction({ title: title.trim(), amount: amt, accountId, notes: notes.trim() }), {
          success: "কালেকশন সেভ হয়েছে",
          onOk: () => {
            reset();
            if (onDone) onDone();
            else router.push("/collections?tab=done");
          },
        });
      }}
    >
      <Field label="আয়ের নাম / কোথা থেকে কালেকশন" required hint="যেমন: কাস্টমার অ্যাডভান্স, বকেয়া, দোকান বিক্রয়">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="কোথা থেকে টাকা এলো…" autoFocus />
      </Field>
      <Field label="কত টাকা (৳)" required>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="যেমন 50000" inputMode="decimal" />
      </Field>
      <Field label="টাকা কোথায় এসেছে" required>
        <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />
      </Field>
      <Field label="বিবরণ" hint="ঐচ্ছিক — না দিলেও চলবে">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="প্রয়োজন হলে বিস্তারিত লিখুন…" />
      </Field>
      <Button type="submit" full size="lg" disabled={pending || !title.trim() || amt <= 0 || !accountId}>
        {pending ? <Spinner /> : null} কালেকশন সেভ করুন{amt > 0 ? ` (${bnMoney(amt)})` : ""}
      </Button>
    </form>
  );
}

export function CollectionForm({ onDone }: { onDone?: () => void }) {
  const { pending, submit, router } = useSubmit();
  const [title, setTitle] = React.useState("");
  const [expectedAmount, setExpectedAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const amount = Number(expectedAmount) || 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => createCollectionAction({ title: title.trim(), expectedAmount: amount, notes }), {
          success: "কালেকশন এন্ট্রি হয়েছে",
          onOk: () => {
            if (onDone) {
              setTitle("");
              setExpectedAmount("");
              setNotes("");
              onDone();
            } else {
              router.push("/collections");
            }
          },
        });
      }}
    >
      <Field label="কুরিয়ার / বিবরণ" required hint="যেমন: Pathao কালেকশন, Steadfast — ঢাকা">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="কোন কুরিয়ারের টাকা…" autoFocus />
      </Field>
      <Field label="কত টাকা আসার কথা (৳)" required>
        <Input value={expectedAmount} onChange={(e) => setExpectedAmount(e.target.value)} placeholder="যেমন 50000" inputMode="decimal" />
      </Field>
      <Field label="নোট">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <Button type="submit" full size="lg" disabled={pending || !title.trim() || amount <= 0}>
        {pending ? <Spinner /> : null} কালেকশন সেভ করুন
      </Button>
    </form>
  );
}

export function CollectionActions({
  id,
  title,
  expectedAmount,
  accounts,
}: {
  id: string;
  title: string;
  expectedAmount: number;
  accounts: AccountRow[];
}) {
  const { pending, submit, refresh } = useSubmit();
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [receivedAmount, setReceivedAmount] = React.useState(String(expectedAmount));
  const [accountId, setAccountId] = React.useState("");
  const amount = Number(receivedAmount) || 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        onClick={() => {
          setReceivedAmount(String(expectedAmount));
          setReceiveOpen(true);
        }}
      >
        ৳ রিসিভ করুন
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setCancelOpen(true)} disabled={pending}>
        বাতিল
      </Button>

      <Sheet open={receiveOpen} onClose={() => setReceiveOpen(false)} title="কালেকশন রিসিভ">
        <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          {title} — প্রত্যাশিত <b>{bnMoney(expectedAmount)}</b>
        </p>
        <div className="space-y-4">
          <Field label="কত টাকা এলো? (৳)" required>
            <Input value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} inputMode="decimal" autoFocus />
          </Field>
          <Field label="টাকা কোথায় এসেছে" required>
            <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />
          </Field>
          <Button
            full
            size="lg"
            disabled={pending || amount <= 0 || !accountId}
            onClick={() =>
              submit(() => receiveCollectionAction({ id, receivedAmount: amount, accountId }), {
                success: "কালেকশন রিসিভ হয়েছে",
                onOk: () => {
                  setReceiveOpen(false);
                  setAccountId("");
                },
              })
            }
          >
            {pending ? <Spinner /> : null} রিসিভ করুন ({bnMoney(amount)})
          </Button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() =>
          submit(() => cancelCollectionAction(id), {
            success: "কালেকশন বাতিল হয়েছে",
            onOk: () => {
              setCancelOpen(false);
              refresh();
            },
          })
        }
        pending={pending}
        title="কালেকশন বাতিল?"
        message={
          <span>
            «<b>{title}</b>» কালেকশনটি (প্রত্যাশিত {bnMoney(expectedAmount)}) বাতিল করবেন?
          </span>
        }
        confirmLabel="বাতিল করুন"
        danger
      />
    </div>
  );
}

/** সরাসরি কালেকশন দ্রুত এন্ট্রি — কালেকশন হিসাবে সাথে সাথে উঠবে। */
export function CashSaleButton({ accounts }: { accounts: AccountRow[] }) {
  const { pending, submit, refresh } = useSubmit();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const amt = Number(amount) || 0;

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        ৳ কালেকশন
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="কালেকশন">
        <div className="space-y-4">
          <Field label="আয়ের নাম / কোথা থেকে কালেকশন" required hint="যেমন: কাস্টমার অ্যাডভান্স বা বকেয়া">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="কোথা থেকে টাকা এলো…" autoFocus />
          </Field>
          <Field label="কত টাকা (৳)" required>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="০" />
          </Field>
          <Field label="টাকা কোথায় এসেছে" required>
            <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />
          </Field>
          <Field label="বিবরণ" hint="ঐচ্ছিক">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="প্রয়োজন হলে বিস্তারিত লিখুন…" />
          </Field>
          <Button
            full
            size="lg"
            disabled={pending || amt <= 0 || !accountId || title.trim().length < 2}
            onClick={() =>
              submit(() => createCashSaleAction({ title: title.trim(), amount: amt, accountId, notes: notes.trim() }), {
                success: "কালেকশন সেভ হয়েছে",
                onOk: () => {
                  setOpen(false);
                  setTitle("");
                  setAmount("");
                  setNotes("");
                  setAccountId("");
                  refresh();
                },
              })
            }
          >
            {pending ? <Spinner /> : null} সেভ করুন ({bnMoney(amt)})
          </Button>
        </div>
      </Sheet>
    </>
  );
}
