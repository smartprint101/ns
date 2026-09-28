import { z } from "zod";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { BizError, logEvent, notifyUser, type CurrentUser } from "./shared";
import { m2 } from "@/lib/utils";

const { tasks, users } = schema;

const taskSchema = z.object({
  title: z.string().trim().min(2, "কাজের নাম লিখুন"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  assignedToId: z.string().min(1, "কাকে দিচ্ছেন বেছে নিন"),
});
export type TaskInput = z.infer<typeof taskSchema>;

export async function createTask(actor: CurrentUser, input: unknown) {
  const data = taskSchema.parse(input);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [assignee] = await tx.select().from(users).where(and(eq(users.id, data.assignedToId), eq(users.active, true))).limit(1);
    if (!assignee) throw new BizError("ইউজার পাওয়া যায়নি");
    const [task] = await tx
      .insert(tasks)
      .values({ title: data.title, description: data.description || null, assignedToId: assignee.id, createdById: actor.id })
      .returning();
    await logEvent(tx, {
      entity: "TASK",
      entityId: task.id,
      action: "CREATED",
      detail: `${data.title} → ${assignee.name}`,
      actorId: actor.id,
    });
    if (assignee.id !== actor.id) {
      await notifyUser(tx, assignee.id, {
        type: "TASK_ASSIGNED",
        message: `${actor.name} আপনাকে টাস্ক দিয়েছেন: ${data.title}`,
        link: "/tasks",
      });
    }
    return task;
  });
}

export async function completeTask(actor: CurrentUser, taskId: string, completionNote?: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).limit(1).for("update");
    if (!task) throw new BizError("টাস্ক পাওয়া যায়নি");
    if (task.status !== "PENDING") throw new BizError("এই টাস্ক আর বাকি নেই");
    await tx
      .update(tasks)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: actor.id,
        completionNote: completionNote?.trim() || null,
      })
      .where(eq(tasks.id, taskId));
    await logEvent(tx, { entity: "TASK", entityId: taskId, action: "COMPLETED", detail: completionNote?.trim() || undefined, actorId: actor.id });
    // স্লিপ টাস্ক হলে — অর্ডারের ধাপ «স্লিপ তৈরি করা হয়েছে» করে দাও
    if (task.regularOrderId) {
      const { markSlipDoneFromTask } = await import("./regular-orders");
      await markSlipDoneFromTask(tx, actor, task.regularOrderId);
    }
    if (task.createdById !== actor.id) {
      await notifyUser(tx, task.createdById, {
        type: "TASK_COMPLETED",
        message: `${actor.name} টাস্ক শেষ করেছেন: ${task.title}`,
        link: "/tasks?tab=done",
      });
    }
  });
}

export async function cancelTask(actor: CurrentUser, taskId: string, reason?: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).limit(1).for("update");
    if (!task) throw new BizError("টাস্ক পাওয়া যায়নি");
    if (task.status !== "PENDING") throw new BizError("এই টাস্ক আর বাকি নেই");
    await tx
      .update(tasks)
      .set({ status: "CANCELLED", cancelledAt: new Date(), completionNote: reason?.trim() || null })
      .where(eq(tasks.id, taskId));
    await logEvent(tx, { entity: "TASK", entityId: taskId, action: "CANCELLED", detail: reason?.trim() || undefined, actorId: actor.id });
    if (task.assignedToId !== actor.id) {
      await notifyUser(tx, task.assignedToId, {
        type: "TASK_COMPLETED",
        message: `${actor.name} টাস্ক বাতিল করেছেন: ${task.title}`,
        link: "/tasks",
      });
    }
  });
}

export async function listTasks(opts: { status?: string; assignedToId?: string; q?: string }) {
  const db = await getDb();
  const status = opts.status === "completed" ? "COMPLETED" : opts.status === "cancelled" ? "CANCELLED" : "PENDING";
  const conds = [eq(tasks.status, status as never)];
  if (opts.assignedToId) conds.push(eq(tasks.assignedToId, opts.assignedToId));
  if (opts.q?.trim()) conds.push(ilike(tasks.title, `%${opts.q.trim()}%`));
  const rows = await db
    .select({
      task: tasks,
      assignedToName: users.name,
      createdByName: sql<string>`cb.name`,
      completedByName: sql<string | null>`dob.name`,
      expenseSum: sql<number>`coalesce((select sum(e.amount)::float8 from ${schema.expenses} e where e.task_id = "tasks"."id" and e.voided_at is null), 0)`,
    })
    .from(tasks)
    .innerJoin(users, eq(users.id, tasks.assignedToId))
    .innerJoin(sql`${users} as cb`, sql`cb.id = ${tasks.createdById}`)
    .leftJoin(sql`${users} as dob`, sql`dob.id = ${tasks.completedById}`)
    .where(and(...conds))
    .orderBy(...(status === "PENDING" ? [asc(tasks.createdAt)] : [desc(tasks.updatedAt)])) // oldest pending first
    .limit(250);
  return rows;
}

export async function getTask(id: string) {
  const db = await getDb();
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { assignedTo: true, createdBy: true, completedBy: true },
  });
  if (!task) return null;
  const expenseRows = await db
    .select({
      id: schema.expenses.id,
      amount: schema.expenses.amount,
      category: schema.expenses.category,
      description: schema.expenses.description,
      date: schema.expenses.date,
      voidedAt: schema.expenses.voidedAt,
      accountName: schema.accounts.nameBn,
      createdByName: schema.users.name,
    })
    .from(schema.expenses)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.expenses.accountId))
    .innerJoin(schema.users, eq(schema.users.id, schema.expenses.createdById))
    .where(eq(schema.expenses.taskId, id))
    .orderBy(desc(schema.expenses.date));
  return { task, expenses: expenseRows.map((e) => ({ ...e, amount: m2(e.amount) })) };
}
