"use server";

import { requireUser } from "@/server/auth";
import { run } from "./helpers";
import * as masters from "@/server/services/masters";

export async function createCustomerAction(input: masters.CustomerInput) {
  const user = await requireUser();
  return run(() => masters.createCustomer(input).then((c) => ({ id: c.id })));
}

export async function updateCustomerAction(id: string, input: masters.CustomerInput) {
  await requireUser();
  return run(() => masters.updateCustomer(id, input).then(() => undefined));
}

export async function createPartyAction(input: masters.PartyInput) {
  const user = await requireUser();
  return run(() => masters.createParty(user, input).then((p) => ({ id: p.id })));
}

export async function updatePartyAction(id: string, input: masters.PartyInput) {
  await requireUser();
  return run(() => masters.updateParty(id, input).then(() => undefined));
}

export async function createFactoryAction(input: masters.FactoryInput) {
  const user = await requireUser();
  return run(() => masters.createFactory(user, input).then((f) => ({ id: f.id })));
}

export async function updateFactoryAction(id: string, input: masters.FactoryInput) {
  await requireUser();
  return run(() => masters.updateFactory(id, input).then(() => undefined));
}

export async function createCylinderAction(input: masters.CylinderInput) {
  const user = await requireUser();
  return run(() => masters.createCylinder(user, input).then((c) => ({ id: c.id })));
}

export async function updateCylinderAction(id: string, input: masters.CylinderInput) {
  await requireUser();
  return run(() => masters.updateCylinder(id, input).then(() => undefined));
}
