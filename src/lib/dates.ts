import { bn } from "./bn";

/** Server runs with TZ=Asia/Dhaka (set in env) so Date math is business-local. */

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
export function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type AgeInfo = { days: number; hours: number; label: string; fresh: boolean };

/** How long a pending item has been waiting. */
export function ageOf(from: Date | null | undefined, now = new Date()): AgeInfo {
  if (!from) return { days: 0, hours: 0, label: "", fresh: true };
  const ms = Math.max(0, now.getTime() - new Date(from).getTime());
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  let label: string;
  if (days >= 1) label = `${bn(days)} দিন ধরে`;
  else if (hours >= 1) label = `${bn(hours)} ঘণ্টা ধরে`;
  else label = `এইমাত্র`;
  return { days, hours, label, fresh: days === 0 };
}

export function daysSince(from: Date | null | undefined): number {
  return ageOf(from).days;
}

const bnDateFmt = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric" });
const bnDateShortFmt = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short", year: "numeric" });
const bnTimeFmt = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function fmtDate(d: Date | null | undefined): string {
  return d ? bnDateFmt.format(new Date(d)) : "—";
}
export function fmtDateShort(d: Date | null | undefined): string {
  return d ? bnDateShortFmt.format(new Date(d)) : "—";
}
export function fmtDateTime(d: Date | null | undefined): string {
  return d ? bnTimeFmt.format(new Date(d)) : "—";
}

/** yyyy-mm-dd for <input type="date"> */
export function toDateInputValue(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
