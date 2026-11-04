import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { displayName } from '../league'
import type { Player, Team } from '../../types/db'
import { useGamePoints } from '../mvp/api'
import { Badge } from '@/components/ui/badge'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Segmented } from '../../ui/motion'
import { durationToken, easeToken } from '../../ui/motion/spring'
import { cell, seasonCounts, visibleColumns, weekCounts, type StatCounts, type TableColumn } from './table'
import { useStatPoints, type TeamSide } from './useTeamWeek'
import { fmtPoints, type WeekRow } from './week'

type View = 'week' | 'season'

interface Props {
  side: TeamSide
  team: Team
  opponent: Team | undefined
  seasonId: string | undefined
  playerById: Map<string, Player>
  onOpenPlayer(p: Player): void
}

/** Right-edge fade that hints at more columns. Same idea as .scroll-edge-top: currentColor fading out. */
const MORE_MASK = 'linear-gradient(to right, currentColor calc(100% - var(--space-unit) * 8), transparent)'

/**
 * Yahoo-style stats table for one team: this week's numbers, or the season's. The Player column is
 * pinned while the stat columns slide sideways. Tap a name for the player card. In the week view,
 * tap Pts to see how the points were scored, under the row (one row open at a time).
 */
export function TeamStatsTable({ side, team, opponent, seasonId, playerById, onOpenPlayer }: Props) {
  const [view, setView] = useState<View>('week')
  const [openId, setOpenId] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const reduce = useReducedMotion()
  const statPoints = useStatPoints()
  const season = useGamePoints(seasonId)
  const games = season.data

  const seasonByPlayer = useMemo(() => new Map(side.rows.map((r) => [r.playerId, seasonCounts(games ?? [], r.playerId)])), [side.rows, games])

  // Counts per player for the current view. Columns come from every row, so a stat hidden for one player shows if another has it.
  const countsByPlayer = useMemo(() => {
    const map = new Map<string, StatCounts>()
    for (const r of side.rows) map.set(r.playerId, view === 'week' ? weekCounts(r) : (seasonByPlayer.get(r.playerId)?.counts ?? {}))
    return map
  }, [side.rows, view, seasonByPlayer])
  const columns: TableColumn[] = useMemo(() => visibleColumns([...countsByPlayer.values()]), [countsByPlayer])

  const measure = useCallback(() => {
    const el = scroller.current
    if (el) setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    measure()
    const el = scroller.current
    if (!el) return
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [measure, columns.length, view, side.rows.length])

  const changeView = (v: View) => {
    setView(v)
    setOpenId(null)
  }

  // Breakdown motion: clip reveal from the top plus a fade; fades only when reduced motion is on.
  const openT = { duration: durationToken('--dur-base'), ease: easeToken('--ease-out') }
  const closeT = { duration: durationToken('--dur-fast'), ease: easeToken('--ease-out') }
  const clipClosed = 'inset(0% 0% 100% 0%)'
  const clipOpen = 'inset(0% 0% 0% 0%)'
  const colSpan = columns.length + 5

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Stats"
        value={view}
        onChange={changeView}
        options={[
          { value: 'week', label: 'This week' },
          { value: 'season', label: 'Season' },
        ]}
      />
      <div
        ref={scroller}
        onScroll={measure}
        className="glass-list overflow-x-auto rounded-panel"
        style={more ? ({ maskImage: MORE_MASK, WebkitMaskImage: MORE_MASK } as CSSProperties) : undefined}
      >
        <table className="w-max min-w-full border-collapse text-left text-small nums">
          <caption className="sr-only">{view === 'week' ? 'This week’s stats' : 'Season stats'}</caption>
          <thead>
            <tr className="caps-label">
              <th scope="col" className="py-2 pl-3 pr-2 font-strong">
                <abbr title="Position" className="no-underline">
                  Pos
                </abbr>
              </th>
              <th scope="col" className="sticky left-0 z-1 w-44 bg-(--glass-fallback) py-2 pr-2 text-left font-strong">
                <abbr title="Player" className="no-underline">
                  Player
                </abbr>
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-strong">
                {view === 'week' ? (
                  <abbr title="Opponent" className="no-underline">
                    Opp
                  </abbr>
                ) : (
                  <abbr title="Games played" className="no-underline">
                    GP
                  </abbr>
                )}
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-strong">
                <abbr title={view === 'week' ? 'Projected points' : 'Points per game'} className="no-underline">
                  Proj
                </abbr>
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-strong">
                <abbr title="Fantasy points" className="no-underline">
                  Pts
                </abbr>
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="py-2 pr-2 text-right font-strong whitespace-nowrap">
                  <abbr title={c.title} className="no-underline">
                    {c.label}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {side.rows.map((r) => {
              const p = playerById.get(r.playerId)
              const name = p ? displayName(p) : 'Unknown player'
              const started = r.actual !== null
              const weekView = view === 'week'
              const s = seasonByPlayer.get(r.playerId)
              const cells = weekView ? weekCells(r, opponent) : seasonCells(s)
              const open = weekView && openId === r.playerId
              return (
                <PlayerRows
                  key={r.playerId}
                  name={name}
                  player={p}
                  team={team}
                  row={r}
                  captain={team.captain_player_id === r.playerId}
                  onField={side.onField.has(r.playerId)}
                  opp={cells.opp}
                  proj={cells.proj}
                  pts={cells.pts}
                  canOpen={weekView && started}
                  dimPts={weekView && !started}
                  columns={columns}
                  counts={countsByPlayer.get(r.playerId) ?? {}}
                  open={open}
                  onToggle={() => setOpenId(open ? null : r.playerId)}
                  onOpenPlayer={() => p && onOpenPlayer(p)}
                  statLabel={(code) => statPoints.data?.get(code)?.label ?? code}
                  colSpan={colSpan}
                  reduce={!!reduce}
                  openT={openT}
                  closeT={closeT}
                  clipOpen={clipOpen}
                  clipClosed={clipClosed}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Week view: opponent, projected and actual points (a dash until kickoff). */
function weekCells(r: WeekRow, opponent: Team | undefined) {
  return {
    opp: opponent?.short_name ?? '–',
    proj: r.projected !== null ? r.projected.toFixed(1) : '–',
    pts: r.actual !== null ? fmtPoints(r.actual) : '–',
  }
}

/** Season view: games played, points per game and season points. */
function seasonCells(s: { games: number; points: number } | undefined) {
  const games = s?.games ?? 0
  const points = s?.points ?? 0
  return {
    opp: String(games),
    proj: games > 0 ? (points / games).toFixed(1) : '–',
    pts: games > 0 ? fmtPoints(points) : '–',
  }
}

/** One player's row, plus the (normally empty) breakdown row under it that opens with the points. */
function PlayerRows({
  name,
  player,
  team,
  row,
  captain,
  onField,
  opp,
  proj,
  pts,
  canOpen,
  dimPts,
  columns,
  counts,
  open,
  onToggle,
  onOpenPlayer,
  statLabel,
  colSpan,
  reduce,
  openT,
  closeT,
  clipOpen,
  clipClosed,
}: {
  name: string
  player: Player | undefined
  team: Team
  row: WeekRow
  captain: boolean
  onField: boolean
  opp: string
  proj: string
  pts: string
  /** Pts is a button (week view, game started). */
  canOpen: boolean
  /** Pts is a dash before kickoff. */
  dimPts: boolean
  columns: TableColumn[]
  counts: StatCounts
  open: boolean
  onToggle(): void
  onOpenPlayer(): void
  statLabel(code: string): string
  colSpan: number
  reduce: boolean
  openT: Transition
  closeT: Transition
  clipOpen: string
  clipClosed: string
}) {
  const cellClass = 'h-(--tap-min) border-t border-(--glass-groove) py-2 pr-2 text-right align-middle'
  return (
    <>
      <tr>
        <td className={`${cellClass} pl-3 text-left`}>
          <span className={`inline-block w-10 rounded-chip py-0.5 text-center caps-label ${row.isQb ? 'bg-gold-soft text-gold' : 'bg-(--press-fill) text-text'}`}>
            {row.position}
          </span>
        </td>
        <td className={`${cellClass} sticky left-0 z-1 w-44 bg-(--glass-fallback) pr-2 text-left`}>
          <button type="button" onClick={onOpenPlayer} className="pressable lit flex min-h-(--tap-min) w-full min-w-0 items-center gap-2 bg-transparent text-left">
            <PlayerBadge jersey={player?.jersey ?? null} team={row.isQb ? undefined : team.color_key} photo={player?.photo_path ?? null} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
              <span className="flex w-full items-center gap-1">
                <span className="truncate font-strong">{name}</span>
                {captain && <span className="caps-label text-gold">C</span>}
              </span>
              {onField && <Badge variant="live">On field</Badge>}
            </span>
          </button>
        </td>
        <td className={`${cellClass} whitespace-nowrap text-text-2-strong`}>{opp}</td>
        <td className={`${cellClass} text-text-2-strong`}>{proj}</td>
        <td className={`${cellClass} font-strong`}>
          {canOpen ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={`${name}: ${pts} points. ${open ? 'Hide' : 'Show'} how they were scored`}
              className="pressable lit numeral text-body-lg nums flex min-h-(--tap-min) w-full items-center justify-end bg-transparent"
            >
              {pts}
            </button>
          ) : (
            <span className={`numeral text-body-lg nums ${dimPts ? 'text-text-3' : ''}`}>{pts}</span>
          )}
        </td>
        {columns.map((c) => (
          <td key={c.key} className={`${cellClass} whitespace-nowrap`}>
            {cell(counts, c.key)}
          </td>
        ))}
      </tr>
      <tr>
        <td colSpan={colSpan} className="p-0">
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="breakdown"
                initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: clipClosed }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, clipPath: clipOpen }}
                exit={reduce ? { opacity: 0, transition: closeT } : { opacity: 0, clipPath: clipClosed, transition: closeT }}
                transition={openT}
                className="surface-inset mx-3 mb-2 overflow-hidden rounded-panel"
              >
                {row.breakdown.length === 0 ? (
                  <p className="px-3 py-3 text-small text-text-2">No stats in this game yet.</p>
                ) : (
                  <ul className="divide-y divide-divider">
                    {row.breakdown.map((l) => (
                      <li key={l.statTypeId} className="flex min-h-(--tap-min) items-center gap-3 px-3 py-2">
                        <span className="flex-1">{statLabel(l.statTypeId)}</span>
                        <span className="text-text-2 nums">×{l.value}</span>
                        <span className={`numeral w-12 text-right text-body-lg nums ${l.points > 0 ? 'text-ok' : l.points < 0 ? 'text-danger' : 'text-text-3'}`}>
                          {l.points > 0 ? '+' : ''}
                          {fmtPoints(l.points)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </td>
      </tr>
    </>
  )
}

type Transition = { duration: number; ease: [number, number, number, number] }
