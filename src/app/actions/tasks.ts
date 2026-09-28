"use server";

import { requireUser } from "@/server/auth";
import { run } from "./helpers";
import * as tasks from "@/server/services/tasks";

export async function createTaskAction(input: { title: string; description?: string; assignedToId: string }) {
  const user = await requireUser();
  return run(() => tasks.createTask(user, input).then((t) => ({ id: t.id })));
}

export async function completeTaskAction(taskId: string, completionNote?: string) {
  const user = await requireUser();
  return run(() => tasks.completeTask(user, taskId, completionNote));
}

export async function cancelTaskAction(taskId: string, reason?: string) {
  const user = await requireUser();
  return run(() => tasks.cancelTask(user, taskId, reason));
}
