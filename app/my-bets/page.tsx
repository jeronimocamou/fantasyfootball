import { getManagerBets, getManagers } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";

const STATUS_STYLE: Record<string, string> = {
  pending: "text-muted",
  won: "text-emerald-600 dark:text-emerald-400",
  lost: "text-red-600 dark:text-red-400",
  push: "text-muted",
};

export default async function MyBetsPage() {
  const managerId = await getCurrentManagerId();

  if (!managerId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">My Bets</h1>
        <p className="text-sm text-muted">Pick your name in the top right to see your bets.</p>
      </div>
    );
  }

  const [bets, managers] = await Promise.all([getManagerBets(managerId), getManagers()]);
  const me = managers.find((m) => m.id === managerId);

  const settled = bets.filter((b) => b.status !== "pending");
  const net = settled.reduce((sum, b) => {
    if (b.status === "won") return sum + (Number(b.payout) - Number(b.amount));
    if (b.status === "lost") return sum - Number(b.amount);
    return sum;
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Bets{me ? ` — ${me.display_name}` : ""}</h1>
        <div className="text-right text-sm">
          <div className="text-xs uppercase tracking-wide text-muted">Net (settled)</div>
          <div className={`text-lg font-bold ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {net >= 0 ? "+" : ""}
            {net.toFixed(2)}
          </div>
        </div>
      </div>

      {bets.length === 0 ? (
        <p className="text-sm text-muted">No bets placed yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Week</th>
                <th className="px-4 py-3">Bet</th>
                <th className="px-4 py-3">Vs</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Status</th>
                <th className="px-4 py-3 text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b) => (
                <tr key={b.id} className="border-t border-border-color/60">
                  <td className="px-4 py-3 text-muted">Wk {b.week}</td>
                  <td className="px-4 py-3 font-medium">{b.side_name}</td>
                  <td className="px-4 py-3 text-muted">{b.opponent_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">${Number(b.amount).toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right capitalize ${STATUS_STYLE[b.status]}`}>{b.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {b.payout != null ? `$${Number(b.payout).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
