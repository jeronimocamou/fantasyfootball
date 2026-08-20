import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSeasons,
  getTeamsForSeason,
  getMatchupsForSeason,
} from "@/lib/db";

export function generateStaticParams() {
  return getSeasons().map((s) => ({ year: String(s) }));
}

export default async function SeasonPage(props: PageProps<"/season/[year]">) {
  const { year } = await props.params;
  const season = Number(year);
  const seasons = getSeasons();
  if (!seasons.includes(season)) notFound();

  const teams = getTeamsForSeason(season);
  const matchups = getMatchupsForSeason(season);

  const teamName = new Map(teams.map((t) => [t.team_id, t.name]));
  const weeks = Array.from(new Set(matchups.map((m) => m.week))).sort(
    (a, b) => a - b
  );

  const hasStandings = teams.some((t) => t.wins + t.losses + t.ties > 0);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{season} Season</h1>
        {!hasStandings && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            Preseason — draft hasn&apos;t happened yet, no games played.
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Standings</h2>
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Manager</th>
                <th className="px-4 py-3 text-right">Record</th>
                <th className="px-4 py-3 text-right">Points For</th>
                <th className="px-4 py-3 text-right">Points Against</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr key={t.team_id} className="border-t border-border-color/60">
                  <td className="px-4 py-3 text-muted">
                    {t.final_rank || i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-muted">
                    {t.display_name}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.wins}-{t.losses}
                    {t.ties ? `-${t.ties}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.points_for?.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.points_against?.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {weeks.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Matchups by Week</h2>
          <div className="flex flex-col gap-6">
            {weeks.map((week) => (
              <div key={week}>
                <h3 className="mb-2 text-sm font-semibold text-muted">
                  Week {week}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {matchups
                    .filter((m) => m.week === week)
                    .map((m) => {
                      const homeWin = m.home_score > m.away_score;
                      const awayWin = m.away_score > m.home_score;
                      return (
                        <div
                          key={m.matchup_id}
                          className="flex items-center justify-between rounded-lg border border-border-color px-4 py-2 text-sm"
                        >
                          <span className={homeWin ? "font-semibold" : "text-muted"}>
                            {teamName.get(m.home_team_id) ?? m.home_team_id}
                          </span>
                          <span className="tabular-nums">
                            <span className={homeWin ? "font-semibold" : ""}>
                              {m.home_score.toFixed(1)}
                            </span>
                            {" – "}
                            <span className={awayWin ? "font-semibold" : ""}>
                              {m.away_score.toFixed(1)}
                            </span>
                          </span>
                          <span className={awayWin ? "font-semibold" : "text-muted"}>
                            {teamName.get(m.away_team_id) ?? m.away_team_id}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Link
        href={`/draft/${season}`}
        className="text-sm font-medium text-muted underline hover:text-foreground"
      >
        View {season} draft board →
      </Link>
    </div>
  );
}
