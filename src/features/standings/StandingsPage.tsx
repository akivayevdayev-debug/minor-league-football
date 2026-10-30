import { useState } from "react";
import { useMember } from "../auth";
import { recordText, useSeasonSnapshot } from "../league";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorState } from "../../ui/ErrorState";
import { Skeleton } from "../../ui/Skeleton";
import { StadiumBackdrop } from "../../ui/StadiumBackdrop";
import { TeamBadge } from "../../ui/TeamBadge";
import { teamStyle } from "../../ui/team";
import { Segmented, SegmentedPanel } from "../../ui/motion";
import { StandingsTable } from "./StandingsTable";
import { LeagueLeaders } from "./LeagueLeaders";
import { PlayoffsPanel } from "./PlayoffsPanel";

const VIEWS = [
  { value: "record", label: "Record" },
  { value: "points", label: "Points" },
] as const;

const SECTIONS = [
  { value: "table", label: "Table" },
  { value: "playoffs", label: "Playoffs" },
] as const;

const pctText = (n: number) => Number(n).toFixed(3).replace(/^0/, "");

/** Standings for the current season, a leader hero, then league leaders. Order: win %, then point difference, then points for. */
export default function StandingsPage() {
  const member = useMember();
  const snap = useSeasonSnapshot(member.playerId);
  const [view, setView] = useState<"record" | "points">("record");
  const [section, setSection] = useState<"table" | "playoffs">("table");

  if (snap.isPending) return <Skeleton rows={4} />;
  if (snap.isError)
    return <ErrorState what="the standings" onRetry={snap.refetch} />;
  if (!snap.season || snap.standings.length === 0)
    return (
      <EmptyState
        icon="trophy"
        title="No table yet"
        body="The standings fill in once the first game is final."
      />
    );

  const leader = snap.standings.find((r) => r.rank === 1) ?? snap.standings[0];
  if (!leader)
    return (
      <EmptyState
        icon="trophy"
        title="No table yet"
        body="The standings fill in once the first game is final."
      />
    );
  const leaderTeam = snap.teamById.get(leader.team_id);

  return (
    <section className="flex flex-col gap-6">
      <header className="rise flex flex-col gap-1">
        <p className="brand-type text-small text-accent">{snap.season.name}</p>
        <h1 className="text-headline">Standings</h1>
      </header>

      <Segmented
        label="Show"
        value={section}
        onChange={setSection}
        options={SECTIONS}
        className="rise"
      >
        <SegmentedPanel value="playoffs">
          <PlayoffsPanel snap={snap} />
        </SegmentedPanel>
        <SegmentedPanel value="table">
          <div className="flex flex-col gap-6">
            <section
              aria-label="Leader"
              style={teamStyle(leaderTeam?.color_key)}
              className="rise relative isolate flex items-center gap-4 overflow-hidden rounded-hero border border-(--glass-border) p-4"
            >
              <StadiumBackdrop
                photo="bowl"
                team={leaderTeam?.color_key ?? null}
              />
              <TeamBadge team={leaderTeam} size="lg" />
              <div className="relative flex min-w-0 flex-1 flex-col gap-1">
                <p className="caps-label text-(--team-light)">Leader</p>
                <p className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-title font-strong">
                    {leaderTeam?.name ?? "Unknown team"}
                  </span>
                  <span className="numeral shrink-0 text-stat nums">
                    {recordText(leader)}
                  </span>
                </p>
                <p className="text-small text-text-2-strong nums">
                  {pctText(leader.win_pct)} win pct ·{" "}
                  {leader.point_diff > 0
                    ? `+${leader.point_diff}`
                    : leader.point_diff}{" "}
                  point diff
                </p>
              </div>
            </section>

            <Segmented
              label="Sort the table by"
              value={view}
              onChange={setView}
              options={VIEWS}
              className="rise"
            >
              {VIEWS.map((v) => (
                <SegmentedPanel key={v.value} value={v.value}>
                  <StandingsTable
                    rows={snap.standings}
                    teamById={snap.teamById}
                    highlightTeamId={snap.myTeam?.id}
                    view={v.value}
                  />
                </SegmentedPanel>
              ))}
            </Segmented>
            <p className="text-small text-text-2">
              Ranked by win percentage, then point difference, then points
              scored. A tie counts as half a win. The playoff final doesn't
              count here.
            </p>
          </div>
        </SegmentedPanel>
      </Segmented>

      <LeagueLeaders />
    </section>
  );
}
