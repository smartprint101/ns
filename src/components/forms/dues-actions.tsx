"use client";

import { Button } from "@/components/ui";
import { useSubmit } from "./use-submit";
import { setCustomerDuesDemotedAction } from "@/app/actions/orders";

/** বকেয়া লিস্টে কাস্টমারকে নিচে পাঠানো / আবার উপরে আনা। */
export function DuesDemoteButton({ customerId, customerName, demoted }: { customerId: string; customerName: string; demoted: boolean }) {
  const { pending, submit, refresh } = useSubmit();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        submit(() => setCustomerDuesDemotedAction(customerId, !demoted), {
          success: demoted ? `${customerName} আবার উপরে আনা হয়েছে` : `${customerName} লিস্টের নিচে পাঠানো হয়েছে`,
          onOk: refresh,
        })
      }
    >
      {demoted ? "⬆️ উপরে আনুন" : "⬇️ নিচে পাঠান"}
    </Button>
  );
}
