"use server";

import { requireUser } from "@/server/auth";
import { run } from "./helpers";
import * as users from "@/server/services/users";

export async function createUserAction(input: { name: string; password: string; role: "OWNER" | "STAFF" }) {
  const actor = await requireUser();
  return run(() => users.createUser(actor, input).then((u) => ({ id: u.id })));
}

export async function setUserActiveAction(userId: string, active: boolean) {
  const actor = await requireUser();
  return run(() => users.setUserActive(actor, userId, active));
}

export async function resetPasswordAction(userId: string, newPassword: string) {
  const actor = await requireUser();
  return run(() => users.resetPassword(actor, userId, newPassword));
}

export async function changeOwnPasswordAction(oldPassword: string, newPassword: string) {
  const actor = await requireUser();
  return run(() => users.changeOwnPassword(actor, oldPassword, newPassword));
}
