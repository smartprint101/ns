"use server";

import { requireUser } from "@/server/auth";
import { run } from "./helpers";
import * as creditors from "@/server/services/creditors";

export async function createCreditorAction(input: creditors.CreditorInput) {
  const user = await requireUser();
  return run(() => creditors.createCreditor(user, input).then((c) => ({ id: c.id })));
}

export async function settleCreditorAction(id: string) {
  const user = await requireUser();
  return run(() => creditors.settleCreditor(user, id));
}
