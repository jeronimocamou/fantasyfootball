import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import {
  getCurrentWeek,
  getAllManagerWeekSummaries,
  getAllBetsForWeek,
  getAllParlaysForWeek,
  getAllFuturesBets,
  getSyncStatus,
} from "@/lib/queries";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

const SEASON = 2026;
const STALE_SYNC_HOURS = 36;

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const [week, syncStatus] = await Promise.all([getCurrentWeek(SEASON), getSyncStatus()]);

  const hoursSinceSuccess = syncStatus?.hoursSinceSuccess ?? null;
  const syncWarning =
    hoursSinceSuccess == null
      ? "The ESPN sync has never completed successfully — lines and results won't update."
      : hoursSinceSuccess > STALE_SYNC_HOURS
        ? `The last successful sync was ${Math.floor(hoursSinceSuccess)}h ago — lines and results may be stale.`
        : syncStatus?.lastError
          ? `The most recent sync attempt failed: ${syncStatus.lastError}`
          : null;

  if (!week) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-wide">House Dashboard</h1>
        {syncWarning && (
          <p className="rounded border border-red-600/40 bg-red-600/10 p-3 text-sm text-red-700 dark:text-red-400">
            {syncWarning}
          </p>
        )}
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
      syncWarning={syncWarning}
    />
  );
}
