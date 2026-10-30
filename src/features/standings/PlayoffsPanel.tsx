import { Link } from "react-router-dom";
import { useGameScores, type SeasonSnapshot } from "../league";
import { formatGameTime, ZONE_LABEL } from "../../lib/time";
import type { Team } from "../../types/db";
import { Badge } from "@/components/ui/badge";
import { Icon } from "../../ui/Icon";
import { StadiumBackdrop } from "../../ui/StadiumBackdrop";
import { TeamBadge } from "../../ui/TeamBadge";
import { teamStyle } from "../../ui/team";

/**
 * The playoffs: one championship final, 1st place vs 2nd place. Before it is scheduled we show who
 * would play if the season ended today. Once the final is over, the winner is crowned in gold.
 */
export function PlayoffsPanel({ snap }: { snap: SeasonSnapshot }) {
  const scores = useGameScores(snap.season?.id);
  const final = snap.games.filter((g) => g.kind === "playoff").at(-1);
  const seed = (rank: number) =>
    snap.teamById.get(
      snap.standings.find((r) => r.rank === rank)?.team_id ?? "",
    );

  const home = final?.home_team_id
    ? snap.teamById.get(final.home_team_id)
    : seed(1);
  const away = final?.away_team_id
    ? snap.teamById.get(final.away_team_id)
    : seed(2);
  const score = final ? scores.data?.get(final.id) : undefined;
  const done = final?.status === "final" && !!score;
  const live = final?.status === "live" || final?.status === "halftime";
  const champion =
    done && score.home_points !== score.away_points
      ? score.home_points > score.away_points
        ? home
        : away
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      {champion && (
        <section
          aria-label="Champions"
          style={teamStyle(champion.color_key)}
          className="rise champion relative isolate flex items-center gap-4 overflow-hidden rounded-hero p-4"
        >
          <StadiumBackdrop photo="bowl" team={champion.color_key} />
          <TeamBadge team={champion} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex items-center gap-1 caps-label text-gold">
              <Icon name="crown" size="xs" />
              {snap.season?.name ?? "League"} champions
            </p>
            <h2 className="truncate font-display text-headline font-bold uppercase leading-none text-gold">
              {champion.name}
            </h2>
          </div>
          <Icon name="trophy" size="lg" className="shrink-0 text-gold" />
        </section>
      )}

      <section
        aria-labelledby="final-title"
        className="rise glass-list flex flex-col gap-3 overflow-hidden rounded-panel p-4"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <Icon name="trophy" size="sm" className="text-gold" />
          <h2 id="final-title" className="flex-1 text-body font-strong">
            Championship final
          </h2>
          {live ? (
            <Badge variant="live">
              {final?.status === "live" ? "Live" : "Half"}
            </Badge>
          ) : done ? (
            <span className="caps-label">Final</span>
          ) : final?.starts_at ? (
            <span className="caps-label nums">
              {formatGameTime(final.starts_at)} {ZONE_LABEL}
            </span>
          ) : (
            <Badge variant="estimate">If the season ended today</Badge>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Finalist
            team={home}
            seed={1}
            points={done || live ? score?.home_points : undefined}
            crowned={!!champion && champion === home}
            lost={!!champion && champion !== home}
          />
          <span className="brand-type text-small text-text-3">VS</span>
          <Finalist
            team={away}
            seed={2}
            points={done || live ? score?.away_points : undefined}
            crowned={!!champion && champion === away}
            lost={!!champion && champion !== away}
          />
        </div>

        {final && !done && (
          <Link
            to={`/game/${final.id}`}
            className="pressable self-center text-small font-strong text-accent"
          >
            {live ? "Open the live game" : "Go to the game screen"}
          </Link>
        )}
        {!final && (
          <p className="text-small text-text-2">
            The final is 1st place against 2nd place from the table. Add it on
            the Schedule as a playoff game when the date is set.
          </p>
        )}
      </section>
    </div>
  );
}

function Finalist({
  team,
  seed,
  points,
  crowned,
  lost,
}: {
  team: Team | undefined;
  seed: number;
  points?: number;
  crowned: boolean;
  lost: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-col items-center gap-1 text-center"
      style={teamStyle(team?.color_key)}
    >
      <span
        className={crowned ? "champion-crest" : lost ? "opacity-60" : undefined}
      >
        <TeamBadge team={team} size="md" />
      </span>
      <span
        className={`w-full truncate font-display font-bold uppercase ${crowned ? "text-gold" : lost ? "text-text-2" : "text-text"}`}
      >
        {team?.name ?? "To be decided"}
      </span>
      <span className="caps-label">Seed {seed}</span>
      {points !== undefined && (
        <span
          className={`numeral text-stat nums ${crowned ? "text-gold" : lost ? "text-text-3" : "text-text"}`}
        >
          {points}
        </span>
      )}
    </div>
  );
}
