import { requireUser } from "@/server/auth";
import { listUsers } from "@/server/services/users";
import { PageHead } from "@/components/page-head";
import { Badge, Card, Empty } from "@/components/ui";
import { TeamClient } from "@/components/forms/team-client";
import { UserRowActions } from "@/components/forms/team-forms";
import { fmtDateShort } from "@/lib/dates";
import { bn } from "@/lib/bn";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireUser();
  const users = await listUsers();

  if (me.role !== "OWNER") {
    return (
      <div>
        <PageHead title="টিম" />
        <Empty text="এই পেজ শুধু Owner/Admin দেখতে পারবেন" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHead title="টিম ম্যানেজমেন্ট" sub={`${bn(users.length)} জন ইউজার`} right={<TeamClient />} />
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id}>
            <Card className="flex items-center justify-between gap-3 p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">{u.name.slice(0, 1)}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900">
                    {u.name} {u.id === me.id && <span className="text-xs font-semibold text-slate-400">(আপনি)</span>}
                  </p>
                  <div className="mt-0.5 flex gap-1.5">
                    <Badge tone={u.role === "OWNER" ? "teal" : "slate"}>{u.role === "OWNER" ? "Owner/Admin" : "স্টাফ"}</Badge>
                    {!u.active && <Badge tone="red">Inactive</Badge>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">যোগ হয়েছে: {fmtDateShort(u.createdAt)}</p>
                </div>
              </div>
              {u.id !== me.id && <UserRowActions userId={u.id} name={u.name} active={u.active} />}
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400">
        Owner নতুন ইউজার যোগ, deactivate ও পাসওয়ার্ড রিসেট করতে পারবেন। পাসওয়ার্ড সবসময় হ্যাশ করে সংরক্ষণ করা হয় — কেউ পড়তে পারে না।
      </p>
    </div>
  );
}
