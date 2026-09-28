"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { CustomerSheet, PartySheet, FactorySheet, CylinderSheet } from "./master-forms";
import { bnMoney, bn } from "@/lib/bn";

// ── Customers ────────────────────────────────────────────────────────────────
type CustomerRow = { id: string; name: string; phone: string | null; address: string | null; notes: string | null; orderCount: number; activeOrders: number };
export function CustomersClient({ rows }: { rows: CustomerRow[] }) {
  const sheet = CustomerSheet();
  return (
    <>
      <div className="mb-3">
        <Button onClick={() => sheet.openFor(null, { name: "", phone: "", address: "", notes: "" })}>+ নতুন কাস্টমার</Button>
      </div>
      {rows.length === 0 ? (
        <Empty text="কোনো কাস্টমার নেই" />
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900">{c.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.phone ?? "ফোন নেই"}
                    {c.address ? ` · ${c.address}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => sheet.openFor(c.id, { name: c.name, phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" })}>
                  এডিট
                </Button>
              </div>
              <div className="mt-2 flex gap-1.5">
                <Badge tone="slate">{bn(c.orderCount)}টি অর্ডার</Badge>
                {c.activeOrders > 0 && <Badge tone="blue">{bn(c.activeOrders)}টি চলমান</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {sheet.node}
    </>
  );
}

// ── Packaging Parties ────────────────────────────────────────────────────────
type PartyRow = { id: string; name: string; phone: string | null; address: string | null; notes: string | null; bill: number; paid: number; due: number; activeOrders: number };
export function PartiesClient({ rows }: { rows: PartyRow[] }) {
  const sheet = PartySheet();
  return (
    <>
      <div className="mb-3">
        <Button onClick={() => sheet.openFor(null, { name: "", phone: "", address: "", notes: "" })}>+ নতুন পার্টি</Button>
      </div>
      {rows.length === 0 ? (
        <Empty text="কোনো পার্টি নেই" />
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/parties/${p.id}`} className="text-sm font-extrabold text-slate-900 hover:text-brand-700">
                    {p.name} →
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.phone ?? "ফোন নেই"}
                    {p.address ? ` · ${p.address}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => sheet.openFor(p.id, { name: p.name, phone: p.phone ?? "", address: p.address ?? "", notes: p.notes ?? "" })}>
                  এডিট
                </Button>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
                <MiniSum label="মোট বিল" value={bnMoney(p.bill)} />
                <MiniSum label="জমা" value={bnMoney(p.paid)} />
                <MiniSum label="বাকি" value={bnMoney(Math.max(p.due, 0))} red={p.due > 0} green={p.due <= 0 && p.bill > 0} />
              </div>
              {p.activeOrders > 0 && (
                <div className="mt-2">
                  <Badge tone="blue">{bn(p.activeOrders)}টি অর্ডার চলমান</Badge>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {sheet.node}
    </>
  );
}

// ── Factories ────────────────────────────────────────────────────────────────
type FactoryRow = { id: string; name: string; phone: string | null; address: string | null; notes: string | null; openingDue: number; paid: number; due: number; activeOrders: number; cylinders: number };
export function FactoriesClient({ rows, role }: { rows: FactoryRow[]; role: "OWNER" | "STAFF" }) {
  const sheet = FactorySheet({ role });
  return (
    <>
      <div className="mb-3">
        <Button onClick={() => sheet.openFor(null, { name: "", phone: "", address: "", notes: "", openingDue: 0 })}>+ নতুন ফ্যাক্টরি</Button>
      </div>
      {rows.length === 0 ? (
        <Empty text="কোনো ফ্যাক্টরি নেই" />
      ) : (
        <ul className="space-y-2">
          {rows.map((f) => (
            <li key={f.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900">{f.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {f.phone ?? "ফোন নেই"}
                    {f.address ? ` · ${f.address}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => sheet.openFor(f.id, { name: f.name, phone: f.phone ?? "", address: f.address ?? "", notes: f.notes ?? "", openingDue: f.openingDue })}>
                  এডিট
                </Button>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
                <MiniSum label="আগের বাকি" value={bnMoney(f.openingDue)} />
                <MiniSum label="পেমেন্ট দেওয়া" value={bnMoney(f.paid)} green={f.paid > 0} />
                <MiniSum label={f.due >= 0 ? "পাওনা বাকি" : "অ্যাডভান্স"} value={bnMoney(Math.abs(f.due))} red={f.due > 0} green={f.due <= 0} />
              </div>
              <div className="mt-2 flex gap-1.5">
                {f.activeOrders > 0 && <Badge tone="blue">{bn(f.activeOrders)}টি কাজ চলমান</Badge>}
                <Badge tone="slate">{bn(f.cylinders)}টি সিলিন্ডার</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
      {sheet.node}
    </>
  );
}

// ── Cylinders ────────────────────────────────────────────────────────────────
type CylinderRow = { id: string; name: string; factoryId: string; factoryName: string; notes: string | null };
export function CylindersClient({ rows, factories }: { rows: CylinderRow[]; factories: { id: string; name: string }[] }) {
  const sheet = CylinderSheet({ factories });
  return (
    <>
      <div className="mb-3">
        <Button onClick={() => sheet.openFor(null, { name: "", factoryId: factories[0]?.id ?? "", notes: "" })}>+ নতুন সিলিন্ডার</Button>
      </div>
      {rows.length === 0 ? (
        <Empty text="কোনো সিলিন্ডার নেই" />
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">{c.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  ফ্যাক্টরি: <span className="font-bold">{c.factoryName}</span>
                  {c.notes ? ` · ${c.notes}` : ""}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => sheet.openFor(c.id, { name: c.name, factoryId: c.factoryId, notes: c.notes ?? "" })}>
                এডিট
              </Button>
            </li>
          ))}
        </ul>
      )}
      {sheet.node}
    </>
  );
}

function MiniSum({ label, value, red, green }: { label: string; value: string; red?: boolean; green?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 px-1.5 py-1.5 ring-1 ring-inset ring-slate-100">
      <p className="text-[10px] font-semibold text-slate-400">{label}</p>
      <p className={`truncate text-xs font-extrabold ${red ? "text-red-600" : green ? "text-emerald-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}