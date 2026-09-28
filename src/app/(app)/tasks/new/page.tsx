import { listActiveUsers } from "@/server/services/users";
import { TaskForm } from "@/components/forms/task-forms";
import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const users = await listActiveUsers();
  return (
    <div className="mx-auto max-w-lg">
      <PageHead title="নতুন টাস্ক" sub="টিমের যে কাউকে কাজ দিন" />
      <Card className="p-4 sm:p-5">
        <TaskForm users={users} />
      </Card>
    </div>
  );
}
