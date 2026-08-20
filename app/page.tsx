import { getAllTimeStandings, getLeagueSummary } from "@/lib/db";

export default function Home() {
  const standings = getAllTimeStandings();
  const summary = getLeagueSummary();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All-Time Standings</h1>
        <p className="mt-1 text-sm text-muted">
          Every regular-season and playoff record, combined across all seasons.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Seasons" value={String(summary.completedSeasons)} />
        <StatTile label="Games played" value={String(summary.totalGames)} />
        <StatTile label="Titles awarded" value={String(summary.championshipsAwarded)} />
        <StatTile
          label="Reigning champ"
          value={summary.reigningChampion?.display_name ?? "—"}
          sub={summary.reigningChampion ? `${summary.reigningChampion.team_name}, ${summary.reigningChampion.season}` : undefined}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3 text-right">Seasons</th>
              <th className="px-4 py-3 text-right">Record</th>
              <th className="px-4 py-3 text-right">Win %</th>
              <th className="px-4 py-3 text-right">Points For</th>
              <th className="px-4 py-3 text-right">Points Against</th>
              <th className="px-4 py-3 text-right">🏆</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((o, i) => {
              const games = o.wins + o.losses + o.ties;
              const winPct = games > 0 ? o.wins / games : 0;
              return (
                <tr
                  key={o.member_id}
                  className={`border-t border-border-color/60 ${i < 3 ? "bg-accent-soft/40" : ""}`}
                >
                  <td className="px-4 py-3 text-muted">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium">{o.display_name}</td>
                  <td className="px-4 py-3 text-right">{o.seasons_played}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.wins}-{o.losses}
                    {o.ties ? `-${o.ties}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(winPct * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.points_for.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.points_against.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.championships > 0 ? o.championships : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface border border-border-color p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 truncate text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}
