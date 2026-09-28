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

export async function updateRegularOrderAction(orderId: string, input: Omit<regular.RegularOrderInput, "customerId" | "customerName" | "phone" | "customerAddress">) {
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

export async function advancePackagingStageAction(orderId: string) {
  const user = await requireUser();
  return run(() => packaging.advancePackagingStage(user, orderId));
}

export async function cancelPackagingOrderAction(orderId: string, reason: string) {
  const user = await requireUser();
  return run(() => packaging.cancelPackagingOrder(user, orderId, reason).then(() => undefined));
}

export async function updatePackagingOrderAction(
  orderId: string,
  input: { totalKg: number; extraKg: number; finalKg: number; totalBill: number; factoryId: string; cylinderId?: string; notes?: string }
) {
  const user = await requireUser();
  return run(() => packaging.updatePackagingOrder(user, orderId, input).then(() => undefined));
}
