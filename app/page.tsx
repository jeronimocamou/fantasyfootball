import { getAllTimeStandings } from "@/lib/db";

export default function Home() {
  const standings = getAllTimeStandings();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All-Time Standings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every regular-season and playoff record, combined across all seasons.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-white/5">
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
                  className="border-t border-black/5 dark:border-white/5"
                >
                  <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
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
