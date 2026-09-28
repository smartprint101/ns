// All enum → Bengali label maps + workflow stage flows (single place to edit).
import type {
  RegularOrder,
  PackagingOrder,
} from "@/server/db/schema";

export const REGULAR_STAGE_BN: Record<string, string> = {
  PLACED: "খাতায় লেখা হয়েছে",
  READY: "স্লিপ তৈরি করা হয়েছে",
  COURIER_GIVEN: "কুরিয়ারে পাঠানো হয়েছে",
  CONDITION_PENDING: "কুরিয়ার কন্ডিশন বকেয়া",
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
  ART_PAPER: "অফসেট প্রিন্টিং",
};

/** সাধারণ (fallback) ধাপের নাম — কাজের ধরন অনুযায়ী আলাদা নাম নিচের packagingStageLabel এ। */
export const PACKAGING_STAGE_BN: Record<string, string> = {
  PLACED: "এন্ট্রি হয়েছে",
  ADVANCE: "অ্যাডভান্স নেওয়া হয়েছে",
  DESIGN: "ডিজাইন প্রসেস চলছে",
  CYLINDER_SENT: "সিলিন্ডার তৈরি করতে পাঠানো হয়েছে",
  CYLINDER_READY: "সিলিন্ডার এসেছে",
  PRODUCTION: "কারখানায় অর্ডার পাঠানো হয়েছে",
  PRODUCTION_DONE: "প্রোডাকশন সম্পন্ন",
  MATERIAL_RECEIVED: "মাল রিসিভ করা হয়েছে",
  DELIVERED: "কুরিয়ারে পাঠানো হয়েছে",
  COMPLETED: "সম্পন্ন",
};

/** কাজের ধরন অনুযায়ী ধাপের নাম (যেমন অফসেট প্রিন্টিং-এ «ডিজাইন ওকে হয়েছে»)। */
const PACKAGING_STAGE_OVERRIDES: Record<string, Record<string, string>> = {
  ART_PAPER: {
    DESIGN: "ডিজাইন ওকে হয়েছে",
    PRODUCTION: "কারখানায় পাঠানো হয়েছে",
  },
  PACKET: {
    PRODUCTION: "কারখানায় কাজ পাঠানো হয়েছে",
  },
};

export function packagingStageLabel(workType: string, stage: string): string {
  return PACKAGING_STAGE_OVERRIDES[workType]?.[stage] ?? PACKAGING_STAGE_BN[stage] ?? stage;
}

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
  MANUAL: "সাধারণ কালেকশন",
  CONDITION: "কুরিয়ার কন্ডিশন",
  COURIER_COLLECTION: "কুরিয়ার কালেকশন",
};

/** কালেকশন হিসাবের ধরন — কোন টাকা কোথা থেকে এলো। */
export function collectionKindLabel(p: { source: string; partyId?: string | null; customerId?: string | null }): string {
  if (p.source === "COURIER_COLLECTION") return "কুরিয়ার কালেকশন";
  if (p.source === "CONDITION") return "কুরিয়ার কন্ডিশন";
  if (p.partyId) return "পার্টি কালেকশন";
  if (p.customerId) return "কাস্টমার কালেকশন";
  return "সাধারণ কালেকশন";
}

/**
 * রেগুলার অর্ডারের ধাপ:
 * খাতায় লেখা হয়েছে → স্লিপ তৈরি করা হয়েছে → কুরিয়ারে পাঠানো হয়েছে →
 *   কন্ডিশন থাকলে: কুরিয়ার কন্ডিশন বকেয়া (বকেয়া পেজে)
 *   বকেয়া থাকলে: বকেয়া (বকেয়া পেজে) · পুরো টাকা পেলে হিস্ট্রিতে
 */
export function nextRegularStage(o: Pick<RegularOrder, "stage" | "hasCondition">): string | null {
  switch (o.stage) {
    case "PLACED":
      return "READY";
    case "READY":
      return o.hasCondition ? "CONDITION_PENDING" : "COURIER_GIVEN";
    default:
      return null; // COURIER_GIVEN → পেমেন্ট এলে অটো সম্পন্ন; CONDITION_PENDING → কন্ডিশন রিসিভে সম্পন্ন
  }
}

export const REGULAR_NEXT_LABEL: Record<string, string> = {
  PLACED: "✓ স্লিপ তৈরি হয়েছে",
  READY: "🚚 কুরিয়ারে পাঠানো হলো",
};

/** Packaging workflow: stages shown depend on work type (unnecessary stages hidden). */
export const PACKAGING_FLOWS: Record<string, string[]> = {
  CYLINDER_PACKET: ["PLACED", "DESIGN", "CYLINDER_SENT", "CYLINDER_READY", "PRODUCTION", "DELIVERED", "COMPLETED"],
  PACKET: ["PLACED", "PRODUCTION", "DELIVERED", "COMPLETED"],
  ART_PAPER: ["PLACED", "DESIGN", "PRODUCTION", "DELIVERED", "COMPLETED"],
};

export function nextPackagingStage(
  o: Pick<PackagingOrder, "stage" | "workType">
): string | null {
  const flow = PACKAGING_FLOWS[o.workType] ?? PACKAGING_FLOWS.PACKET;
  const i = flow.indexOf(o.stage);
  if (i < 0) {
    // পুরোনো ডেটার ধাপ নতুন ফ্লোতে নেই — কাছের ধাপে ম্যাপ করি
    const legacyMap: Record<string, string> = {
      ADVANCE: "PLACED",
      PRODUCTION_DONE: "PRODUCTION",
      MATERIAL_RECEIVED: "PRODUCTION",
    };
    const mapped = legacyMap[o.stage];
    if (!mapped) return null;
    const j = flow.indexOf(mapped);
    return j >= 0 && j < flow.length - 1 ? flow[j + 1] : null;
  }
  if (i >= flow.length - 1) return null;
  return flow[i + 1];
}
