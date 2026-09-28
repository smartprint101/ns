"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type PickerOption = { id: string; name: string; sub?: string | null; badge?: string | null };
export type PickerValue = { id: string | null; name: string };

/**
 * Searchable comboxbox. Pick an existing row, or type a new name (allowNew).
 * Value = { id: existing row id | null, name: display text }.
 */
export function EntityPicker({
  options,
  value,
  onChange,
  placeholder,
  allowNew = true,
  autoFocus,
  disabled,
}: {
  options: PickerOption[];
  value: PickerValue;
  onChange: (v: PickerValue, option?: PickerOption) => void;
  placeholder?: string;
  allowNew?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(value.name);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setText(value.name), [value.name, value.id]);
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = text.trim().toLowerCase();
  const filtered = (q ? options.filter((o) => o.name.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q)) : options).slice(0, 30);
  const exact = options.find((o) => o.name.trim().toLowerCase() === q);
  const showNew = allowNew && q.length > 0 && !exact;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          className={cn(
            "w-full h-11 rounded-xl border bg-white px-3 pr-9 text-[15px] outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50",
            value.id ? "border-brand-300" : "border-slate-300"
          )}
          value={text}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            setOpen(true);
            const hit = options.find((o) => o.name.trim().toLowerCase() === t.trim().toLowerCase());
            onChange({ id: hit?.id ?? null, name: t }, hit);
          }}
        />
        {value.id && (
          <button
            type="button"
            aria-label="মুছুন"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            onClick={() => {
              setText("");
              onChange({ id: null, name: "" });
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>
      {open && (filtered.length > 0 || showNew) && (
        <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {showNew && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-b border-slate-100 bg-brand-50/60 px-3 py-2.5 text-left text-sm font-semibold text-brand-800 hover:bg-brand-50"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ id: null, name: text.trim() });
                setOpen(false);
              }}
            >
              <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-700 text-white text-xs font-bold">+</span>
              নতুন: «{text.trim()}»
            </button>
          )}
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50",
                value.id === o.id && "bg-brand-50"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange({ id: o.id, name: o.name }, o);
                setText(o.name);
                setOpen(false);
              }}
            >
              <span className="min-w-0">
                <span className={cn("block truncate", value.id === o.id ? "font-bold text-brand-800" : "font-medium text-slate-800")}>{o.name}</span>
                {o.sub && <span className="block truncate text-xs text-slate-500">{o.sub}</span>}
              </span>
              {o.badge && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{o.badge}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
