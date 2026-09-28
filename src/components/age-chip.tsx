import { ageOf } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Shows how long something is pending: "১৫ দিন ধরে" — redder as it grows older. */
export function AgeChip({ from, prefix = "চলছে" }: { from: Date | null | undefined; prefix?: string }) {
  const age = ageOf(from);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        age.days >= 7
          ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
          : age.days >= 3
            ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
            : "bg-slate-100 text-slate-600"
      )}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
      </svg>
      {age.label} {prefix}
    </span>
  );
}
