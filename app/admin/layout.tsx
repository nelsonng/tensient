import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { AdminNav } from "./admin-nav";

export const metadata = {
  title: "TENSIENT // CONTROL CENTER",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen flex">
      <AdminNav />
      <main className="flex-1 ml-56 p-8">{children}</main>
    </div>
  );
}
