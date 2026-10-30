#!/usr/bin/env node
/*
 * Reads data/private/league-data.json and writes data/private/import.sql (both gitignored).
 * Akiva pastes import.sql into Supabase → SQL Editor, so no secret key is ever needed.
 * Run: npm run import:sql
 *
 * What it brings in (database plan 8.11):
 *   • teams, players (birth YEAR only), current rosters
 *   • the current season + the saved game scores as "Final score (entered by hand)"
 *   • record adjustments = confirmed record minus the saved games
 *   • the old stat sheet as an "Earlier totals" season that never counts toward standings
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = new URL('../data/private/league-data.json', import.meta.url)
const OUT = new URL('../data/private/import.sql', import.meta.url)

const TEAM_KEYS = {
  'Speed Demons': { color: 'demons', short: 'SD' },
  Daybies: { color: 'daybies', short: 'DAY' },
  Tigers: { color: 'tigers', short: 'TIG' },
}

// Old sheet rows → stat types (002_reference_data.sql). "conv" stays one stat: the 1/2-pt split is unknown.
const STAT_KEYS = { recs: 'rec', targets: 'target', drops: 'drop', tds: 'td', fumbles: 'fumble', ints: 'int', pick6: 'pick6', conv: 'conv_old', blocks: 'block' }

const data = JSON.parse(readFileSync(SRC, 'utf8'))

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`)
const n = (v) => (v === null || v === undefined ? 'null' : Number(v))
const arr = (list) => `array[${list.map(q).join(', ')}]::text[]`
const teamRef = (name) => `(select id from public.teams where name = ${q(name)})`
const playerRef = (login) => `(select id from public.players where login_name = ${q(login)})`

function fail(msg) {
  console.error(`Import stopped: ${msg}`)
  process.exit(1)
}

// ── Checks before writing anything ─────────────────────────────────────────
for (const t of data.teams) if (!TEAM_KEYS[t.name]) fail(`unknown team "${t.name}"`)
const byDisplay = new Map(data.players.map((p) => [p.display_name, p]))
for (const col of data.stats_as_sent.columns) if (!byDisplay.has(col)) fail(`stat sheet column has no matching player`)
for (const key of Object.keys(data.stats_as_sent)) {
  if (key !== '_note' && key !== 'columns' && !STAT_KEYS[key]) fail(`unknown stat row "${key}"`)
}

// Record from the saved games, then the adjustment to reach the confirmed record.
const fromGames = new Map(data.teams.map((t) => [t.name, { w: 0, l: 0, t: 0 }]))
for (const g of data.games_played) {
  const [a, b] = g.teams
  const [sa, sb] = g.score
  if (sa === sb) {
    fromGames.get(a).t++
    fromGames.get(b).t++
  } else {
    fromGames.get(sa > sb ? a : b).w++
    fromGames.get(sa > sb ? b : a).l++
  }
}
const adjustments = data.standings_confirmed_by_akiva.map((s) => {
  const got = fromGames.get(s.team)
  const adj = { team: s.team, w: s.w - got.w, l: s.l - got.l }
  if (adj.w < 0 || adj.l < 0) fail(`saved games give ${s.team} more wins or losses than the confirmed record`)
  return adj
})

// ── SQL ─────────────────────────────────────────────────────────────────────
const SEASON = `(select id from public.seasons where name = '2026 season')`
const EARLIER = `(select id from public.seasons where name = 'Earlier totals')`
const lines = []
const add = (s) => lines.push(s)

add('-- MLF import of the real league data. PRIVATE: generated from data/private/league-data.json, never commit.')
add('-- Paste into Supabase → SQL Editor → Run, after changes 001 and 002. Runs once; refuses to run twice.')
add('begin;')
add(`do $$ begin if exists (select 1 from public.players) then raise exception 'Players already exist: the import has already been run.'; end if; end $$;`)

add('\n-- Teams')
for (const t of data.teams) {
  const k = TEAM_KEYS[t.name]
  add(`insert into public.teams (name, short_name, color_key) values (${q(t.name)}, ${q(k.short)}, ${q(k.color)});`)
}

add('\n-- Seasons')
add(`insert into public.seasons (name, status, counts_for_standings, games_planned) values ('2026 season', 'regular', true, ${n(data.season_notes.games_total)});`)
add(`insert into public.seasons (name, status, counts_for_standings) values ('Earlier totals', 'finished', false);`)

add('\n-- Players (birth year only)')
for (const p of data.players) {
  const birthYear = p.birth_date ? Number(p.birth_date.match(/\d{4}/)?.[0] ?? NaN) : null // "MM/DD/YYYY" → YYYY
  if (Number.isNaN(birthYear)) fail("a birth date has no 4-digit year")
  const nickname = p.display_name && p.display_name !== p.full_name ? p.display_name : null
  add(
    `insert into public.players (full_name, nickname, login_name, jersey, positions, birth_year, height_in, weight_lb) values (` +
      [q(p.full_name), q(nickname), q(p.login_name), n(p.jersey), arr(p.positions ?? []), n(birthYear), n(p.height_in), n(p.weight_lb)].join(', ') +
      ');',
  )
}

add('\n-- Current rosters (players with no team, like the league manager, get no line)')
for (const p of data.players) {
  if (p.team) add(`insert into public.roster_memberships (player_id, team_id) values (${playerRef(p.login_name)}, ${teamRef(p.team)});`)
}

add('\n-- Saved games: final score only, entered by hand')
for (const g of data.games_played) {
  const [a, b] = g.teams
  const [sa, sb] = g.score
  add(`with g as (insert into public.games (season_id, home_team_id, away_team_id, status) values (${SEASON}, ${teamRef(a)}, ${teamRef(b)}, 'final') returning id)`)
  add(`insert into public.score_events (game_id, team_id, scoring_type_id, points) select id, ${teamRef(a)}, 'final_manual', ${n(sa)} from g union all select id, ${teamRef(b)}, 'final_manual', ${n(sb)} from g;`)
}

add('\n-- Record adjustments: confirmed record minus the saved games')
for (const a of adjustments) {
  if (a.w === 0 && a.l === 0) continue
  add(`insert into public.record_adjustments (season_id, team_id, wins, losses, note) values (${SEASON}, ${teamRef(a.team)}, ${a.w}, ${a.l}, 'Older games not written down game by game (confirmed by Akiva, 2026-10-29)');`)
}

add('\n-- Old stat sheet → "Earlier totals" (career only, never standings)')
const { columns } = data.stats_as_sent
for (const [key, statType] of Object.entries(STAT_KEYS)) {
  columns.forEach((col, i) => {
    const value = data.stats_as_sent[key][i]
    if (value) add(`insert into public.stat_events (season_id, player_id, stat_type_id, value) values (${EARLIER}, ${playerRef(byDisplay.get(col).login_name)}, '${statType}', ${n(value)});`)
  })
}

add('\ncommit;')
writeFileSync(OUT, lines.join('\n') + '\n')

const statLines = lines.filter((l) => l.startsWith('insert into public.stat_events')).length
console.log(`Wrote data/private/import.sql: ${data.teams.length} teams, ${data.players.length} players, ${data.games_played.length} games, ${statLines} stat lines.`)
console.log('Record adjustments:', adjustments.map((a) => `${a.team} +${a.w}-${a.l}`).join(', '))
