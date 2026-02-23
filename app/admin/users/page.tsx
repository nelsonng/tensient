import { getUsersData } from "@/lib/admin/get-users-data";
import { UsersClient } from "./users-client";

export type { UserRow } from "@/lib/admin/get-users-data";

export default async function UsersPage() {
  const usersData = await getUsersData();

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground">
          Users
        </h1>
        <p className="font-mono text-xs text-muted mt-1">
          {usersData.length} total users -- full CRUD management
        </p>
      </div>

      <UsersClient users={JSON.parse(JSON.stringify(usersData))} />
    </div>
  );
}
