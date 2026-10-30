/*
 * Box score: one game's player stats per team, the scoring timeline, and (on request) the edit history.
 * The "Fill in the stat sheet" button opens GameStatSheet to type or fix a whole game's stats.
 */
import { useMemo, useState, type JSX } from 'react'
import { displayName } from '../league'
import type { Game, Player, ScoreEvent, ScoringTypeId, StatType, StatTypeId, Team } from '../../types/db'
import { Icon } from '../../ui/Icon'
import { Skeleton } from '../../ui/Skeleton'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import { useGameHistory, type GameHistoryRow, type GameStat } from './api'
import { GameStatSheet } from './GameStatSheet'

const ABBR: Partial<Record<StatTypeId, string>> = {
  rec: 'REC',
  target: 'TGT',
  drop: 'DRP',
  td: 'TD',
  fumble: 'FUM',
  int: 'INT',
  pick6: 'P6',
  conv1: '1PT',
  conv2: '2PT',
  block: 'BLK',
}

const TYPE_LABEL: Record<ScoringTypeId, string> = {
  td: 'Touchdown',
  conv1: '1-point conversion',
  conv2: '2-point conversion',
  final_manual: 'Final score',
}

const HIDDEN_STAT: StatTypeId = 'conv_old'

function abbr(s: StatType): string {
  return ABBR[s.id] ?? s.label.slice(0, 3).toUpperCase()
}

interface TeamTally {
  players: Map<string, Map<StatTypeId, number>>
  team: Map<StatTypeId, number>
}

/** Adds up one team's stat lines: per player, and team-level (no player). */
function tally(teamId: string, stats: GameStat[]): TeamTally {
  const out: TeamTally = { players: new Map(), team: new Map() }
  for (const s of stats) {
    if (s.team_id !== teamId) continue
    if (s.player_id) {
      const counts = out.players.get(s.player_id) ?? new Map<StatTypeId, number>()
      counts.set(s.stat_type_id, (counts.get(s.stat_type_id) ?? 0) + s.value)
      out.players.set(s.player_id, counts)
    } else {
      out.team.set(s.stat_type_id, (out.team.get(s.stat_type_id) ?? 0) + s.value)
    }
  }
  return out
}

function TeamBox({
  team,
  stats,
  lines,
  playersById,
  statTypes,
}: {
  team: Team
  stats: GameStat[]
  lines: ScoreEvent[]
  playersById: Map<string, Player>
  statTypes: StatType[]
}) {
  const points = lines.filter((l) => l.team_id === team.id).reduce((n, l) => n + l.points, 0)
  const playerCols = statTypes.filter((s) => s.id !== HIDDEN_STAT && !s.team_level)
  const teamCols = statTypes.filter((s) => s.id !== HIDDEN_STAT && s.team_level)
  const t = useMemo(() => tally(team.id, stats), [team.id, stats])

  const rows = [...t.players.entries()]
    .map(([playerId, counts]) => ({
      playerId,
      counts,
      player: playersById.get(playerId),
      total: playerCols.reduce((n, s) => n + (counts.get(s.id) ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total || (a.player ? displayName(a.player) : '').localeCompare(b.player ? displayName(b.player) : ''))

  const teamTotals = teamCols.filter((s) => t.team.has(s.id))
  const headingId = `box-team-${team.id}`

  return (
    <section aria-labelledby={headingId} style={teamStyle(team.color_key)} className="glass-list team-glow flex flex-col overflow-hidden rounded-panel">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <TeamBadge team={team} size="sm" />
        <h2 id={headingId} className="min-w-0 flex-1 truncate font-display text-body-lg font-bold uppercase">
          {team.name}
        </h2>
        <span className="numeral text-stat text-text">{points}</span>
      </header>

      {rows.length === 0 && teamTotals.length === 0 ? (
        <p className="px-4 pb-4 text-small text-text-2">No player stats yet for {team.short_name}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="nums w-full min-w-max border-collapse text-small">
            <thead>
              <tr className="text-text-2">
                <th scope="col" className="sticky left-0 bg-panel px-4 py-2 text-left caps-label">
                  Player
                </th>
                {playerCols.map((s) => (
                  <th key={s.id} scope="col" title={s.label} className="px-2 py-2 text-center caps-label">
                    {abbr(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {rows.map((r) => (
                <tr key={r.playerId}>
                  <th scope="row" className="sticky left-0 bg-panel px-4 py-2.5 text-left font-normal">
                    {r.player?.jersey != null && <span className="text-(--team-light)">#{r.player.jersey} </span>}
                    <span className="font-strong">{r.player ? displayName(r.player) : 'Unknown player'}</span>
                    {r.player?.is_guest && <span className="ml-2 caps-label">Sub</span>}
                  </th>
                  {playerCols.map((s) => {
                    const v = r.counts.get(s.id) ?? 0
                    return (
                      <td key={s.id} className="px-2 py-2.5 text-center">
                        {v === 0 ? '–' : v}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {teamTotals.length > 0 && (
                <tr>
                  <th scope="row" className="sticky left-0 bg-panel px-4 py-2.5 text-left font-strong">
                    Team
                  </th>
                  <td colSpan={Math.max(playerCols.length, 1)} className="px-2 py-2.5 text-left">
                    {teamTotals.map((s) => `${t.team.get(s.id)} ${abbr(s)}`).join(' · ')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ScoringTimeline({
  lines,
  home,
  away,
  playersById,
}: {
  lines: ScoreEvent[]
  home: Team
  away: Team
  playersById: Map<string, Player>
}) {
  // Running score after each line, oldest first.
  const rows = useMemo(() => {
    const out: { line: ScoreEvent; homeScore: number; awayScore: number }[] = []
    for (const line of lines) {
      const prev = out.at(-1)
      const homeScore = (prev?.homeScore ?? 0) + (line.team_id === home.id ? line.points : 0)
      const awayScore = (prev?.awayScore ?? 0) + (line.team_id === away.id ? line.points : 0)
      out.push({ line, homeScore, awayScore })
    }
    return out
  }, [lines, home.id, away.id])

  return (
    <section aria-labelledby="box-scoring" className="flex flex-col gap-2">
      <h2 id="box-scoring" className="text-body-lg">
        Scoring
      </h2>
      {rows.length === 0 ? (
        <p className="text-small text-text-2">No scores yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-divider rounded-panel surface-solid">
          {rows.map(({ line, homeScore, awayScore }) => {
            const team = line.team_id === home.id ? home : away
            const who = line.player_id ? playersById.get(line.player_id) : undefined
            return (
              <li key={line.id} style={teamStyle(team.color_key)} className="flex items-center gap-3 px-3 py-2.5">
                <span aria-hidden="true" className="h-(--icon-md) w-(--stripe) rounded-pill bg-(--team)" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-strong">{team.short_name}</span> {TYPE_LABEL[line.scoring_type_id]}
                  {who && <span className="text-text-2"> · {displayName(who)}</span>}
                </span>
                <span className="nums shrink-0 text-small text-text-2">
                  {home.short_name} {homeScore} – {away.short_name} {awayScore}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function changeText(row: GameHistoryRow): string {
  const kind = row.table_name === 'stat_events' ? 'stat line' : 'score'
  if (row.action === 'insert') return `Added a ${kind}`
  if (row.action === 'update' && !!row.after?.voided_at && !row.before?.voided_at) return `Undid a ${kind}`
  return `Changed a ${kind}`
}

function ChangeHistory({ gameId, playersById }: { gameId: string; playersById: Map<string, Player> }) {
  const [open, setOpen] = useState(false)
  const history = useGameHistory(gameId, open)

  return (
    <section aria-labelledby="box-changes" className="flex flex-col gap-2">
      <h2 id="box-changes" className="text-body-lg">
        Changes
      </h2>
      {!open ? (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="pressable flex min-h-(--tap-game) items-center gap-2 self-start rounded-panel surface-inset px-4 font-strong"
        >
          <Icon name="history" size="sm" /> Show the change history
        </button>
      ) : history.isPending ? (
        <Skeleton rows={3} />
      ) : history.isError ? (
        <p className="text-small text-text-2">Couldn't load the history.</p>
      ) : (history.data ?? []).length === 0 ? (
        <p className="text-small text-text-2">No changes yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-divider rounded-panel surface-solid">
          {(history.data ?? []).map((row) => {
            const pid = typeof row.after?.player_id === 'string' ? row.after.player_id : typeof row.before?.player_id === 'string' ? row.before.player_id : null
            const who = pid ? playersById.get(pid) : undefined
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0 truncate">
                  {changeText(row)}
                  {who && <span className="text-text-2"> · {displayName(who)}</span>}
                </span>
                <span className="nums shrink-0 text-small text-text-2">
                  {new Date(row.changed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export function BoxScorePanel({
  game,
  home,
  away,
  stats,
  lines,
  players,
  statTypes,
}: {
  game: Game
  home: Team
  away: Team
  stats: GameStat[]
  lines: ScoreEvent[]
  players: Player[]
  statTypes: StatType[]
}): JSX.Element {
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="pressable flex min-h-(--tap-game) items-center justify-center gap-2 rounded-panel surface-inset px-4 font-strong"
      >
        <Icon name="edit" size="sm" /> Fill in the stat sheet
      </button>
      <GameStatSheet game={game} home={home} away={away} open={sheetOpen} onOpenChange={setSheetOpen} />
      <TeamBox team={home} stats={stats} lines={lines} playersById={playersById} statTypes={statTypes} />
      <TeamBox team={away} stats={stats} lines={lines} playersById={playersById} statTypes={statTypes} />
      <ScoringTimeline lines={lines} home={home} away={away} playersById={playersById} />
      <ChangeHistory gameId={game.id} playersById={playersById} />
    </div>
  )
}
