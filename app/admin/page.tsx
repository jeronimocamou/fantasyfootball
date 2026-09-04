import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import {
  getCurrentWeek,
  getAllManagerWeekSummaries,
  getAllBetsForWeek,
  getAllParlaysForWeek,
  getAllFuturesBets,
} from "@/lib/queries";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

const SEASON = 2026;

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const week = await getCurrentWeek(SEASON);
  if (!week) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">House Dashboard</h1>
        <p className="text-sm text-muted">No lines synced yet this season.</p>
      </div>
    );
  }

  const [managers, bets, parlays, futures] = await Promise.all([
    getAllManagerWeekSummaries(SEASON, week),
    getAllBetsForWeek(SEASON, week),
    getAllParlaysForWeek(SEASON, week),
    getAllFuturesBets(SEASON),
  ]);

  return (
    <AdminDashboard
      season={SEASON}
      week={week}
      managers={managers}
      bets={bets}
      parlays={parlays}
      futures={futures}
    />
  );
}
