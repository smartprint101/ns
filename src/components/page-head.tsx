import Link from "next/link";
import { cn } from "@/lib/utils";
import { bn } from "@/lib/bn";

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Tabs({
  tabs,
  current,
}: {
  tabs: { key: string; label: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-200/60 p-1 no-scrollbar">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`?tab=${t.key}`}
          className={cn(
            "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-[13px] font-bold transition",
            current === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1 text-xs text-slate-400">({bn(t.count)})</span>}
        </Link>
      ))}
    </div>
  );
}

/** Compact GET search box (server-rendered, submits ?q=). */
export function SearchBox({ placeholder, defaultValue, hidden }: { placeholder: string; defaultValue?: string; hidden?: Record<string, string> }) {
  return (
    <form action="" method="get" className="relative mb-3">
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full h-11 rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-[15px] placeholder:text-slate-400 outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
      />
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
        <circle cx="9" cy="9" r="6" strokeWidth="1.8" />
        <path d="m13.5 13.5 3.5 3.5" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </form>
  );
}
