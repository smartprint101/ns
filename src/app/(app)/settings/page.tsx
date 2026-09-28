import { requireUser } from "@/server/auth";
import { PageHead } from "@/components/page-head";
import { Card, CardTitle, LinkButton, Badge } from "@/components/ui";
import { ChangePasswordForm } from "@/components/forms/team-forms";
import { logoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHead title="সেটিংস" sub={user.name} />
      <Card>
        <CardTitle>
          আপনার অ্যাকাউন্ট{" "}
          <Badge tone={user.role === "OWNER" ? "teal" : "slate"}>{user.role === "OWNER" ? "Owner/Admin" : "স্টাফ"}</Badge>
        </CardTitle>
        <ChangePasswordForm />
      </Card>

      <Card>
        <CardTitle>সিস্টেম</CardTitle>
        <div className="flex flex-wrap gap-2">
          {user.role === "OWNER" && (
            <>
              <LinkButton href="/team" variant="secondary" size="md">👥 টিম ম্যানেজমেন্ট</LinkButton>
              <LinkButton href="/accounts" variant="secondary" size="md">🏦 অ্যাকাউন্ট/অ্যাজাস্টমেন্ট</LinkButton>
            </>
          )}
          <LinkButton href="/reports" variant="secondary" size="md">📊 রিপোর্ট</LinkButton>
        </div>
      </Card>

      <Card>
        <CardTitle>মোবাইল অ্যাপ (PWA)</CardTitle>
        <p className="text-sm leading-relaxed text-slate-600">
          ফোনের ব্রাউজারে সাইট খুলে <b>Add to Home Screen</b> করুন — অ্যাপের মতো ফুল-স্ক্রিনে চলবে।
        </p>
      </Card>

      <form action={logoutAction}>
        <button type="submit" className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-700 ring-1 ring-inset ring-red-100 transition hover:bg-red-100">
          লগ আউট
        </button>
      </form>
    </div>
  );
}
