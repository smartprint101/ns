"use server";

import { requireUser } from "@/server/auth";
import { run } from "./helpers";
import * as payments from "@/server/services/payments";
import * as expenses from "@/server/services/expenses";
import * as collections from "@/server/services/collections";
import * as accounts from "@/server/services/accounts";

// ── Payments ─────────────────────────────────────────────────────────────────
/** Returns ok+data, a duplicate warning (user must resubmit with confirmed=true), or error. */
export async function createPaymentAction(input: payments.PaymentInput, confirmed = false) {
  const user = await requireUser();
  try {
    const result = await payments.createPayment(user, input, { confirmed });
    if (!result.ok) return { ok: false as const, warning: result.duplicateWarning };
    return { ok: true as const, paymentId: result.paymentId, txnNo: result.txnNo };
  } catch (e) {
    const { friendlyError } = await import("@/server/services/shared");
    return { ok: false as const, error: friendlyError(e) };
  }
}

export async function afterPaymentSaved() {
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
}

export async function voidPaymentAction(paymentId: string, reason: string) {
  const user = await requireUser();
  return run(() => payments.voidPayment(user, paymentId, reason));
}

/** Data for the payment form: a party/customer's active orders with due. */
export async function getOrdersForPayerAction(kind: "party" | "customer", id: string) {
  await requireUser();
  if (kind === "party") return payments.getActiveOrdersForParty(id);
  return payments.getActiveOrdersForCustomer(id);
}

// ── Expenses ─────────────────────────────────────────────────────────────────
export async function createExpenseAction(input: expenses.ExpenseInput, confirmed = false) {
  const user = await requireUser();
  try {
    const result = await expenses.createExpense(user, input, { confirmed });
    if (!result.ok) return { ok: false as const, warning: result.duplicateWarning };
    return { ok: true as const, expenseId: result.expenseId };
  } catch (e) {
    const { friendlyError } = await import("@/server/services/shared");
    return { ok: false as const, error: friendlyError(e) };
  }
}

export async function voidExpenseAction(expenseId: string, reason: string) {
  const user = await requireUser();
  return run(() => expenses.voidExpense(user, expenseId, reason));
}

// ── Courier collections ──────────────────────────────────────────────────────
export async function createCollectionAction(input: { title: string; expectedAmount: number; notes?: string }) {
  const user = await requireUser();
  return run(() => collections.createCollection(user, input).then((c) => ({ id: c.id })));
}

export async function receiveCollectionAction(input: { id: string; receivedAmount: number; accountId: string }) {
  const user = await requireUser();
  return run(() => collections.receiveCollection(user, input));
}

export async function cancelCollectionAction(id: string) {
  const user = await requireUser();
  return run(() => collections.cancelCollection(user, id));
}

/** সরাসরি কালেকশন এন্ট্রি — টাকা কোথায় এসেছে বেছে নিয়ে সাথে সাথে হিসাবে দেখাবে। */
export async function createCashSaleAction(input: { title: string; amount: number; accountId: string; notes?: string }) {
  const user = await requireUser();
  return run(() => collections.createCashSale(user, input).then((p) => ({ id: p.id })));
}

// ── Accounts / adjustments ───────────────────────────────────────────────────
export async function createAdjustmentAction(input: { accountId: string; amount: number; reason: string }) {
  const user = await requireUser();
  return run(() => accounts.createAdjustment(user, input).then((a) => ({ id: a.id })));
}

export async function createAccountAction(input: { nameBn: string; kind: "CASH" | "BANK" | "MOBILE"; openingBalance?: number }) {
  const user = await requireUser();
  return run(() => accounts.createAccount(user, input).then((a) => ({ id: a.id })));
}
