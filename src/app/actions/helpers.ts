"use server";

import { revalidatePath } from "next/cache";
import { friendlyError } from "@/server/services/shared";

export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/** Run a service call, refresh all cached data, and return a UI-friendly result. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data } as ActionResult<T>;
  } catch (e) {
    return { ok: false, error: friendlyError(e) } as ActionResult<T>;
  }
}
