"use server";

import { requireUser } from "@/server/auth";
import { run } from "./helpers";
import * as regular from "@/server/services/regular-orders";
import * as packaging from "@/server/services/packaging-orders";

// ── Regular orders ───────────────────────────────────────────────────────────
export async function createRegularOrderAction(input: regular.RegularOrderInput) {
  const user = await requireUser();
  return run(() => regular.createRegularOrder(user, input).then((o) => ({ id: o.id, orderNo: o.orderNo })));
}

export async function advanceRegularStageAction(orderId: string) {
  const user = await requireUser();
  return run(() => regular.advanceRegularStage(user, orderId));
}

export async function cancelRegularOrderAction(orderId: string, reason: string) {
  const user = await requireUser();
  return run(() => regular.cancelRegularOrder(user, orderId, reason).then(() => undefined));
}

export async function updateRegularOrderAction(orderId: string, input: { totalAmount: number; hasCondition: boolean; address?: string; notes?: string }) {
  const user = await requireUser();
  return run(() => regular.updateRegularOrder(user, orderId, input).then(() => undefined));
}

export async function findConditionMatchesAction(amount: number) {
  await requireUser();
  const matches = await regular.findConditionMatches(amount);
  return matches.map((m) => ({
    orderId: m.order.id,
    orderNo: m.order.orderNo,
    customerName: m.customer.name,
    totalAmount: m.order.totalAmount,
    diff: m.diff,
    createdAt: m.order.createdAt.toISOString(),
  }));
}

export async function receiveConditionAction(input: { orderId: string; receivedAmount: number; accountId: string; notes?: string }) {
  const user = await requireUser();
  return run(() => regular.receiveCondition(user, input));
}

// ── Packaging orders ─────────────────────────────────────────────────────────
export async function createPackagingOrderAction(input: packaging.PackagingOrderInput) {
  const user = await requireUser();
  return run(() => packaging.createPackagingOrder(user, input).then((o) => ({ id: o.id, orderNo: o.orderNo })));
}

export async function advancePackagingStageAction(orderId: string, opts?: packaging.AdvancePackagingOpts) {
  const user = await requireUser();
  return run(() => packaging.advancePackagingStage(user, orderId, opts));
}

export async function addExtraBillAction(orderId: string, amount: number, note?: string) {
  const user = await requireUser();
  return run(() => packaging.addExtraBill(user, orderId, amount, note));
}

export async function cancelPackagingOrderAction(orderId: string, reason: string) {
  const user = await requireUser();
  return run(() => packaging.cancelPackagingOrder(user, orderId, reason).then(() => undefined));
}

export async function updatePackagingOrderAction(
  orderId: string,
  input: { totalKg: number; totalBill: number; factoryId?: string; notes?: string }
) {
  const user = await requireUser();
  return run(() => packaging.updatePackagingOrder(user, orderId, input).then(() => undefined));
}

// ── বকেয়া পেজ ────────────────────────────────────────────────────────────────
export async function setCustomerDuesDemotedAction(customerId: string, demoted: boolean) {
  const user = await requireUser();
  return run(() => regular.setCustomerDuesDemoted(user, customerId, demoted).then(() => undefined));
}
