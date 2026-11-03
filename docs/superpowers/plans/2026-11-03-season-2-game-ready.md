# Season 2 Part 1 (game-ready by Nov 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Season 1 archived, Season 2 (4 teams, 18 games from Nov 8) live, with locked-down profiles and stats, and a game screen that works all game.

**Architecture:**
- One new database change, `supabase/changes/008_season_2.sql`, holds every schema, permission and reference-data change. It is tested on PGlite like changes 001 to 007.
- Real names, rosters and the schedule go in a gitignored import, `data/private/season-2-import.sql`.
- App changes stay inside the existing feature folders. A new `src/features/league/season.ts` is the one place that answers "which season, and its rules".

**Tech Stack:** TypeScript, React 19, Vite, Tailwind v4, TanStack Query, Supabase (Postgres + RLS + realtime), Vitest, PGlite.

**Spec:** `docs/superpowers/specs/2026-11-03-season-2-game-ready-design.md`. Read it with this plan; section ids (A1, B3, C4…) refer to it.

## Global Constraints
- `CLAUDE.md` rules apply to every task:
  - Private data only in `data/private/`. Birth **year** only in the database.
  - Every table has RLS. No deletes: void plus edit history.
  - Stats are event rows. All colours, sizes and timings come from `src/styles/tokens.css`.
  - Icons only through `src/ui/Icon`.
  - No animation on the clock, score or stat pad beyond a press scale. Game buttons ≥ 56 px (`--tap-game` or the existing game token).
- **No commits and no pushes.** Akiva commits at the final checkpoint (CLAUDE.md overrides the usual "commit per task"). Each task ends with tests passing and the diff left in the working copy.
- No Claude credit anywhere in git.
- Never use the `service_role` or `sb_secret_` key. Never handle passwords.
- Season 2 values (spec A1, A5): half 12 min, halftime 7, overtime 8, safety = 2 points, on-field team players = 3 (Season 1 = 2). Week 1 = 2026-11-08, times 12:15 and 13:45 America/New_York, field = settings default.
- Copy rules (spec C7):
  - Buttons are a verb plus an object, in sentence case.
  - Errors say what failed, then what to do.
  - Never colour alone.
- Every migration is safe to run once on the live database that already has 001 to 007 applied. Use `if not exists` and guarded `update`s.
- After code changes: `npx tsc --noEmit -p .`, `npx vitest run`, `graphify update .`.
- Subagents: Haiku 5.5, at most 5 at once, each brief includes this section verbatim. Claude (Opus) owns Tasks 2 and 5 and reviews every task.

## Review Focus
1. **A phone that slept or lost signal mid-game sends a stale clock state.** Expected: it never overwrites a newer clock. Test in Task 5: a pause carrying an older `updated_at` than the stored row is rejected or ignored.
2. **A game moves from `final` back to `live` to "fix" stats.** Expected: only the owner or league manager can reopen a final game, so members can't dodge B3. Test in Task 2.
3. **A member's own profile edit tries to change `is_guest`, `login_name` or a teammate's row through the API.** Expected: refused. Test in Task 2.
4. **Two phones log the same stat during a live game while one is offline.** Expected: client ids keep it single, and the per-game limit counts non-voided lines only. Test in Task 2 (the limit ignores voided lines).
5. **Season 1 pages after Season 2 starts.** Expected: Season 1 standings, leaders and box scores show exactly what they did before. Test in Task 4: the Season 1 standings snapshot is unchanged after running 008.

---

### Task 1: Migration 008, seasons, teams, stat types, new tables

**Files:**
- Create: `supabase/changes/008_season_2.sql` (section 1 of the file; Task 2 adds section 2)
- Create: `supabase/tests/season2.test.ts`
- Modify: `src/types/db.ts` (new columns and tables)
- Modify: `docs/checkpoint-0-database-plan.md` (sections 2, 4 and 5: note the three changes listed in the spec header)

**Interfaces:**
- Produces, in the database:
  - `seasons.half_minutes smallint`, `halftime_minutes smallint`, `overtime_minutes smallint null`, `on_field smallint`.
  - `teams.season_id uuid not null`, `teams.captain_player_id uuid null`.
  - `stat_types.stat_group text` (one of `qb`, `receiving`, `line`, `defense`, `kicks`, `team`, `legacy`) and `stat_types.max_per_game smallint`.
  - `games.home_qb_id uuid null`, `games.away_qb_id uuid null`.
  - `stat_events.clock_seconds integer null` and `score_events.clock_seconds integer null` (0 to 3600).
  - Table `game_subs(id uuid pk, game_id, team_id, player_id, voided_at, stamps)`.
  - Table `player_minutes(id uuid pk, game_id, player_id, minutes numeric(4,1) check 0..60, voided_at, stamps)`.
  - `scoring_types` row `safety` (2 points).
- Produces in `src/types/db.ts`: `Season`, `Team`, `Game`, `StatType` and `StatEvent` gain those fields, plus new `GameSub` and `PlayerMinutes` interfaces.

- [ ] **Step 1: Write failing tests in `supabase/tests/season2.test.ts`.** Reuse the `SUPABASE_STUB`, the `as()` helper and the setup from `rules.test.ts`: move them into `supabase/tests/helpers.ts` and import them in both files. Load 001 to 008 in order.
  - `it('renames 2026 season to Season 1 and finishes it')`: seed a season named `2026 season`, run 008, expect name `Season 1` and status `finished`.
  - `it('creates Season 2 with rulebook rules')`: one row named `Season 2` with half_minutes 12, halftime 7, overtime 8, on_field 3, starts_on 2026-11-08, ends_on 2027-01-03.
  - `it('current_season is Season 2')`: `select name from current_season` returns `Season 2`.
  - `it('old teams belong to Season 1')`: every pre-existing team's `season_id` is Season 1.
  - `it('team names are unique per season only')`: inserting a Season 2 team named `Tigers` succeeds, a second Season 2 `Tigers` fails.
  - `it('safety scores 2')`: `scoring_types` has `safety`, points 2.
  - `it('new stat types have groups and limits')`: `sack_taken` is in group `qb`, `rec_td` in `receiving`, `sack_allowed` in `line`, `sack` in `defense`, `punt_return` in `kicks`, `penalty` in `team`; `conv_old` has `active = false`; `td` has `max_per_game` 15.
  - `it('game_subs and player_minutes have RLS and no delete grant')`.
- [ ] **Step 2: Run it.** `npx vitest run supabase/tests/season2.test.ts` → FAIL (no 008 file).
- [ ] **Step 3: Write section 1 of 008.**
  - Rename and finish Season 1, matched by name `2026 season` and guarded.
  - Insert Season 2 if absent.
  - Backfill: Season 1 rules 10/7/null/2.
  - `current_season`: `create or replace view` returning the newest non-finished, non-voided season by `starts_on`.
  - Teams: add `season_id` (backfill to Season 1, then `set not null`). Replace the unique `name` constraint with unique `(season_id, name)`. Replace the `color_key` check with `('demons','daybies','tigers','gooners','sucks','spicy','shpitzy')`.
  - Stat types use these ids, groups and default limits. Reuse ids that already exist and only set their group and limit.
    - `qb`: `completion` 40, `incompletion` 40, `pass_td` 15, `int_thrown` 15, `qb_run` 20, `qb_rush_td` 10, `rollout` 30, `sack_taken` 20, `fumble` 10, `fumble_lost` 10, `pass_first_down` 30, `rush_first_down` 20.
    - `receiving`: `target` 60, `rec` 40, `rec_td` 15, `drop` 30, `first_down_catch` 30.
    - `line`: `sack_allowed` 20, `pressure_allowed` 30, `block` 40, `blocking_penalty` 10.
    - `defense`: `sack` 20, `int` 15, `pass_defended` 30, `forced_fumble` 10, `fumble_recovery` 10, `safety` 5, `two_hand_touch` 60.
    - `kicks`: `kickoff_return` 20, `punt_return` 20, `return_td` 10, `touchback` 20, `onside_recovery` 10, `kickoff` 20, `punt` 20.
    - `team`: `penalty` 30, `first_down` 40, `turnover` 20.
    - Existing ids not listed (`td`, `pick6`, `conv1`, `conv2`, `conv_old`, and any others): group `legacy`, `max_per_game` 15, `active = false` except `td` and `pick6`. Those two stay active, because the scorer prompt credits a TD line.
    - Labels are in sentence case, for example "Sack taken".
  - New stat types get `fantasy_points` 0.
  - `game_subs` and `player_minutes` copy the `lineups` pattern from 006: RLS, stamp, history triggers, the realtime publication, and grants without delete.
- [ ] **Step 4: Update `src/types/db.ts` and the plan doc sections.**
- [ ] **Step 5: Verify.** `npx vitest run supabase/tests` → all PASS, including the old `rules.test.ts`. Then `npx tsc --noEmit -p .` → no errors.

### Task 2: Migration 008, permissions and limits (Claude does this one)

**Files:**
- Modify: `supabase/changes/008_season_2.sql` (section 2)
- Modify: `supabase/tests/season2.test.ts`

**Interfaces:**
- Consumes: Task 1 tables and columns.
- Produces:
  - `member_logins.is_owner boolean default false` and `must_change_password boolean default false`.
  - `app_private.is_owner() returns boolean`.
  - `app_private.can_edit_game(game_id uuid) returns boolean`: true when `is_owner() or is_league_manager()` or the game's status is `live` or `halftime`.
  - `public.clear_my_password_flag() returns void`: security definer, `set search_path = ''`, and it updates only `where user_id = auth.uid()`.
  - Trigger `app_private.check_stat_limit()` on `stat_events` before insert or update. It raises `MLF_LIMIT:<stat label>:<max>` when the player's non-voided total for that stat and game would pass the limit.

- [ ] **Step 1: Write failing tests** (users: AKIVA as owner, EDDIE as league manager, MAIR as member, LEO as member):
  - `it('member edits own profile only')`: MAIR updates his own `achievements` → 1 row. MAIR updates LEO's row → 0 rows.
  - `it('member cannot change own is_guest or login_name')` → error.
  - `it('owner edits any profile; league manager cannot')`.
  - `it('anyone logs stats in a live game')`: game `live`, MAIR inserts a `stat_events` row → ok.
  - `it('only owner and league manager edit stats in a final game')`: MAIR insert or void → refused. EDDIE and AKIVA → ok. Same for `score_events`, `lineups`, `game_subs` and `player_minutes`.
  - `it('member cannot reopen a final game')`: MAIR sets a `final` game's status back to `live` → refused.
  - `it('stat limit blocks a 16th TD and ignores voided lines')`.
  - `it('quick guest add still works for members')`: insert a player with `is_guest = true` → ok.
  - `it('clear_my_password_flag clears only my flag')`.
- [ ] **Step 2: Run them** → FAIL.
- [ ] **Step 3: Write section 2 of 008.**
  - Drop and recreate the `members_change` policy on `players`:
    - using/check `(id = my player id) or is_owner()`.
    - A `before update` trigger blocks non-owners from changing `is_guest`, `login_name` or `voided_at`.
  - `members_add` on players: `is_owner() or (is_guest and login_name is null)`.
  - On `stat_events`, `score_events`, `lineups`, `game_subs` and `player_minutes`, replace `members_add` and `members_change` with the check `is_member() and app_private.can_edit_game(game_id)`. Stat lines with a null `game_id` need `is_owner() or is_league_manager()`.
  - `games`: an update trigger refuses a non-admin who changes `status` away from `final`.
  - Score line cap: 30 per team per game, in the same trigger style.
- [ ] **Step 4: Verify.** `npx vitest run supabase/tests` → all PASS.

### Task 3: Private Season 2 import

**Files:**
- Create: `data/private/season-2-import.sql` (gitignored; confirm with `git check-ignore`)
- Create: `supabase/tests/import-season2.test.ts` (`describe.skipIf(!existsSync(...))`, like `import.test.ts`)

**Interfaces:**
- Consumes: 008. The details come from `data/private/season-2-players.json` (birth year only, taken from `birth_date`).
- Produces: 4 Season 2 teams, with colours and captains per spec A2.
  - Colour keys: Gooners `gooners`, Sucks `sucks`, Spicy `spicy`, Shpitzy `shpitzy`.
  - Short names: `GOON`, `SUCKS`, `SPICY`, `SHPZ`.
- Produces: new players, Maurice turned into a non-guest with login `maurice`, and backups Joseph Cohen and Ilan Gorbatov with no team.
- Produces: roster memberships (Season 1 lines end 2026-11-07, Season 2 lines start 2026-11-08), 18 games exactly per spec A4, and the final (`kind='playoff'`, slots `rank:1` / `rank:2`).

- [ ] **Step 1: Write failing tests.**
  - 4 teams in Season 2, 4 players each, captains set.
  - 18 regular games. Every pair of teams meets 3 times. Each Sunday has one 12:15 game and one 13:45 game in New York time.
  - Week 1 = 2026-11-08 with Shpitzy (home) v Gooners, then Sucks (home) v Spicy.
  - No player has a full birth date column. Season 1 game count is unchanged.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Write the SQL.** Match by name or login, so it is idempotent. Use the existing players' logins (`leo`, `mair`, `david`, `lawrence`, `akiva`, `morris`, `max`, `ariel`, `chaimy`). Morris is on Shpitzy and Akiva is on Spicy (Akiva confirmed 2026-11-03).
- [ ] **Step 4: Verify** → PASS.

### Task 4: Season-aware app data

**Files:**
- Create: `src/features/league/season.ts`, `src/features/league/season.test.ts`
- Modify: `src/features/league/api.ts`, `src/features/game/lineup.ts`, `src/features/game/LiveGamePage.tsx`, `src/features/standings/StandingsPage.tsx`, `src/features/schedule/SchedulePage.tsx`, `src/features/players/PlayerProfile.tsx`, `src/features/roster/RosterPage.tsx`
- Modify: `src/styles/tokens.css` (4 team colour tokens: gooners gold, sucks red, spicy orange, shpitzy blue; each passes AA as a stripe next to the team name)
- Modify: `src/ui/team.ts` (map the new colour keys)

**Interfaces:**
- Produces:
  - `useSeasons(): Season[]`
  - `useActiveSeason(): Season | undefined`
  - `useViewedSeason(): [Season | undefined, (id: string) => void]`. The id is kept in the URL query `?season=`, defaulting to the active season.
  - `seasonRules(s: Season): { halfSeconds: number; halftimeSeconds: number; overtimeSeconds: number | null; onField: number }`
  - `<SeasonSelect />`: a plain `src/ui/Select`.
- `ON_FIELD` is removed. Callers use `seasonRules(season).onField`.
- `currentTeams()` filters to teams of the viewed season.

- [ ] **Step 1: Tests.**
  - `seasonRules` for a Season 2 row → `{ halfSeconds: 720, halftimeSeconds: 420, overtimeSeconds: 480, onField: 3 }`.
  - For a Season 1 row → 600, 420, null, 2.
  - The Review Focus #5 snapshot test: Season 1 standings rows from `derive.ts` are identical before and after including Season 2 games in the input.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Replace each `settings.data?.half_minutes` read with the game's season rules. Add `<SeasonSelect />` at the top of Standings, Schedule and PlayerProfile. On `PlayerProfile`, show the Edit button only for your own profile, or for any profile when you are the owner (`Member` gains `isOwner` from `member_logins.is_owner`; the database enforces it anyway).
- [ ] **Step 4: Verify.** `npx vitest run` and `npx tsc --noEmit -p .` → PASS.

### Task 5: Clock bug, run to zero, both teams, landscape (Claude does the diagnosis)

**Files:**
- Modify: `src/features/game/LiveGamePage.tsx`, `src/features/game/api.ts` (`useSetClock`), `src/lib/clock.ts`, `src/lib/clock.test.ts`, `src/features/game/GameTabPage.tsx`
- Create: `src/features/game/LandscapeClock.tsx`
- Possibly modify: `supabase/changes/008_season_2.sql` (a section 3 stale-write guard, if the cause needs it)

**Interfaces:**
- Produces: `clockPhase(remainingMs: number, running: boolean): 'running' | 'paused' | 'expired'` in `src/lib/clock.ts`.

- [ ] **Step 1: Diagnose** with superpowers:systematic-debugging. Use a local dev server and a Season 2 test game with a 3-minute half set in the local DB only. Check these suspects in order:
  1. Any code path that writes `game_clocks` besides start, pause, halftime and end. Run `graphify query "writes game_clocks"`, then grep `game_clocks` in `src`.
  2. A second phone or tab that was asleep sends Pause or Resume with its stale `left`. The `onMutate` optimistic write and `seconds_left: Math.ceil(left/1000)` from an old render.
  3. `UpdatePrompt` or `PullToRefresh` reloading mid-game, then a `start()` from the kickoff path with `c` momentarily null → `seconds_left: halfSeconds`.
  4. Realtime reconnect returning an older row.
  Record the proven cause in the final report.
- [ ] **Step 2: Write a failing test** that reproduces the proven cause. If it is suspect 2, write `it('a pause from a stale screen cannot rewind or stop a newer clock')`, guarded by the database, which compares `updated_at` sent with the row.
- [ ] **Step 3: Fix.** Then add `clockPhase`. At `expired` the screen shows "End of half" (or "End of game" in the 2nd half or overtime), and the stored clock is set to stopped at 0 once, by whichever phone sees it first. Nothing else pauses the clock. Starting overtime sets the clock to `overtimeSeconds` from `seasonRules`.
- [ ] **Step 4: Remove the team picker** from the clock screen (`GameTabPage` picker / `embedded` path). Both teams' score buttons are always visible.
- [ ] **Step 5: Landscape.** When `matchMedia('(orientation: landscape) and (max-height: 500px)')` matches, render `LandscapeClock`: home score and buttons on the left, the clock in the middle on a solid surface, away score and buttons on the right. Same handlers, no animation, buttons ≥ 56 px.
- [ ] **Step 6: Verify.**
  - `npx vitest run` → PASS.
  - Preview at 844×390 and 390×844. Take screenshots to show Akiva.

### Task 6: Schedule opens the game, QB pick, Safety

**Files:**
- Modify: `src/app/App.tsx`, `src/app/tabs.ts`, `src/app/BottomNav.tsx`, `src/features/schedule/SchedulePage.tsx`, `src/features/game/LiveGamePage.tsx`, `src/features/game/api.ts` (`useAddScore` types)
- Create: `src/features/game/QbPickSheet.tsx`, `src/features/game/qb.ts`, `src/features/game/qb.test.ts`

**Interfaces:**
- Produces:
  - `lastQbFor(teamId: string, games: Game[]): string | null`, for the default pick.
  - The route `/game` redirects to the next unfinished game in the active season, or to `/schedule` if there is none.

- [ ] **Step 1: Tests.** `lastQbFor` returns the QB from the team's most recent game on either side, or null.
- [ ] **Step 2: Implement.**
  - The Game tab is removed from `tabs.ts` and the bottom bar.
  - Each schedule row links to `/game/:id`.
  - The game page's main button says "Go live". It becomes "Box score" once the game is final.
  - Before the first start, if `home_qb_id` or `away_qb_id` is empty, `QbPickSheet` asks "Who plays QB for <team>?" with Maurice and Eddie, defaulting from `lastQbFor`.
  - Add a "Safety +2" button for each team.
  - `useAddScore` sends `clock_seconds` along with `half`.
- [ ] **Step 3: Verify.** Tests and typecheck PASS. Then click through on preview: Schedule → game → Go live → pick QBs → clock runs.

### Task 7: Stat pad groups and stat time

**Files:**
- Modify: `src/features/game/LiveStatsPanel.tsx`, `src/features/game/BoxScorePanel.tsx`, `src/features/game/api.ts` (`useLogStat` sends `clock_seconds`), `src/features/players/positions.ts` (add `OL/TE` and `DL`)
- Create: `src/features/game/statGroups.ts`, `src/features/game/statGroups.test.ts`

**Interfaces:**
- Produces:
  - `groupsFor(positions: string[], isQb: boolean): StatGroup[]`. QB → `['qb']`. `OL/TE` → `['receiving','line']`. `WR` → `['receiving']`. `DL` → `['defense']`. Always followed by `defense` and `kicks`, with duplicates removed.
  - `statTimeLabel(half: number | null, clockSeconds: number | null): string | null`. Examples: `(2, 252)` → `"2nd · 4:12"`, `(3, 30)` → `"OT · 0:30"`, `(1, null)` → `null`.

- [ ] **Step 1: Tests** for both functions with those exact values.
- [ ] **Step 2: Implement.**
  - The pad shows the player's groups first, then an "All stats" toggle.
  - Only Season 2 active stat types appear.
  - Each tap sends the `half` and `clock_seconds` of that moment while the game is live.
  - The box score shows `statTimeLabel` in each player's game log.
  - A limit error (`MLF_LIMIT:label:max`) shows "That's more than <max> <label> for one game. Check the number."
- [ ] **Step 3: Verify.** Tests PASS and preview tap-through works.

### Task 8: Subs stay, minutes by hand

**Files:**
- Modify: `src/features/game/LiveStatsPanel.tsx` (replace the `addedSubs` state), `src/features/game/lineup.ts` (`playerMinutes` prefers typed minutes), `src/features/game/BoxScorePanel.tsx`
- Create: `src/features/game/subs.ts` (`useGameSubs`, `useAddGameSub`, `useRemoveGameSub`), `src/features/game/subs.test.ts`

**Interfaces:**
- Produces: `teamListWithSubs(roster: Player[], subs: GameSub[], statPlayerIds: string[]): { p: Player; sub: boolean }[]`.
- `playerMinutes()` gains a `typed: Map<string, number>` argument. A typed value replaces the tracked minutes for that player.
- Realtime: add `game_subs` and `player_minutes` to the `useLiveGame` channel.

- [ ] **Step 1: Tests.**
  - A sub with no stats is still listed.
  - A voided sub is not listed.
  - Typed minutes override tracked minutes.
- [ ] **Step 2: Implement.**
  - "Add sub" inserts a `game_subs` row.
  - "Remove sub" asks "Remove <name> from this game? Their stats stay." and voids the row.
  - The box score gets a "Set minutes" action for players without tracked minutes.
- [ ] **Step 3: Verify.** Tests PASS. On preview, add a sub, reload, and the sub is still there.

### Task 9: Keep screen on

**Files:**
- Create: `src/features/game/wakeLock.ts`, `src/features/game/wakeLock.test.ts`, `src/features/game/KeepAwakeButton.tsx`
- Modify: `src/features/game/LiveGamePage.tsx`

**Interfaces:**
- Produces: `shouldHoldWakeLock(wanted: boolean, status: GameStatus, visible: boolean): boolean`. It is true only when `wanted && status === 'live' && visible`.
- `useKeepAwake(wanted: boolean, status: GameStatus)` requests `navigator.wakeLock` when the result turns true, and releases it when false. It re-requests on `visibilitychange`.
- `KeepAwakeButton` is hidden when `!('wakeLock' in navigator)`. Its label is "Keep screen on" (pressed state: "Screen stays on").
- `wanted` is kept per game in `sessionStorage`, wrapped in try/catch.

- [ ] **Step 1: Tests** for `shouldHoldWakeLock` covering live, halftime, final and hidden.
- [ ] **Step 2: Implement.** Use a small, quiet icon button in the game header. Battery (spec C7): while a game is `live`, set `data-live` on `<html>`; in `base.css`, `[data-live] body::before, [data-live] body::after { animation-play-state: paused }`.
- [ ] **Step 3: Verify.** Tests PASS. In preview, check the request fires in the console (wake lock state shows in DevTools).

### Task 10: Forced password change

**Files:**
- Modify: `src/features/auth/AuthProvider.tsx`, `src/features/auth/auth-context.ts`, `src/features/auth/AuthGate.tsx`, `src/features/auth/ChangePasswordForm.tsx`
- Create: `src/features/auth/mustChange.ts`, `src/features/auth/mustChange.test.ts`

**Interfaces:**
- Produces: `needsNewPassword(typedLength: number | null, flag: boolean): boolean`. It is true when the flag is set or the typed length is under 8.
- `Member` gains `mustChangePassword: boolean`, read from `member_logins`.
- `signIn` records the typed length in memory only (never stored).
- After a successful change, call `clear_my_password_flag()`.

- [ ] **Step 1: Tests:** `(7, false)` → true, `(8, false)` → false, `(null, true)` → true, `(null, false)` → false.
- [ ] **Step 2: Implement.** `AuthGate` shows only a "Choose a new password" screen (title case is fine as a page title), with the existing form requiring 8+ characters. Inline error: "Password must be at least 8 characters".
- [ ] **Step 3: Verify.** Tests PASS.

### Task 11: Final checks and Akiva checkpoint

- [ ] **Step 1: Run the checks.** `npx tsc --noEmit -p .`, `npx vitest run` (all PASS) and `graphify update .`. Remove the `spec-view` entry from `.claude/launch.json`.
- [ ] **Step 2: Run a full test game** on the local dev server against a local or test copy, never the live league. Cover start, a sub with no stats, stats with times, halftime with wake lock released, the 2nd half, the clock running to 0, and final.
- [ ] **Step 3: Whole-change review** by a fresh reviewer on Opus (superpowers:requesting-code-review), plus `/security-review` on the RLS changes.
- [ ] **Step 4: Give Akiva plain click steps**, then STOP and wait at each one:
  1. Paste `008_season_2.sql` into the Supabase SQL Editor and run it.
  2. Paste `data/private/season-2-import.sql` and run it.
  3. In Authentication → Providers → Email, set the minimum password length to 8.
  4. Reset temporary passwords for every login except `akiva` and `leo`, and add logins for the new players.
  5. Claude runs one SQL to mark Akiva `is_owner`, link the new logins and set `must_change_password`. No passwords are involved.
  6. Ask "OK to sign everyone out now?" Only on yes, revoke all sessions.
  7. Ask whether to commit and push. Commit only on yes, with Akiva's identity and no Claude credit.
