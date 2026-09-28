import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { PageHead } from "@/components/page-head";
import { Badge, Card, Empty } from "@/components/ui";
import { MarkReadButton } from "@/components/forms/notification-client";
import { fmtDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(60);
  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHead
        title="নোটিফিকেশন"
        sub={unread > 0 ? `${unread.toLocaleString("bn-BD")}টি নতুন` : "সব পড়া হয়েছে"}
        right={unread > 0 ? <MarkReadButton /> : undefined}
      />
      {rows.length === 0 ? (
        <Empty text="কোনো নোটিফিকেশন নেই" />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map((n) => {
              const inner = (
                <div className={`flex items-start gap-3 px-4 py-3 ${!n.readAt ? "bg-brand-50/40" : ""}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? "bg-brand-600" : "bg-slate-200"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!n.readAt ? "font-bold text-slate-900" : "font-medium text-slate-600"}`}>{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(n.createdAt)}</p>
                  </div>
                  {!n.readAt && <Badge tone="teal">নতুন</Badge>}
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link}>{inner}</Link> : inner}</li>;
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
