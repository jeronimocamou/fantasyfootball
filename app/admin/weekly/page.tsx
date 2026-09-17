import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getCurrentWeek, getWeeklyRecap } from "@/lib/queries";

export const dynamic = "force-dynamic";

const SEASON = 2026;

function money(n: number): string {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
}

export default async function WeeklyRecapPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const week = await getCurrentWeek(SEASON);
  if (!week) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-wide">Weekly Recap</h1>
        <p className="text-sm text-muted">No lines synced yet this season.</p>
      </div>
    );
  }

  const rows = await getWeeklyRecap(SEASON, week);
  const weeks = Array.from({ length: week }, (_, i) => i + 1);
  const weekTotals = weeks.map((_, wi) => rows.reduce((sum, r) => sum + r.byWeek[wi], 0));
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:text-foreground">
          ← Back to House Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-wide">Weekly Recap</h1>
        <p className="mt-1 text-sm text-muted">
          Every manager&apos;s net win/loss for each week so far — a completed week&apos;s Balance
          column on the House Dashboard, kept around after it rolls over.
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-border-color bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Manager</th>
              {weeks.map((w) => (
                <th key={w} className="px-4 py-3 text-right">
                  Wk {w}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.managerId} className="border-t border-border-color/60">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/managers/${r.managerId}`} className="hover:text-accent hover:underline">
                    {r.displayName}
                  </Link>
                </td>
                {r.byWeek.map((net, wi) => (
                  <td
                    key={wi}
                    className={`px-4 py-3 text-right tabular-nums ${
                      net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {money(net)}
                  </td>
                ))}
                <td
                  className={`px-4 py-3 text-right font-semibold tabular-nums ${
                    r.total >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {money(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-color font-semibold">
              <td className="px-4 py-3">House net</td>
              {weekTotals.map((total, wi) => (
                <td
                  key={wi}
                  className={`px-4 py-3 text-right tabular-nums ${
                    total <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {money(-total)}
                </td>
              ))}
              <td
                className={`px-4 py-3 text-right tabular-nums ${
                  grandTotal <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {money(-grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
