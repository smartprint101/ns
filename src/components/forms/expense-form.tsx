"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, Spinner } from "@/components/ui";
import { EntityPicker, type PickerValue } from "./entity-picker";
import { AccountChips } from "./account-chips";
import { Sheet } from "@/components/sheet";
import { createExpenseAction, afterPaymentSaved } from "@/app/actions/money";
import { EXPENSE_CATEGORY_BN } from "@/lib/labels";
import { bnMoney } from "@/lib/bn";
import { toast } from "sonner";

type Opt = { id: string; name: string };
type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };
export type OrderLinkOption = { kind: "regular" | "packaging"; id: string; label: string };
type Warning = { message: string; matches: { id: string; amount: number; description: string; date: Date | string }[] };

export function ExpenseForm({
  accounts,
  parties,
  factories,
  orderOptions,
  fixedTaskId,
  fixedTaskTitle,
  initialRegularOrderId,
  initialPackagingOrderId,
  onDone,
}: {
  accounts: AccountRow[];
  parties: Opt[];
  factories: Opt[];
  orderOptions: OrderLinkOption[];
  fixedTaskId?: string;
  fixedTaskTitle?: string;
  initialRegularOrderId?: string;
  initialPackagingOrderId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<string>("OTHER");
  const [description, setDescription] = React.useState(fixedTaskTitle ?? "");
  const [accountId, setAccountId] = React.useState("");
  const [party, setParty] = React.useState<PickerValue>({ id: null, name: "" });
  const [factoryId, setFactoryId] = React.useState("");
  const [orderLink, setOrderLink] = React.useState(
    initialPackagingOrderId ? `packaging:${initialPackagingOrderId}` : initialRegularOrderId ? `regular:${initialRegularOrderId}` : ""
  );
  const [pending, setPending] = React.useState(false);
  const [warning, setWarning] = React.useState<Warning | null>(null);

  const amountNum = Number(amount) || 0;
  const canSave = !pending && amountNum > 0 && description.trim().length >= 2 && accountId;

  // Picking a factory suggests the FACTORY category
  React.useEffect(() => {
    if (factoryId) setCategory("FACTORY");
  }, [factoryId]);

  const [orderKind, orderId] = orderLink.includes(":") ? (orderLink.split(":") as ["regular" | "packaging", string]) : [null, null];

  async function doSave(confirmed: boolean) {
    const r = await createExpenseAction(
      {
        amount: amountNum,
        category: category as never,
        description: description.trim(),
        accountId,
        partyId: party.id ?? "",
        factoryId,
        regularOrderId: orderKind === "regular" ? orderId! : "",
        packagingOrderId: orderKind === "packaging" ? orderId! : "",
        taskId: fixedTaskId ?? "",
      },
      confirmed
    );
    if ("warning" in r && r.warning) {
      setWarning(r.warning as Warning);
      return false;
    }
    if (r.ok) {
      toast.success(`খরচ ${bnMoney(amountNum)} সেভ হয়েছে`);
      await afterPaymentSaved();
      setAmount("");
      setDescription(fixedTaskTitle ?? "");
      setCategory("OTHER");
      setAccountId("");
      setParty({ id: null, name: "" });
      setFactoryId("");
      setOrderLink("");
      router.refresh();
      onDone?.();
      return true;
    }
    toast.error("error" in r && r.error ? r.error : "সমস্যা হয়েছে — আবার চেষ্টা করুন");
    return false;
  }

  return (
    <div className="space-y-4">
      {fixedTaskTitle && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
          টাস্কের খরচ: {fixedTaskTitle}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="পরিমাণ (৳)" required>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="যেমন 3400" inputMode="decimal" autoFocus />
        </Field>
        <Field label="ক্যাটাগরি" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(EXPENSE_CATEGORY_BN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="বিবরণ" required hint="যেমন: চক থেকে ডাল এনেছি">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="কী খরচ হলো…" />
      </Field>

      <Field label="পেমেন্ট মেথড" required>
        <AccountChips accounts={accounts} value={accountId} onChange={setAccountId} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="পার্টির সঙ্গে লিংক (ঐচ্ছিক)">
          <EntityPicker
            options={parties.map((p) => ({ id: p.id, name: p.name }))}
            value={party}
            onChange={(v) => setParty(v)}
            placeholder="পার্টি…"
            allowNew={false}
          />
        </Field>
        <Field label="ফ্যাক্টরির সঙ্গে লিংক (ঐচ্ছিক)">
          <Select value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
            <option value="">— নেই —</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!fixedTaskId && (
        <Field label="অর্ডারের সঙ্গে লিংক (ঐচ্ছিক)">
          <Select value={orderLink} onChange={(e) => setOrderLink(e.target.value)}>
            <option value="">— সাধারণ খরচ —</option>
            <optgroup label="প্যাকেজিং অর্ডার">
              {orderOptions
                .filter((o) => o.kind === "packaging")
                .map((o) => (
                  <option key={o.id} value={`packaging:${o.id}`}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="রেগুলার অর্ডার">
              {orderOptions
                .filter((o) => o.kind === "regular")
                .map((o) => (
                  <option key={o.id} value={`regular:${o.id}`}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          </Select>
        </Field>
      )}

      <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-white via-white to-transparent px-1 pb-1 pt-6">
        <Button
          full
          size="lg"
          disabled={!canSave}
          onClick={async () => {
            setPending(true);
            await doSave(false);
            setPending(false);
          }}
        >
          {pending ? <Spinner /> : null} {pending ? "সেভ হচ্ছে…" : `খরচ সেভ করুন${amountNum > 0 ? ` (${bnMoney(amountNum)})` : ""}`}
        </Button>
      </div>

      {/* Duplicate warning: show, never hard-block */}
      <Sheet open={!!warning} onClose={() => setWarning(null)} title="⚠️ Similar entry already exists">
        <p className="text-sm text-slate-600">{warning?.message}</p>
        {warning && warning.matches.length > 0 && (
          <ul className="mt-3 space-y-2">
            {warning.matches.map((m) => (
              <li key={m.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm ring-1 ring-inset ring-amber-200">
                <span className="font-bold">{bnMoney(m.amount)}</span> — {m.description}{" "}
                <span className="text-xs text-slate-500">
                  ({new Date(m.date).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })})
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setWarning(null)}>
            বাতিল
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const ok = await doSave(true);
              if (ok) setWarning(null);
              setPending(false);
            }}
          >
            {pending ? <Spinner /> : null} হ্যাঁ, নিশ্চিত — সেভ করুন
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
