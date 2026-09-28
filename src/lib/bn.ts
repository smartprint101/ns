// Bengali number + money formatting helpers.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function bn(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** 1234567.5 → "12,34,567.50" (lakh/crore grouping) */
export function formatMoneyPlain(n: number, opts?: { keepPaisa?: boolean }): string {
  const keep = opts?.keepPaisa ?? !Number.isInteger(Math.round(n * 100) / 100);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: keep ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** ৳12,34,567 — Bengali digits with ৳ prefix. */
export function bnMoney(n: number | null | undefined, opts?: { keepPaisa?: boolean }): string {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  return "৳" + bn(formatMoneyPlain(v, opts));
}

/** Plain latin-digit money (for inputs/sums inside code). */
export function money(n: number | null | undefined): string {
  return formatMoneyPlain(Math.round(Number(n ?? 0) * 100) / 100);
}
