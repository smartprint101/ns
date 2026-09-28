import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Round to 2 decimals — safe money math on JS numbers. */
export function m2(n: number | string | null | undefined): number {
  const x = Number(n ?? 0);
  if (Number.isNaN(x)) return 0;
  return Math.round(x * 100) / 100;
}
