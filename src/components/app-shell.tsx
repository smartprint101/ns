"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";
import { Sheet } from "./sheet";
import { Badge, Spinner } from "./ui";

export type NavLink = { href: string; label: string; icon: string };
export type NavGroup = { title?: string; links: NavLink[] };

export function AppShell({
  user,
  unreadCount,
  groups,
  bottomNav,
  moreGroups,
  children,
}: {
  user: { name: string; role: "OWNER" | "STAFF" };
  unreadCount: number;
  groups: NavGroup[];
  bottomNav: NavLink[];
  moreGroups: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [userOpen, setUserOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
          <Image src="/icons/icon-192.png" alt="এনএস" width={36} height={36} className="rounded-lg" />
          <div>
            <p className="text-[15px] font-extrabold leading-tight text-slate-900">এনএস ট্রেডার্স</p>
            <p className="text-[11px] text-slate-500">ব্যবসা ব্যবস্থাপনা</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {groups.map((g, i) => (
            <div key={i} className="mb-4">
              {g.title && <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.title}</p>}
              <ul className="space-y-0.5">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                        isActive(l.href) ? "bg-brand-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Icon name={l.icon} className="h-[18px] w-[18px]" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
              {user.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{user.name}</p>
              <p className="text-[11px] text-slate-500">{user.role === "OWNER" ? "Owner/Admin" : "স্টাফ"}</p>
            </div>
            <button
              aria-label="লগ আউট"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                await logoutAction();
              }}
              className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600"
            >
              {loggingOut ? <Spinner /> : <Icon name="logout" className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Top bar (mobile + desktop) ── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <Image src="/icons/icon-192.png" alt="এনএস" width={30} height={30} className="rounded-lg" />
            <span className="text-[15px] font-extrabold text-slate-900">এনএস ট্রেডার্স</span>
          </Link>
          <div className="hidden flex-1 lg:block" />
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/search"
              aria-label="সার্চ"
              className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
            >
              <Icon name="search" className="h-5 w-5" />
            </Link>
            <Link
              href="/notifications"
              aria-label="নোটিফিকেশন"
              className="relative grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
            >
              <Icon name="bell" className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "৯+" : unreadCount.toLocaleString("bn-BD")}
                </span>
              )}
            </Link>
            <button
              onClick={() => setUserOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-xl hover:bg-slate-100 lg:hidden"
              aria-label="অ্যাকাউন্ট"
            >
              <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
                {user.name.slice(0, 1)}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 lg:px-6 lg:pb-10">{children}</main>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white lg:hidden safe-bottom">
        <div className="grid grid-cols-5">
          {bottomNav.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition",
                isActive(l.href) ? "text-brand-700" : "text-slate-500"
              )}
            >
              <Icon name={l.icon} className="h-5 w-5" />
              {l.label}
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", moreOpen ? "text-brand-700" : "text-slate-500")}
          >
            <Icon name="menu" className="h-5 w-5" />
            আরও
          </button>
        </div>
      </nav>

      {/* More sheet (mobile) */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="সব মেনু" wide>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {moreGroups.flatMap((g) => g.links).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold",
                isActive(l.href) ? "border-brand-300 bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <Icon name={l.icon} className="h-[18px] w-[18px] text-slate-400" />
              {l.label}
            </Link>
          ))}
        </div>
      </Sheet>

      {/* User sheet (mobile) */}
      <Sheet open={userOpen} onClose={() => setUserOpen(false)} title="অ্যাকাউন্ট">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-700 text-lg font-bold text-white">
            {user.name.slice(0, 1)}
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">{user.name}</p>
            <Badge tone={user.role === "OWNER" ? "teal" : "slate"}>{user.role === "OWNER" ? "Owner/Admin" : "স্টাফ"}</Badge>
          </div>
        </div>
        <button
          disabled={loggingOut}
          onClick={async () => {
            setLoggingOut(true);
            await logoutAction();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-700"
        >
          {loggingOut ? <Spinner /> : <Icon name="logout" className="h-4 w-4" />} লগ আউট
        </button>
      </Sheet>
    </div>
  );
}

// ── Minimal inline icon set ────────────────────────────────────────────────
export function Icon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <path d="M10 2 3 7.5V17a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V7.5L10 2z" />,
    orders: (
      <>
        <path d="M4 3h12a1 1 0 0 1 1 1v13.5l-2.5-1.5-2.5 1.5-2-1.2-2 1.2-2.5-1.5L3 17.5V4a1 1 0 0 1 1-1z" opacity=".35" />
        <path d="M6.5 7h7M6.5 10.5h7M6.5 14h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </>
    ),
    package: (
      <>
        <path d="M10 2 3 5.8v8.4L10 18l7-3.8V5.8L10 2z" opacity=".35" />
        <path d="M3.4 6 10 9.6 16.6 6M10 9.6V18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      </>
    ),
    tasks: (
      <>
        <rect x="3" y="3" width="14" height="14" rx="3" opacity=".3" />
        <path d="m7 10 2.2 2.2L13.5 8" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    accounts: (
      <>
        <rect x="2.5" y="5" width="15" height="11" rx="2.5" opacity=".3" />
        <path d="M2.5 8.5h15M6 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </>
    ),
    menu: <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />,
    search: (
      <>
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    bell: (
      <>
        <path d="M10 3a5 5 0 0 0-5 5v2.4c0 .5-.2 1-.6 1.4L3.3 13a.8.8 0 0 0 .6 1.4h12.2a.8.8 0 0 0 .6-1.4l-1.1-1.2a2 2 0 0 1-.6-1.4V8a5 5 0 0 0-5-5z" opacity=".35" />
        <path d="M8 16.5a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </>
    ),
    logout: <path d="M10 3H5.5A1.5 1.5 0 0 0 4 4.5v11A1.5 1.5 0 0 0 5.5 17H10m2-4 4-3-4-3m4 3H8" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    money: (
      <>
        <rect x="2" y="5" width="16" height="11" rx="2" opacity=".3" />
        <circle cx="10" cy="10.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.3 8.2v.01M14.7 12.8v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    expense: (
      <>
        <path d="M4 4h12v12.5L13.5 15 11 17.5 8.5 15 6 17.5 4 15.5V4z" opacity=".3" />
        <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
    collection: (
      <>
        <path d="M10 3v8m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 12v3.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V12" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      </>
    ),
    users: (
      <>
        <circle cx="8" cy="7" r="3" opacity=".4" />
        <path d="M3.5 16.5c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="14" cy="6" r="2.2" opacity=".3" />
      </>
    ),
    factory: (
      <>
        <path d="M3 17V8l5 3V8l5 3V5.5A1.5 1.5 0 0 1 14.5 4h1A1.5 1.5 0 0 1 17 5.5V17H3z" opacity=".4" />
        <path d="M3 17h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
    cylinder: (
      <>
        <ellipse cx="10" cy="5" rx="6" ry="2.2" opacity=".4" />
        <path d="M4 5v9.5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5V5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 9.5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".6" />
      </>
    ),
    parties: (
      <>
        <rect x="3" y="6" width="14" height="11" rx="2" opacity=".3" />
        <path d="M7 6V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 5v1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 11h14" stroke="currentColor" strokeWidth="1.4" opacity=".7" />
      </>
    ),
    report: (
      <>
        <rect x="3" y="3" width="14" height="15" rx="2.5" opacity=".25" />
        <path d="M6.5 14.5v-3M10 14.5V7M13.5 14.5v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    settings: (
      <>
        <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
    plus: <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />,
    truck: (
      <>
        <path d="M2.5 5.5h9v8h-9z" opacity=".35" />
        <path d="M11.5 8h3l2 2.5v3h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="6" cy="14.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="14.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      {paths[name] ?? <circle cx="10" cy="10" r="7" opacity=".3" />}
    </svg>
  );
}
