"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type BasicResult = { ok: boolean; error?: string };

export function useSubmit() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const submit = (
    fn: () => Promise<BasicResult>,
    opts?: { success?: string; onOk?: (r: BasicResult) => void }
  ) => {
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(opts?.success ?? "সেভ হয়েছে");
          opts?.onOk?.(r);
        } else {
          toast.error(r.error ?? "একটি সমস্যা হয়েছে — আবার চেষ্টা করুন");
        }
      } catch (e) {
        console.error(e);
        toast.error("একটি সমস্যা হয়েছে — আবার চেষ্টা করুন");
      }
    });
  };

  return { pending, submit, refresh: () => router.refresh(), router };
}
