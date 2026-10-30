import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMember } from '../auth'
import { ordinal, recordText, useSeasonSnapshot } from '../league'
import { Button } from '../../ui/Button'
import { ErrorState } from '../../ui/ErrorState'
import { Icon, type IconName } from '../../ui/Icon'
import { SectionHeader } from '../../ui/SectionHeader'
import { Skeleton } from '../../ui/Skeleton'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'
import { StatBox } from '../../ui/StatBox'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamVar } from '../../ui/team'
import { Tilt } from '../../ui/motion'
import { LeagueLeaders } from './LeagueLeaders'
import { StandingsTable } from '../standings/StandingsTable'

const QUICK: { to: string; label: string; icon: IconName }[] = [
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
  { to: '/standings', label: 'Standings', icon: 'trophy' },
  { to: '/players', label: 'Players', icon: 'players' },
  { to: '/players?tab=teams', label: 'Teams', icon: 'shield' },
]

const rise = (i: number) => ({ '--i': i }) as CSSProperties

/** The front page: this week's hero, your team, shortcuts, leaders and the top of the table. */
export default function HomePage() {
  const member = useMember()
  const snap = useSeasonSnapshot(member.playerId)
  const navigate = useNavigate()

  if (snap.isPending) return <Skeleton rows={5} />
  if (snap.isError) return <ErrorState what="the league" onRetry={snap.refetch} />

  const season = snap.season
  const planned = season?.games_planned ?? null
  const featured = snap.myTeam ?? snap.teamById.get(snap.standings[0]?.team_id ?? '')
  const featuredRow = snap.myTeam ? snap.myRow : snap.standings[0]

  return (
    <div className="flex flex-col gap-8">
      {/* Hero: the week (or the season) in giant condensed type over the stadium. */}
      <section
        aria-labelledby="hero-title"
        className="rise relative isolate -mx-4 flex min-h-(--hero-min) flex-col justify-end overflow-hidden px-5 pt-16 pb-6 sm:mx-0 sm:rounded-hero"
      >
        <StadiumBackdrop lightsOn />
        <p className="brand-type text-small text-accent text-glow">
          {snap.nextWeek !== null ? season?.name : 'Minor League Football'}
        </p>
        <h1 id="hero-title" className="numeral text-display text-text uppercase">
          {snap.nextWeek !== null ? (
            <>
              Week <span className="text-accent text-glow">{snap.nextWeek}</span>
            </>
          ) : (
            <SeasonTitle name={season?.name ?? 'Season'} />
          )}
        </h1>
        {planned !== null && (
          <p className="nums mt-2 flex items-center gap-2 text-text-2-strong">
            <span className="text-text">{snap.played}</span> of {planned} games played
            <span aria-hidden="true" className="size-1 rounded-pill bg-text-2" />
            {Math.max(planned - snap.played, 0)} to go
          </p>
        )}
      </section>

      {/* Your team (or the table leader when you have no team). */}
      {featured && featuredRow && (
        <Tilt className="rise" >
          <section
            style={{ ...rise(1), '--team': teamVar(featured.color_key) } as CSSProperties}
            aria-labelledby="team-title"
            className="glass-panel lit team-wash flex flex-col gap-6 rounded-hero p-5"
          >
            <div className="flex items-center gap-4">
              <TeamBadge team={featured} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="caps-label">{snap.myTeam ? 'Your team' : 'Top of the table'}</p>
                <h2 id="team-title" className="truncate text-headline leading-none">
                  {featured.name}
                </h2>
                <p className="nums text-text-2-strong">
                  {recordText(featuredRow)} <span className="text-text-3">·</span> {ordinal(featuredRow.rank)} place
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-4 border-t border-divider pt-5">
              <StatBox label="PF" value={featuredRow.points_for} count accent />
              <StatBox label="PA" value={featuredRow.points_against} count />
              <StatBox label="Diff" value={featuredRow.point_diff > 0 ? `+${featuredRow.point_diff}` : featuredRow.point_diff} />
            </dl>
            <Button variant="primary" size="xl" onClick={() => navigate('/schedule')}>
              See the schedule
              <Icon name="forward" size="sm" />
            </Button>
          </section>
        </Tilt>
      )}

      {/* Shortcuts */}
      <nav aria-label="Shortcuts" className="rise grid grid-cols-4 gap-2" style={rise(2)}>
        {QUICK.map((q) => (
          <Link
            key={q.label}
            to={q.to}
            className="lift lit surface-inset flex flex-col items-center gap-2 rounded-panel px-1 py-4 text-text-2-strong hover-fine:text-text"
          >
            <span className="flex size-(--badge-sm) items-center justify-center rounded-pill bg-accent-soft text-accent">
              <Icon name={q.icon} size="sm" />
            </span>
            <span className="text-label font-strong">{q.label}</span>
          </Link>
        ))}
      </nav>

      <section className="rise flex flex-col gap-3" style={rise(3)} aria-label="League leaders">
        <SectionHeader title="League leaders" to="/players" linkLabel="All players" />
        <LeagueLeaders />
      </section>

      {snap.standings.length > 0 && (
        <section className="rise flex flex-col gap-3" style={rise(4)} aria-label="Standings">
          <SectionHeader title="Standings" to="/standings" linkLabel="Full table" />
          <StandingsTable rows={snap.standings} teamById={snap.teamById} highlightTeamId={snap.myTeam?.id} compact />
        </section>
      )}
    </div>
  )
}

/** "2026 season" → cyan "2026" over "SEASON". */
function SeasonTitle({ name }: { name: string }) {
  const [first, ...rest] = name.split(' ')
  return rest.length ? (
    <>
      <span className="block text-accent text-glow">{first}</span>
      <span className="block">{rest.join(' ')}</span>
    </>
  ) : (
    <>{name}</>
  )
}
