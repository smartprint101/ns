"use client";

import { Button, Spinner } from "@/components/ui";
import { useSubmit } from "./use-submit";
import { markAllNotificationsReadAction } from "@/app/actions/notifications";

export function MarkReadButton() {
  const { pending, submit } = useSubmit();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => submit(() => markAllNotificationsReadAction(), { success: "সব পড়া হয়েছে" })}
    >
      {pending ? <Spinner /> : null} ✓ সব পড়া হিসেবে চিহ্নিত
    </Button>
  );
}
