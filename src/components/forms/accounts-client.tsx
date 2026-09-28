"use client";

import * as React from "react";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { AdjustmentForm, AddAccountForm } from "./money-actions";

export function OwnerAccountButtons({ accounts }: { accounts: { id: string; nameBn: string }[] }) {
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
        ⚖️ অ্যাজাস্টমেন্ট
      </Button>
      <Button variant="secondary" onClick={() => setAddOpen(true)}>
        + নতুন ব্যাংক/মাধ্যম
      </Button>
      <Sheet open={adjustOpen} onClose={() => setAdjustOpen(false)} title="অ্যাকাউন্ট অ্যাজাস্টমেন্ট">
        <AdjustmentForm accounts={accounts} onDone={() => setAdjustOpen(false)} />
      </Sheet>
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="নতুন ব্যাংক/মাধ্যম যোগ">
        <AddAccountForm onDone={() => setAddOpen(false)} />
      </Sheet>
    </div>
  );
}
