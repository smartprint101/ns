import { requireUserWithIdentity } from "@/server/auth";
import { getDb } from "@/server/db";
import { unreadCount } from "@/server/services/shared";
import { listActiveUsers } from "@/server/services/users";
import { AppShell, type NavGroup, type NavLink } from "@/components/app-shell";
import { IdentityGate } from "@/components/forms/identity-picker";

export const dynamic = "force-dynamic";

const groups: NavGroup[] = [
  { links: [{ href: "/", label: "ড্যাশবোর্ড", icon: "home" }] },
  {
    title: "অর্ডার",
    links: [
      { href: "/orders", label: "পেন্ডিং রেগুলার অর্ডার", icon: "orders" },
      { href: "/dues", label: "কাস্টমারের বকেয়া", icon: "money" },
      { href: "/customers", label: "কাস্টমার", icon: "users" },
    ],
  },
  {
    title: "প্যাকেজিং",
    links: [
      { href: "/packaging", label: "পেন্ডিং প্যাকেজিং অর্ডার", icon: "package" },
      { href: "/parties", label: "পার্টি", icon: "parties" },
      { href: "/factories", label: "ফ্যাক্টরি", icon: "factory" },
      { href: "/cylinders", label: "সিলিন্ডার", icon: "cylinder" },
    ],
  },
  {
    title: "হিসাব",
    links: [
      { href: "/collections", label: "কালেকশন", icon: "collection" },
      { href: "/creditors", label: "পাওনাদার", icon: "money" },
      { href: "/expenses", label: "খরচ", icon: "expense" },
      { href: "/accounts", label: "ক্যাশ/ব্যাংক", icon: "accounts" },
    ],
  },
  {
    title: "অন্যান্য",
    links: [
      { href: "/tasks", label: "টাস্ক", icon: "tasks" },
      { href: "/reports", label: "রিপোর্ট", icon: "report" },
      { href: "/team", label: "টিম", icon: "users" },
      { href: "/settings", label: "সেটিংস", icon: "settings" },
    ],
  },
];

const bottomNav: NavLink[] = [
  { href: "/", label: "ড্যাশবোর্ড", icon: "home" },
  { href: "/orders", label: "অর্ডার", icon: "orders" },
  { href: "/tasks", label: "টাস্ক", icon: "tasks" },
  { href: "/accounts", label: "হিসাব", icon: "accounts" },
];

const moreGroups: NavGroup[] = [
  {
    links: [
      { href: "/packaging", label: "প্যাকেজিং", icon: "package" },
      { href: "/dues", label: "বকেয়া", icon: "money" },
      { href: "/collections", label: "কালেকশন", icon: "collection" },
      { href: "/creditors", label: "পাওনাদার", icon: "money" },
      { href: "/expenses", label: "খরচ", icon: "expense" },
      { href: "/parties", label: "পার্টি", icon: "parties" },
      { href: "/customers", label: "কাস্টমার", icon: "users" },
      { href: "/factories", label: "ফ্যাক্টরি", icon: "factory" },
      { href: "/cylinders", label: "সিলিন্ডার", icon: "cylinder" },
      { href: "/reports", label: "রিপোর্ট", icon: "report" },
      { href: "/team", label: "টিম", icon: "users" },
      { href: "/settings", label: "সেটিংস", icon: "settings" },
      { href: "/notifications", label: "নোটিফিকেশন", icon: "bell" },
    ],
  },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, identified } = await requireUserWithIdentity();
  const db = await getDb();
  const count = await unreadCount(db, user.id);
  const teamUsers = identified ? null : await listActiveUsers();
  return (
    <AppShell user={user} unreadCount={count} groups={groups} bottomNav={bottomNav} moreGroups={moreGroups}>
      {children}
      {teamUsers && <IdentityGate users={teamUsers} />}
    </AppShell>
  );
}
