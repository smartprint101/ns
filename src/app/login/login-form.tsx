"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button, Field, Input, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

export function LoginForm({ userNames }: { userNames: string[] }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [name, setName] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {userNames.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">আপনার নাম বেছে নিন</p>
          <div className="flex flex-wrap gap-2">
            {userNames.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setName(n)}
                className={cn(
                  "min-h-[40px] rounded-xl border px-3 py-1.5 text-sm font-semibold transition",
                  name === n
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-brand-400"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <Field label="নাম" required>
        <Input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="আপনার নাম"
          autoComplete="username"
          required
        />
      </Field>
      <Field label="পাসওয়ার্ড" required>
        <Input name="password" type="password" placeholder="পাসওয়ার্ড" autoComplete="current-password" required />
      </Field>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200">
          {state.error}
        </p>
      )}
      <Button type="submit" full size="lg" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> অপেক্ষা করুন…
          </>
        ) : (
          "প্রবেশ করুন"
        )}
      </Button>
    </form>
  );
}
