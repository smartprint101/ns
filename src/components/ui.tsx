"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle" | "outlineDanger";
type BtnSize = "sm" | "md" | "lg" | "xl";

const btnVariants: Record<BtnVariant, string> = {
  primary:
    "border border-brand-800/20 bg-brand-700 text-white shadow-[0_4px_12px_rgba(17,102,79,0.20)] hover:bg-brand-800 hover:shadow-[0_6px_16px_rgba(17,102,79,0.24)] active:bg-brand-900",
  secondary: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "border border-red-700/20 bg-red-600 text-white shadow-[0_4px_12px_rgba(220,38,38,0.16)] hover:bg-red-700",
  subtle: "border border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-100",
  outlineDanger: "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
};
const btnSizes: Record<BtnSize, string> = {
  sm: "h-9 px-3 text-[13px] rounded-lg",
  md: "h-11 px-4 text-sm rounded-xl",
  lg: "h-12 px-5 text-[15px] rounded-xl",
  xl: "h-14 px-5 text-base rounded-2xl",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  full?: boolean;
};

export function Button({ variant = "primary", size = "md", full, className, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition duration-200 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px select-none",
        btnVariants[variant],
        btnSizes[size],
        full && "w-full",
        className
      )}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  full,
  className,
  children,
}: {
  href: string;
  variant?: BtnVariant;
  size?: BtnSize;
  full?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition duration-200 active:translate-y-px select-none",
        btnVariants[variant],
        btnSizes[size],
        full && "w-full",
        className
      )}
    >
      {children}
    </Link>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.025)]", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-bold text-slate-800">{children}</h2>
      {right}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
export type Tone = "slate" | "green" | "amber" | "red" | "blue" | "violet" | "teal";
const badgeTones: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

export function Badge({ tone = "slate", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Form primitives ─────────────────────────────────────────────────────────
export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full h-11 rounded-xl border border-slate-300 bg-white px-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputCls, className)} {...props} />;
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows ?? 3}
        className={cn(inputCls, "h-auto py-2.5 leading-relaxed", className)}
        {...props}
      />
    );
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cn(inputCls, "appearance-none pr-9", className)} {...props}>
          {children}
        </select>
        <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
);

// ── Stat / misc ─────────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  sub,
  tone = "slate",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const toneStyles: Record<Tone, { card: string; label: string; value: string; accent: string }> = {
    slate: {
      card: "border-slate-200 bg-white hover:border-slate-300",
      label: "text-slate-500",
      value: "text-slate-900",
      accent: "bg-slate-300",
    },
    green: {
      card: "border-emerald-200/80 bg-emerald-50/70 hover:border-emerald-300",
      label: "text-emerald-800/70",
      value: "text-emerald-800",
      accent: "bg-emerald-500",
    },
    amber: {
      card: "border-amber-200/90 bg-amber-50/75 hover:border-amber-300",
      label: "text-amber-800/70",
      value: "text-amber-800",
      accent: "bg-amber-500",
    },
    red: {
      card: "border-rose-200/90 bg-rose-50/70 hover:border-rose-300",
      label: "text-rose-800/70",
      value: "text-rose-700",
      accent: "bg-rose-500",
    },
    blue: {
      card: "border-sky-200/90 bg-sky-50/75 hover:border-sky-300",
      label: "text-sky-800/70",
      value: "text-sky-800",
      accent: "bg-sky-500",
    },
    violet: {
      card: "border-violet-200/90 bg-violet-50/75 hover:border-violet-300",
      label: "text-violet-800/70",
      value: "text-violet-800",
      accent: "bg-violet-500",
    },
    teal: {
      card: "border-teal-200/90 bg-teal-50/75 hover:border-teal-300",
      label: "text-teal-800/70",
      value: "text-teal-800",
      accent: "bg-teal-500",
    },
  };
  const style = toneStyles[tone];
  const inner = (
    <Card className={cn("relative h-full overflow-hidden p-3.5 transition duration-200", style.card)}>
      <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", style.accent)} aria-hidden="true" />
      <p className={cn("pl-1 text-xs font-bold", style.label)}>{label}</p>
      <p className={cn("mt-1 pl-1 text-xl font-extrabold leading-tight tracking-tight", style.value)}>{value}</p>
      {sub && <div className="mt-1 pl-1 text-xs leading-relaxed text-slate-600">{sub}</div>}
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Empty({ text = "কিছু পাওয়া যায়নি", children }: { text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center">
      <p className="text-sm text-slate-500">{text}</p>
      {children}
    </div>
  );
}

export function RowBetween({ left, right, className }: { left: React.ReactNode; right: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0">{left}</div>
      <div className="shrink-0 text-right">{right}</div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
