import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getCurrentWeek, getAllManagerWeekSummaries } from "@/lib/queries";
import WeekPicker from "@/components/admin/WeekPicker";

export const dynamic = "force-dynamic";

const SEASON = 2026;

function money(n: number): string {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
}

export default async function WeeklyRecapPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const currentWeek = await getCurrentWeek(SEASON);
  if (!currentWeek) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-wide">Weekly Recap</h1>
        <p className="text-sm text-muted">No lines synced yet this season.</p>
      </div>
    );
  }

  const { week: weekParam } = await searchParams;
  const requested = Number(weekParam);
  const selectedWeek =
    Number.isInteger(requested) && requested >= 1 && requested <= currentWeek ? requested : currentWeek;

  const weeks = Array.from({ length: currentWeek }, (_, i) => i + 1);
  const managers = await getAllManagerWeekSummaries(SEASON, selectedWeek);
  const total = managers.reduce((sum, m) => sum + m.balance, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:text-foreground">
          ← Back to House Dashboard
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Weekly Recap</h1>
            <p className="mt-1 text-sm text-muted">
              Each manager&apos;s net win/loss for the selected week — a completed week&apos;s
              Balance column on the House Dashboard, kept around after it rolls over.
            </p>
          </div>
          <WeekPicker weeks={weeks} selected={selectedWeek} />
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-border-color bg-surface">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3 text-right">Week {selectedWeek} Net</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((m) => (
              <tr key={m.manager_id} className="border-t border-border-color/60">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/managers/${m.manager_id}`} className="hover:text-accent hover:underline">
                    {m.display_name}
                  </Link>
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    m.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {money(m.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-color font-semibold">
              <td className="px-4 py-3">House net</td>
              <td
                className={`px-4 py-3 text-right tabular-nums ${
                  total <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {money(-total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
