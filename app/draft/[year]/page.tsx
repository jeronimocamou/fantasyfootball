import { notFound } from "next/navigation";
import {
  getSeasons,
  getDraftForSeason,
  getTeamsForSeason,
  getDraftDate,
  getDraftOrder,
} from "@/lib/db";

export function generateStaticParams() {
  return getSeasons().map((s) => ({ year: String(s) }));
}

const POSITIONS: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "D/ST",
};

export default async function DraftPage(props: PageProps<"/draft/[year]">) {
  const { year } = await props.params;
  const season = Number(year);
  const seasons = getSeasons();
  if (!seasons.includes(season)) notFound();

  const picks = getDraftForSeason(season);
  const teams = getTeamsForSeason(season);
  const teamName = new Map(teams.map((t) => [t.team_id, t.name]));
  const draftDate = getDraftDate(season);
  const draftOrder = picks.length === 0 ? getDraftOrder(season) : [];

  const rounds = Array.from(new Set(picks.map((p) => p.round_id))).sort(
    (a, b) => a - b
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{season} Draft Board</h1>
        {draftDate && (
          <p className="mt-1 text-sm text-muted">
            {picks.length === 0 ? "Draft day:" : "Drafted"}{" "}
            <span className="font-medium text-foreground">
              {draftDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {picks.length === 0 &&
              ` at ${draftDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
          </p>
        )}
      </div>

      {picks.length === 0 ? (
        draftOrder.length > 0 ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Draft Order</h2>
            <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Pick</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {draftOrder.map((d) => (
                    <tr key={d.overall_pick} className="border-t border-border-color/60">
                      <td className="px-4 py-3 text-muted">{d.overall_pick}</td>
                      <td className="px-4 py-3 font-medium">{d.team_name}</td>
                      <td className="px-4 py-3 text-muted">{d.display_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No draft data yet for this season.</p>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {rounds.map((round) => (
            <div key={round}>
              <h2 className="mb-2 text-sm font-semibold text-muted">
                Round {round}
              </h2>
              <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2">Pick</th>
                      <th className="px-4 py-2">Team</th>
                      <th className="px-4 py-2">Player</th>
                      <th className="px-4 py-2">Pos</th>
                      {picks.some((p) => p.bid_amount > 0) && (
                        <th className="px-4 py-2 text-right">Bid</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {picks
                      .filter((p) => p.round_id === round)
                      .map((p) => (
                        <tr
                          key={p.overall_pick}
                          className="border-t border-border-color/60"
                        >
                          <td className="px-4 py-2 text-muted">
                            {p.overall_pick}
                          </td>
                          <td className="px-4 py-2">
                            {teamName.get(p.team_id) ?? p.team_id}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {p.full_name ?? `#${p.player_id}`}
                            {p.keeper ? (
                              <span className="ml-2 rounded bg-foreground/5 px-1.5 py-0.5 text-xs text-muted">
                                keeper
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-muted">
                            {p.position_id ? POSITIONS[p.position_id] ?? "-" : "-"}
                          </td>
                          {picks.some((pp) => pp.bid_amount > 0) && (
                            <td className="px-4 py-2 text-right tabular-nums">
                              {p.bid_amount > 0 ? `$${p.bid_amount}` : ""}
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
