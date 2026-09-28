import Link from "next/link";
import { globalSearch } from "@/server/services/search";
import { PageHead } from "@/components/page-head";
import { Card, CardTitle, Empty } from "@/components/ui";
import { Icon } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await globalSearch(query) : null;
  const total = results
    ? Object.values(results).reduce((s, arr) => s + arr.length, 0)
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHead title="সার্চ" sub="কাস্টমার, পার্টি, অর্ডার, PKG, সিলিন্ডার, ফ্যাক্টরি, টাস্ক — সব খুঁজুন" />
      <form action="/search" method="get" className="relative">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="নাম / ফোন / অর্ডার নম্বর / যেকোনো কিছু…"
          autoFocus
          className="h-13 w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-12 pr-3 text-base placeholder:text-slate-400 outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
        />
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400">
          <circle cx="9" cy="9" r="6" strokeWidth="1.8" />
          <path d="m13.5 13.5 3.5 3.5" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </form>

      {!results ? (
        <Empty text="কিছু লিখে খুঁজুন" />
      ) : total === 0 ? (
        <Empty text={`«${query}» — কিছু পাওয়া যায়নি`} />
      ) : (
        <>
          {results.regularOrders.length > 0 && (
            <Group title="রেগুলার অর্ডার" icon="orders">
              {results.regularOrders.map((r) => (
                <RowLink key={r.id} href={`/orders/${r.id}`} label={r.label} sub={r.sub} />
              ))}
            </Group>
          )}
          {results.packagingOrders.length > 0 && (
            <Group title="প্যাকেজিং অর্ডার" icon="package">
              {results.packagingOrders.map((r) => (
                <RowLink key={r.id} href={`/packaging/${r.id}`} label={r.label} sub={r.sub} />
              ))}
            </Group>
          )}
          {results.customers.length > 0 && (
            <Group title="কাস্টমার" icon="users">
              {results.customers.map((c) => (
                <RowLink key={c.id} href={`/customers?q=${encodeURIComponent(c.name)}`} label={c.name} sub={c.sub} />
              ))}
            </Group>
          )}
          {results.parties.length > 0 && (
            <Group title="পার্টি" icon="parties">
              {results.parties.map((c) => (
                <RowLink key={c.id} href={`/parties/${c.id}`} label={c.name} sub={c.sub} />
              ))}
            </Group>
          )}
          {results.cylinders.length > 0 && (
            <Group title="সিলিন্ডার" icon="cylinder">
              {results.cylinders.map((c) => (
                <RowLink key={c.id} href={`/cylinders`} label={c.name} sub={`ফ্যাক্টরি: ${c.sub}`} />
              ))}
            </Group>
          )}
          {results.factories.length > 0 && (
            <Group title="ফ্যাক্টরি" icon="factory">
              {results.factories.map((f) => (
                <RowLink key={f.id} href={`/factories`} label={f.name} sub={f.sub} />
              ))}
            </Group>
          )}
          {results.tasks.length > 0 && (
            <Group title="টাস্ক" icon="tasks">
              {results.tasks.map((t) => (
                <RowLink key={t.id} href={`/tasks`} label={t.title} sub={t.sub} />
              ))}
            </Group>
          )}
        </>
      )}
    </div>
  );
}

function Group({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardTitle>
        <span className="inline-flex items-center gap-1.5">
          <Icon name={icon} className="h-4 w-4 text-slate-400" /> {title}
        </span>
      </CardTitle>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </Card>
  );
}

function RowLink({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <li>
      <Link href={href} className="block py-2.5">
        <p className="text-sm font-bold text-slate-800 hover:text-brand-700">{label}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </Link>
    </li>
  );
}
