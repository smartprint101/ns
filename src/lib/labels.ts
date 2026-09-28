// All enum → Bengali label maps + workflow stage flows (single place to edit).
import type {
  RegularOrder,
  PackagingOrder,
} from "@/server/db/schema";

export const REGULAR_STAGE_BN: Record<string, string> = {
  PLACED: "নতুন অর্ডার",
  READY: "প্রোডাক্ট রেডি",
  COURIER_GIVEN: "কুরিয়ার দেওয়া হয়েছে",
  CONDITION_PENDING: "কন্ডিশন পেন্ডিং",
  COMPLETED: "সম্পন্ন",
};

export const STATUS_BN: Record<string, string> = {
  ACTIVE: "চলমান",
  COMPLETED: "সম্পন্ন",
  CANCELLED: "বাতিল",
};

export const WORK_TYPE_BN: Record<string, string> = {
  CYLINDER_PACKET: "সিলিন্ডার + প্যাকেট",
  PACKET: "প্যাকেট",
  ART_PAPER: "আর্ট পেপার",
};

export const PACKAGING_STAGE_BN: Record<string, string> = {
  PLACED: "অর্ডার নেওয়া হয়েছে",
  ADVANCE: "অ্যাডভান্স নেওয়া হয়েছে",
  DESIGN: "ডিজাইন",
  CYLINDER_SENT: "সিলিন্ডার পাঠানো হয়েছে",
  CYLINDER_READY: "সিলিন্ডার রেডি",
  PRODUCTION: "ফ্যাক্টরি/প্রোডাকশন",
  PRODUCTION_DONE: "প্রোডাকশন সম্পন্ন",
  MATERIAL_RECEIVED: "মাল রিসিভ করা হয়েছে",
  DELIVERED: "ডেলিভারি দেওয়া হয়েছে",
  COMPLETED: "সম্পন্ন",
};

export const EXPENSE_CATEGORY_BN: Record<string, string> = {
  FACTORY: "ফ্যাক্টরি পেমেন্ট",
  PURCHASE: "কাঁচামাল/কেনাকাটা",
  COURIER: "কুরিয়ার",
  PACKAGING: "প্যাকেজিং",
  TRANSPORT: "পরিবহন",
  OTHER: "অন্যান্য",
};

export const TASK_STATUS_BN: Record<string, string> = {
  PENDING: "বাকি আছে",
  COMPLETED: "সম্পন্ন",
  CANCELLED: "বাতিল",
};

export const COLLECTION_STATUS_BN: Record<string, string> = {
  PENDING: "আনা বাকি",
  RECEIVED: "রিসিভ হয়েছে",
  CANCELLED: "বাতিল",
};

export const PAYMENT_SOURCE_BN: Record<string, string> = {
  MANUAL: "সাধারণ পেমেন্ট",
  CONDITION: "কন্ডিশন",
  COURIER_COLLECTION: "কুরিয়ার কালেকশন",
};

/** Regular order stage progression. Courier given + condition → CONDITION_PENDING; else straight to COMPLETED. */
export function nextRegularStage(o: Pick<RegularOrder, "stage" | "hasCondition">): string | null {
  switch (o.stage) {
    case "PLACED":
      return "READY";
    case "READY":
      return "COURIER_GIVEN";
    case "COURIER_GIVEN":
      return o.hasCondition ? "CONDITION_PENDING" : "COMPLETED";
    default:
      return null; // CONDITION_PENDING completes only via Condition Received
  }
}

export const REGULAR_NEXT_LABEL: Record<string, string> = {
  PLACED: "প্রোডাক্ট রেডি",
  READY: "কুরিয়ার দিন",
  COURIER_GIVEN: "পরের ধাপ",
};

/** Packaging workflow: stages shown depend on work type (unnecessary stages hidden). */
export const PACKAGING_FLOWS: Record<string, string[]> = {
  CYLINDER_PACKET: [
    "PLACED",
    "ADVANCE",
    "DESIGN",
    "CYLINDER_SENT",
    "CYLINDER_READY",
    "PRODUCTION",
    "PRODUCTION_DONE",
    "MATERIAL_RECEIVED",
    "DELIVERED",
    "COMPLETED",
  ],
  PACKET: ["PLACED", "ADVANCE", "PRODUCTION", "PRODUCTION_DONE", "MATERIAL_RECEIVED", "DELIVERED", "COMPLETED"],
  ART_PAPER: ["PLACED", "ADVANCE", "PRODUCTION", "MATERIAL_RECEIVED", "DELIVERED", "COMPLETED"],
};

export function nextPackagingStage(
  o: Pick<PackagingOrder, "stage" | "workType">
): string | null {
  const flow = PACKAGING_FLOWS[o.workType] ?? PACKAGING_FLOWS.PACKET;
  const i = flow.indexOf(o.stage);
  if (i < 0 || i >= flow.length - 1) return null;
  return flow[i + 1];
}
