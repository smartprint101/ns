"use client";

import * as React from "react";
import { Button, Field, Input, Select, Textarea, Spinner } from "@/components/ui";
import { Sheet, ConfirmSheet } from "@/components/sheet";
import { useSubmit } from "./use-submit";
import { createTaskAction, completeTaskAction, cancelTaskAction } from "@/app/actions/tasks";
import { ExpenseForm, type OrderLinkOption } from "./expense-form";

type UserOpt = { id: string; name: string };
type AccountRow = { id: string; key: string; nameBn: string; kind: string; balance: number };

export function TaskForm({ users, onDone }: { users: UserOpt[]; onDone?: () => void }) {
  const { pending, submit, router } = useSubmit();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assignedToId, setAssignedToId] = React.useState(users[0]?.id ?? "");
  const canSave = !pending && title.trim().length >= 2 && assignedToId;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => createTaskAction({ title: title.trim(), description, assignedToId }), {
          success: "টাস্ক দেওয়া হয়েছে",
          onOk: () => {
            if (onDone) {
              setTitle("");
              setDescription("");
              onDone();
            } else {
              router.push("/tasks");
            }
          },
        });
      }}
    >
      <Field label="কী করতে হবে?" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: চক থেকে মাল নিয়ে আসো" autoFocus />
      </Field>
      <Field label="বিস্তারিত">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="ঐচ্ছিক…" />
      </Field>
      <Field label="কাকে দিচ্ছেন?" required>
        <Select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" full size="lg" disabled={!canSave}>
        {pending ? <Spinner /> : null} টাস্ক দিন
      </Button>
    </form>
  );
}

/** Action buttons on a pending task row: complete / add expense / cancel. */
export function TaskActions({
  taskId,
  taskTitle,
  accounts,
  parties,
  factories,
  orderOptions,
}: {
  taskId: string;
  taskTitle: string;
  accounts: AccountRow[];
  parties: { id: string; name: string }[];
  factories: { id: string; name: string }[];
  orderOptions: OrderLinkOption[];
}) {
  const { pending, submit } = useSubmit();
  const [doneOpen, setDoneOpen] = React.useState(false);
  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setDoneOpen(true)} disabled={pending}>
        ✓ ওকে
      </Button>
      <Button size="sm" variant="subtle" onClick={() => setExpenseOpen(true)} disabled={pending}>
        ৳ খরচ যোগ
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setCancelOpen(true)} disabled={pending}>
        বাতিল
      </Button>

      <Sheet open={doneOpen} onClose={() => setDoneOpen(false)} title="খাতায় এন্ট্রি হয়েছে?">
        <Field label="বিবরণ / নোট (ঐচ্ছিক)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="যেমন: খাতায় লিখে মিলিয়ে নিয়েছি" />
        </Field>
        <Button
          full
          size="lg"
          className="mt-4"
          disabled={pending}
          onClick={() =>
            submit(() => completeTaskAction(taskId, note), {
              success: "টাস্ক সম্পন্ন হয়েছে",
              onOk: () => {
                setDoneOpen(false);
                setNote("");
              },
            })
          }
        >
          {pending ? <Spinner /> : null} ওকে — টাস্ক শেষ
        </Button>
      </Sheet>

      <Sheet open={expenseOpen} onClose={() => setExpenseOpen(false)} title="টাস্কের খরচ">
        <ExpenseForm
          accounts={accounts}
          parties={parties}
          factories={factories}
          orderOptions={orderOptions}
          fixedTaskId={taskId}
          fixedTaskTitle={taskTitle}
          onDone={() => setExpenseOpen(false)}
        />
      </Sheet>

      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() =>
          submit(() => cancelTaskAction(taskId), {
            success: "টাস্ক বাতিল হয়েছে",
            onOk: () => setCancelOpen(false),
          })
        }
        pending={pending}
        title="টাস্ক বাতিল?"
        message={
          <span>
            «<b>{taskTitle}</b>» টাস্কটি বাতিল করবেন?
          </span>
        }
        confirmLabel="বাতিল করুন"
        danger
      />
    </div>
  );
}
