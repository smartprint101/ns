"use client";

import * as React from "react";
import { Button, Field, Input, Textarea, Spinner } from "@/components/ui";
import { Sheet, ConfirmSheet } from "@/components/sheet";
import { AccountChips } from "./account-chips";
import { useSubmit } from "./use-submit";
import { createCollectionAction, receiveCollectionAction, cancelCollectionAction } from "@/app/actions/money";
import { bnMoney } from "@/lib/bn";
import { toast } from "sonner";

type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };

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
          <Field label="টাকা কোথায় জমা হলো" required>
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
