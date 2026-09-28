import { requireUser } from "@/server/auth";
import { listActiveUsers } from "@/server/services/users";
import { PageHead } from "@/components/page-head";
import { Card, CardTitle, LinkButton, Badge } from "@/components/ui";
import { ChangePasswordForm } from "@/components/forms/team-forms";
import { IdentityChangeButton } from "@/components/forms/identity-picker";
import { logoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const teamUsers = await listActiveUsers();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHead title="সেটিংস" sub={user.name} />
      <Card>
        <CardTitle>👤 আপনি কে</CardTitle>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">
          এই ডিভাইসে প্রবেশ করা আছে: <b className="text-slate-900">{user.name}</b> — অন্য কেউ এই ডিভাইস ব্যবহার করলে নাম বদলে নিন।
        </p>
        <IdentityChangeButton users={teamUsers} currentName={user.name} />
      </Card>
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

      <Card className="border-brand-200 bg-brand-50/40">
        <CardTitle>📲 ফোন বা কম্পিউটারে অ্যাপ ইনস্টল</CardTitle>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">
          এটি একটি PWA—Play Store থেকে আলাদা ফাইল ডাউনলোড করতে হবে না। যে ডিভাইসে ব্যবহার করবেন, সেখানে অ্যাপের লাইভ লিংক খুলুন।
        </p>
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">
          <p><b className="text-slate-900">Android (Chrome):</b> উপরের ⋮ মেনু → <b>Install app</b> অথবা <b>Add to Home screen</b> → Install।</p>
          <p><b className="text-slate-900">iPhone (Safari):</b> নিচের Share (□↑) → <b>Add to Home Screen</b> → Add।</p>
          <p><b className="text-slate-900">কম্পিউটার (Chrome/Edge):</b> address bar-এর Install আইকন → Install।</p>
        </div>
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
          ইনস্টল হয়ে গেলে হোম স্ক্রিনের “এনএস” আইকন থেকে সরাসরি অ্যাপের মতো খুলবে। এরপর নোটিফিকেশন পেজে গিয়ে “এই ডিভাইসে নোটিফিকেশন চালু করুন” চাপুন।
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
