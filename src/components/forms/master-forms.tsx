"use client";

import * as React from "react";
import { Button, Field, Input, Select, Spinner } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { useSubmit } from "./use-submit";
import {
  createCustomerAction,
  updateCustomerAction,
  createPartyAction,
  updatePartyAction,
  createFactoryAction,
  updateFactoryAction,
  createCylinderAction,
  updateCylinderAction,
} from "@/app/actions/masters";

type BasicResult = { ok: boolean; error?: string };

function useSheet<T>(initial: T) {
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<T>(initial);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const openFor = (id: string | null, v: T) => {
    setEditingId(id);
    setValues(v);
    setOpen(true);
  };
  return { open, setOpen, values, setValues, editingId, openFor };
}

const inputCls = undefined;

// ── Customer ─────────────────────────────────────────────────────────────────
export function CustomerSheet() {
  const s = useSheet({ name: "", phone: "", address: "", notes: "" });
  const { pending, submit } = useSubmit();
  void inputCls;
  return {
    open: s.open,
    setOpen: s.setOpen,
    openFor: s.openFor,
    node: (
      <Sheet open={s.open} onClose={() => s.setOpen(false)} title={s.editingId ? "কাস্টমার এডিট" : "নতুন কাস্টমার"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const action: Promise<BasicResult> = s.editingId ? updateCustomerAction(s.editingId, s.values) : createCustomerAction(s.values);
            submit(() => action, { success: "সেভ হয়েছে", onOk: () => s.setOpen(false) });
          }}
        >
          <Field label="নাম" required>
            <Input value={s.values.name} onChange={(e) => s.setValues({ ...s.values, name: e.target.value })} autoFocus required />
          </Field>
          <Field label="ফোন">
            <Input value={s.values.phone} onChange={(e) => s.setValues({ ...s.values, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="ঠিকানা">
            <Input value={s.values.address} onChange={(e) => s.setValues({ ...s.values, address: e.target.value })} />
          </Field>
          <Field label="নোট">
            <Input value={s.values.notes} onChange={(e) => s.setValues({ ...s.values, notes: e.target.value })} />
          </Field>
          <Button type="submit" full size="lg" disabled={pending || s.values.name.trim().length < 2}>
            {pending ? <Spinner /> : null} সেভ করুন
          </Button>
        </form>
      </Sheet>
    ),
  };
}

// ── Packaging Party ──────────────────────────────────────────────────────────
export function PartySheet() {
  const s = useSheet({ name: "", phone: "", address: "", notes: "" });
  const { pending, submit } = useSubmit();
  return {
    open: s.open,
    setOpen: s.setOpen,
    openFor: s.openFor,
    node: (
      <Sheet open={s.open} onClose={() => s.setOpen(false)} title={s.editingId ? "পার্টি এডিট" : "নতুন পার্টি"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const action: Promise<BasicResult> = s.editingId ? updatePartyAction(s.editingId, s.values) : createPartyAction(s.values);
            submit(() => action, { success: "সেভ হয়েছে", onOk: () => s.setOpen(false) });
          }}
        >
          <Field label="পার্টির নাম" required>
            <Input value={s.values.name} onChange={(e) => s.setValues({ ...s.values, name: e.target.value })} autoFocus required />
          </Field>
          <Field label="ফোন">
            <Input value={s.values.phone} onChange={(e) => s.setValues({ ...s.values, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="ঠিকানা">
            <Input value={s.values.address} onChange={(e) => s.setValues({ ...s.values, address: e.target.value })} />
          </Field>
          <Field label="নোট">
            <Input value={s.values.notes} onChange={(e) => s.setValues({ ...s.values, notes: e.target.value })} />
          </Field>
          <Button type="submit" full size="lg" disabled={pending || s.values.name.trim().length < 2}>
            {pending ? <Spinner /> : null} সেভ করুন
          </Button>
        </form>
      </Sheet>
    ),
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────
export function FactorySheet({ role }: { role: "OWNER" | "STAFF" }) {
  const s = useSheet({ name: "", phone: "", address: "", notes: "", openingDue: 0 });
  const { pending, submit } = useSubmit();
  return {
    open: s.open,
    setOpen: s.setOpen,
    openFor: s.openFor,
    node: (
      <Sheet open={s.open} onClose={() => s.setOpen(false)} title={s.editingId ? "ফ্যাক্টরি এডিট" : "নতুন ফ্যাক্টরি"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const payload = { ...s.values, openingDue: Number(s.values.openingDue) || 0 };
            const action: Promise<BasicResult> = s.editingId ? updateFactoryAction(s.editingId, payload) : createFactoryAction(payload);
            submit(() => action, { success: "সেভ হয়েছে", onOk: () => s.setOpen(false) });
          }}
        >
          <Field label="ফ্যাক্টরির নাম" required>
            <Input value={s.values.name} onChange={(e) => s.setValues({ ...s.values, name: e.target.value })} autoFocus required />
          </Field>
          <Field label="ফোন">
            <Input value={s.values.phone} onChange={(e) => s.setValues({ ...s.values, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="ঠিকানা">
            <Input value={s.values.address} onChange={(e) => s.setValues({ ...s.values, address: e.target.value })} />
          </Field>
          <Field label="আগের বাকি (৳)" hint="ফ্যাক্টরির কাছে আগের কোনো পাওনা থাকলে (শুধু Owner বদলাতে পারবে)">
            <Input
              value={String(s.values.openingDue ?? "")}
              onChange={(e) => s.setValues({ ...s.values, openingDue: Number(e.target.value) || 0 })}
              inputMode="decimal"
              disabled={role !== "OWNER" && !!s.editingId}
            />
          </Field>
          <Field label="নোট">
            <Input value={s.values.notes} onChange={(e) => s.setValues({ ...s.values, notes: e.target.value })} />
          </Field>
          <Button type="submit" full size="lg" disabled={pending || s.values.name.trim().length < 2}>
            {pending ? <Spinner /> : null} সেভ করুন
          </Button>
        </form>
      </Sheet>
    ),
  };
}

// ── Cylinder ─────────────────────────────────────────────────────────────────
export function CylinderSheet({ factories }: { factories: { id: string; name: string }[] }) {
  const s = useSheet({ name: "", factoryId: factories[0]?.id ?? "", notes: "" });
  const { pending, submit } = useSubmit();
  return {
    open: s.open,
    setOpen: s.setOpen,
    openFor: s.openFor,
    node: (
      <Sheet open={s.open} onClose={() => s.setOpen(false)} title={s.editingId ? "সিলিন্ডার এডিট" : "নতুন সিলিন্ডার"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const action: Promise<BasicResult> = s.editingId ? updateCylinderAction(s.editingId, s.values) : createCylinderAction(s.values);
            submit(() => action, { success: "সেভ হয়েছে", onOk: () => s.setOpen(false) });
          }}
        >
          <Field label="সিলিন্ডারের নাম" required hint="যেমন: ABC Chips, Potato Crackers">
            <Input value={s.values.name} onChange={(e) => s.setValues({ ...s.values, name: e.target.value })} autoFocus required />
          </Field>
          <Field label="কোন ফ্যাক্টরিতে আছে" required>
            <Select value={s.values.factoryId} onChange={(e) => s.setValues({ ...s.values, factoryId: e.target.value })}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="নোট">
            <Input value={s.values.notes} onChange={(e) => s.setValues({ ...s.values, notes: e.target.value })} />
          </Field>
          <Button type="submit" full size="lg" disabled={pending || s.values.name.trim().length < 2 || !s.values.factoryId}>
            {pending ? <Spinner /> : null} সেভ করুন
          </Button>
        </form>
      </Sheet>
    ),
  };
}
