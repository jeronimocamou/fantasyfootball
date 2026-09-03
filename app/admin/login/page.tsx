import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");

  return (
    <div className="flex flex-col gap-6 pt-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">House Access</h1>
        <p className="mt-1 text-sm text-muted">Enter the admin PIN to continue.</p>
      </div>
      <AdminLoginForm />
    </div>
  );
}
