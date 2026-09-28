"use client";

import * as React from "react";
import { Button, Field, Input, Select, Spinner } from "@/components/ui";
import { Sheet, ConfirmSheet } from "@/components/sheet";
import { useSubmit } from "./use-submit";
import { createUserAction, setUserActiveAction, resetPasswordAction, changeOwnPasswordAction } from "@/app/actions/team";

export function AddUserForm({ onDone }: { onDone?: () => void }) {
  const { pending, submit } = useSubmit();
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"OWNER" | "STAFF">("STAFF");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => createUserAction({ name: name.trim(), password, role }), {
          success: `${name.trim()} যোগ হয়েছে`,
          onOk: () => {
            setName("");
            setPassword("");
            setRole("STAFF");
            onDone?.();
          },
        });
      }}
    >
      <Field label="নাম" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="যেমন: Saiful" autoFocus />
      </Field>
      <Field label="পাসওয়ার্ড" required hint="কমপক্ষে ৪ অক্ষর — পরে Team থেকে রিসেট করা যাবে">
        <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="পাসওয়ার্ড" />
      </Field>
      <Field label="ভূমিকা" required>
        <Select value={role} onChange={(e) => setRole(e.target.value as never)}>
          <option value="STAFF">স্টাফ</option>
          <option value="OWNER">Owner/Admin</option>
        </Select>
      </Field>
      <Button type="submit" full size="lg" disabled={pending || name.trim().length < 2 || password.length < 4}>
        {pending ? <Spinner /> : null} ইউজার যোগ করুন
      </Button>
    </form>
  );
}

export function UserRowActions({ userId, name, active }: { userId: string; name: string; active: boolean }) {
  const { pending, submit } = useSubmit();
  const [resetOpen, setResetOpen] = React.useState(false);
  const [toggleOpen, setToggleOpen] = React.useState(false);
  const [newPass, setNewPass] = React.useState("");
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => setResetOpen(true)} disabled={pending}>
        পাসওয়ার্ড রিসেট
      </Button>
      <Button size="sm" variant={active ? "outlineDanger" : "subtle"} onClick={() => setToggleOpen(true)} disabled={pending}>
        {active ? "Deactivate" : "Activate"}
      </Button>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title={`${name} — পাসওয়ার্ড রিসেট`}>
        <Field label="নতুন পাসওয়ার্ড" required>
          <Input value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="কমপক্ষে ৪ অক্ষর" autoFocus />
        </Field>
        <Button
          full
          size="lg"
          className="mt-4"
          disabled={pending || newPass.length < 4}
          onClick={() =>
            submit(() => resetPasswordAction(userId, newPass), {
              success: "পাসওয়ার্ড বদল হয়েছে",
              onOk: () => {
                setResetOpen(false);
                setNewPass("");
              },
            })
          }
        >
          {pending ? <Spinner /> : null} রিসেট করুন
        </Button>
      </Sheet>

      <ConfirmSheet
        open={toggleOpen}
        onClose={() => setToggleOpen(false)}
        onConfirm={() =>
          submit(() => setUserActiveAction(userId, !active), {
            success: active ? "Deactivate হয়েছে" : "Activate হয়েছে",
            onOk: () => setToggleOpen(false),
          })
        }
        pending={pending}
        title={active ? "ইউজার Deactivate?" : "ইউজার Activate?"}
        message={
          active ? (
            <span>
              <b>{name}</b> আর login করতে পারবে না। ইতিহাস মুছে যাবে না।
            </span>
          ) : (
            <span>
              <b>{name}</b> আবার login করতে পারবে।
            </span>
          )
        }
        confirmLabel={active ? "Deactivate করুন" : "Activate করুন"}
        danger={active}
      />
    </div>
  );
}

export function ChangePasswordForm() {
  const { pending, submit } = useSubmit();
  const [oldPass, setOldPass] = React.useState("");
  const [newPass, setNewPass] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const mismatch = newPass !== confirm && confirm.length > 0;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => changeOwnPasswordAction(oldPass, newPass), {
          success: "পাসওয়ার্ড বদল হয়েছে",
          onOk: () => {
            setOldPass("");
            setNewPass("");
            setConfirm("");
          },
        });
      }}
    >
      <Field label="পুরাতন পাসওয়ার্ড" required>
        <Input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="নতুন পাসওয়ার্ড" required error={mismatch ? "দুই পাসওয়ার্ড মিলছে না" : undefined}>
        <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label="নতুন পাসওয়ার্ড আবার" required>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </Field>
      <Button type="submit" full size="lg" disabled={pending || oldPass.length < 1 || newPass.length < 4 || mismatch}>
        {pending ? <Spinner /> : null} পাসওয়ার্ড বদল করুন
      </Button>
    </form>
  );
}
