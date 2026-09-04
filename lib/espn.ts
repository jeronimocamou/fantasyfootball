const BASE =
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{leagueId}";

function cookies() {
  return {
    espn_s2: process.env.ESPN_S2!,
    SWID: process.env.ESPN_SWID!,
  };
}

function cookieHeader(): string {
  const c = cookies();
  return `espn_s2=${c.espn_s2}; SWID=${c.SWID}`;
}

async function fetchLeagueView(season: number, views: string[]) {
  const leagueId = process.env.ESPN_LEAGUE_ID!;
  const url = BASE.replace("{season}", String(season)).replace("{leagueId}", leagueId);
  const params = new URLSearchParams();
  for (const v of views) params.append("view", v);

  const res = await fetch(`${url}?${params.toString()}`, {
    headers: { Cookie: cookieHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ESPN fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export type EspnTeam = {
  id: number;
  name: string;
};

export type EspnMatchupTeam = {
  teamId: number;
  totalPoints: number;
  totalProjectedPoints: number;
};

export type EspnMatchup = {
  id: number;
  matchupPeriodId: number;
  playoffTierType: string;
  winner: string; // HOME | AWAY | TIE | UNDECIDED
  home: EspnMatchupTeam;
  away: EspnMatchupTeam;
};

export type EspnLeagueData = {
  scoringPeriodId: number;
  teams: EspnTeam[];
  schedule: EspnMatchup[];
};

export async function fetchLeagueLive(season: number): Promise<EspnLeagueData> {
  const data = await fetchLeagueView(season, ["mTeam", "mMatchupScore", "mLiveScoring"]);

  return {
    scoringPeriodId: data.scoringPeriodId,
    teams: (data.teams ?? []).map((t: { id: number; name: string }) => ({ id: t.id, name: t.name })),
    schedule: (data.schedule ?? []).map(
      (m: {
        id: number;
        matchupPeriodId: number;
        playoffTierType: string;
        winner: string;
        home: EspnMatchupTeam;
        away: EspnMatchupTeam;
      }) => ({
        id: m.id,
        matchupPeriodId: m.matchupPeriodId,
        playoffTierType: m.playoffTierType,
        winner: m.winner ?? "UNDECIDED",
        home: {
          teamId: m.home?.teamId,
          totalPoints: m.home?.totalPoints ?? 0,
          totalProjectedPoints: m.home?.totalProjectedPoints ?? 0,
        },
        away: {
          teamId: m.away?.teamId,
          totalPoints: m.away?.totalPoints ?? 0,
          totalProjectedPoints: m.away?.totalProjectedPoints ?? 0,
        },
      })
    ),
  };
}

export type EspnTeamPower = {
  teamId: number;
  currentProjectedRank: number;
};

// ESPN's own roster-strength ranking, computed from the draft — the only
// meaningful "how good is this team" signal that exists before any games
// have been played. It updates through the season as actual results
// factor in, so calling this later in the year reflects real performance
// too, not just the preseason draft.
export async function fetchTeamPower(season: number): Promise<EspnTeamPower[]> {
  const data = await fetchLeagueView(season, ["mTeam"]);
  return (data.teams ?? []).map((t: { id: number; currentProjectedRank: number }) => ({
    teamId: t.id,
    currentProjectedRank: t.currentProjectedRank,
  }));
}

export type EspnFinalStanding = {
  teamId: number;
  rankCalculatedFinal: number;
};

// A prior season's final standing per team — used as the "past
// performance" signal for futures odds. Returns an empty array if that
// season isn't reachable (e.g. the league didn't exist yet), rather than
// throwing, since this is a secondary signal that should degrade
// gracefully.
export async function fetchFinalStandings(season: number): Promise<EspnFinalStanding[]> {
  try {
    const data = await fetchLeagueView(season, ["mTeam"]);
    return (data.teams ?? []).map((t: { id: number; rankCalculatedFinal: number }) => ({
      teamId: t.id,
      rankCalculatedFinal: t.rankCalculatedFinal,
    }));
  } catch {
    return [];
  }
}
