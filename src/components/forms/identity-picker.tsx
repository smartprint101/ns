"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Spinner } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { chooseIdentityAction, enterWithNewNameAction } from "@/app/actions/identity";

type UserOpt = { id: string; name: string };

/** নাম বাছাইয়ের মূল UI — তালিকা থেকে ট্যাপ, অথবা নতুন নাম লিখে প্রবেশ। */
function IdentityChoices({ users, onDone }: { users: UserOpt[]; onDone?: (name: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState("");

  const finish = (r: { ok: boolean; error?: string; name?: string }) => {
    if (r.ok && r.name) {
      toast.success(`স্বাগতম, ${r.name}!`);
      onDone?.(r.name);
      router.refresh();
    } else {
      toast.error(("error" in r && r.error) || "একটি সমস্যা হয়েছে — আবার চেষ্টা করুন");
    }
  };

  const pick = (u: UserOpt) => {
    setBusyId(u.id);
    startTransition(async () => {
      try {
        finish(await chooseIdentityAction({ userId: u.id }));
      } catch {
        toast.error("একটি সমস্যা হয়েছে — আবার চেষ্টা করুন");
      } finally {
        setBusyId(null);
      }
    });
  };

  const enterNew = () => {
    const name = newName.trim();
    if (name.length < 2) {
      toast.error("নাম দিন (কমপক্ষে ২ অক্ষর)");
      return;
    }
    setBusyId("__new__");
    startTransition(async () => {
      try {
        finish(await enterWithNewNameAction({ name }));
      } catch {
        toast.error("একটি সমস্যা হয়েছে — আবার চেষ্টা করুন");
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {users.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={pending}
              onClick={() => pick(u)}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 active:scale-[0.98] disabled:opacity-60"
            >
              {busyId === u.id ? <Spinner /> : null}
              {u.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold text-slate-400">তালিকায় নাম নেই?</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enterNew();
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="নতুন নাম লিখুন…"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || newName.trim().length < 2}>
          {busyId === "__new__" ? <Spinner /> : null} প্রবেশ
        </Button>
      </form>
    </div>
  );
}

/**
 * লগইনের পর (বা নতুন ডিভাইসে অ্যাপ খুললে) বাধ্যতামূলক পপআপ —
 * নাম বাছাই না করা পর্যন্ত বন্ধ করা যায় না।
 */
export function IdentityGate({ users }: { users: UserOpt[] }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl safe-bottom sm:max-w-lg sm:rounded-2xl">
        <div className="border-b border-slate-100 px-4 py-4">
          <h3 className="text-base font-bold text-slate-800">👋 আপনার নাম দিয়ে প্রবেশ করুন</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            এই ডিভাইসে আপনি কে — সেটা একবার বাছাই করুন। এরপর টাস্ক, নোটিফিকেশন ও সব কাজ আপনার নামে রেকর্ড হবে।
          </p>
        </div>
        <div className="overflow-y-auto p-4">
          <IdentityChoices users={users} />
        </div>
      </div>
    </div>
  );
}

/** সেটিংস থেকে নাম পরিবর্তনের বাটন + শিট। */
export function IdentityChangeButton({ users, currentName }: { users: UserOpt[]; currentName: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        🔁 নাম পরিবর্তন করুন
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="আপনি কে?">
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          এখন প্রবেশ করা আছে: <b className="text-slate-800">{currentName}</b> — অন্য কেউ এই ডিভাইস ব্যবহার করলে তার নাম বাছাই করুন।
        </p>
        <IdentityChoices users={users} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
