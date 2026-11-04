# Premium Liquid Glass UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every main screen an Apple Sports + Liquid Glass look, a Yahoo-style stats table on the Team tab, and five phone-friendly animations, without touching the live game layout.

**Architecture:**
- Glass and type values become tokens in `tokens.css` and classes in `glass.css`, and every screen reuses them.
- The Team table splits into two files: pure functions (`table.ts`, tested) and one component (`TeamStatsTable.tsx`).
- Motion uses the existing tokens, `motion/react` and CSS only.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, TanStack Query, `motion/react` 14.3.0, vaul, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-premium-ui-design.md`

## Global Constraints

- Every colour, size, radius, shadow and timing comes from `src/styles/tokens.css`. No one-off values in components.
- Icons are Phosphor, imported only through `src/ui/Icon`. No emoji.
- No new library.
- The clock, score buttons and stat pad: no animation beyond a press scale.
- Game-screen buttons are at least 56 px tall. Other tap targets are at least 44 px (`--tap-min`).
- Live game screen: colours and glass tokens only, no layout change.
- At most 6 blurred surfaces on screen at once. Never glass inside glass. Never animate `backdrop-filter` or blur radius.
- Every `backdrop-filter` also has `-webkit-backdrop-filter`.
- Fallbacks:
  - `prefers-reduced-transparency: reduce` and no `backdrop-filter` support: near-solid fill.
  - `prefers-contrast: more`: near-solid fill with a clear border.
  - `prefers-reduced-motion: reduce`: fades instead of movement.
- Only `transform` and `opacity` animate. The one exception is the clip reveal in Task 4.
- Copy:
  - Buttons are verb first, 1 to 3 words, sentence case.
  - Success messages use the past tense.
  - Errors say what happened and what to do.
  - No "please", "successfully" or "!".
  - All-caps only for labels of 3 words or fewer above a number.
- Prettier is not used. If formatting is needed: `--single-quote --no-semi --print-width 160`.
- Commits:
  - Use Akiva's git identity.
  - **No `Co-Authored-By` lines and no "Generated with" text.**
  - Push only when Akiva says so.
- After code changes, run `graphify update .`.
- Checks for every task: `npx vitest run`, `npx tsc -b --noEmit`, `npx eslint src`, `npm run build`.

## Review Focus

1. **A player with no stats this week** (or a scheduled game): Pts shows "–", Proj carries the row, and every stat cell is "–". Pinned in Task 3's tests.
2. **Every stat column is zero for the whole team:** only Pos, Player, Opp, Proj and Pts show. There is no empty scroll area. Pinned in Task 3.
3. **Season view for a player with no games this season:** Opp shows games played as 0, Pts shows 0, and stats show "–". Pinned in Task 3.
4. **A live score update while a breakdown is open:** the same row stays open, because state is keyed by player id, not row index. Checked in Task 4's browser step.
5. **Reloading a final game** must not replay the final-whistle shine on that phone. Storage may throw (private mode); then it plays at most once per page load. Pinned in Task 6's test.

---

### Task 1: Glass and type tokens

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles/glass.css`, `src/styles/motion.css`, `src/styles/base.css`
- Modify: `src/components/ui/button.tsx` (the `primary` variant only)

**Interfaces:**
- Produces these CSS classes for later tasks:
  - `glass-hero`: blurred hero card, all five layers.
  - `glass-shine`: adds the top highlight gradient that stands in for the lens edge. Allowed on `glass-list`, `glass-flat` and `glass-hero`.
  - `glass-appear`: entrance from `scale(0.97)` and `opacity: 0` to rest over `--dur-sheet` `--ease-drawer`, using `@starting-style` with a `.rise`-style fallback.
  - `numeral-xl`: big-score type.
- Produces tokens:
  - `--glass-hero-fill`, `--glass-rim`, `--glass-highlight`, `--glass-drop`, `--glass-shine`
  - `--track-display: -0.02em`, `--track-label: 0.04em`
  - `--accent-glass` (accent at 30% in the fill)

- [ ] **Step 1:** Add the tokens to `tokens.css` next to the existing `--glass-*` tokens.
  - Dark values: fill `white` at 8–10%, rim `white` at 15–20% (brighter on top), inner highlight `inset 0 1px 0` white at 15%, drop `0 8px 32px` black at 25%.
  - Reuse existing tokens where one already matches. Do not duplicate.
- [ ] **Step 2:** In `glass.css`, add `glass-hero` with all five layers.
  - Blur 16px with `saturate(1.5)`, using the existing blur token if one is 16px.
  - Add the reduced-transparency, no-support (`@supports not`) and `prefers-contrast: more` fallbacks, matching the pattern of `glass-bar`.
- [ ] **Step 3:** Add `glass-shine` (a top-down highlight gradient layered on the existing background, no blur). Apply it inside `glass-list` and `glass-flat` so every card picks it up.
- [ ] **Step 4:** Add `glass-appear` to `motion.css`, with a reduced-motion variant that is opacity only.
- [ ] **Step 5:** In `base.css`:
  - `.numeral` and `.numeral-xl` get `letter-spacing: var(--track-display)` and tabular numbers.
  - `.caps-label` gets `letter-spacing: var(--track-label)`.
- [ ] **Step 6:** Change the `primary` button variant in `button.tsx` to accent-tinted glass (`--accent-glass` fill, rim, highlight, no blur). Height and press scale stay as they are.
- [ ] **Step 7:** Run the four checks. Expected: all pass, test count unchanged (382).
- [ ] **Step 8:** In the built-in browser at 375×812, open Team, Schedule, MVP and Me.
  - Cards show the shine, primary buttons are tinted glass, and nothing scrolls sideways.
  - Reset the viewport to desktop afterwards.
- [ ] **Step 9:** Commit: `Glass tokens: hero glass, shine on cards, tinted glass primary buttons, number and label spacing`.

### Task 2: Hero cards on every tab

**Files:**
- Modify: `src/features/roster/TeamPage.tsx` (hero section near line 145)
- Modify: `src/features/schedule/SchedulePage.tsx` ("Next up" hero)
- Modify: `src/features/mvp/MvpPage.tsx` (race leader card)
- Modify: `src/features/me/MePage.tsx` (profile hero)
- Modify: `src/features/players/PlayerProfile.tsx` (profile header)
- Modify: `src/features/team/MatchupPage.tsx` (sticky header uses `glass-hero`, without `glass-appear`)

**Interfaces:**
- Consumes: `glass-hero`, `glass-appear`, `numeral-xl` from Task 1.

- [ ] **Step 1:** Give each hero `glass-hero glass-appear`.
  - Keep the `StadiumBackdrop` image behind it where one exists.
  - Inner panels that currently use `glass-on-photo` or `surface-inset` inside a hero must not blur, so there is no glass inside glass.
- [ ] **Step 2:** Use `numeral-xl` for the hero's main number on each tab: record, next game score or time, race leader's points, and the player's season points.
- [ ] **Step 3:** Run the four checks. Expected: all pass.
- [ ] **Step 4:** In the browser at 375×812, on each tab count the blurred surfaces:
  - Run `document.querySelectorAll('*')` filtered by `getComputedStyle(el).backdropFilter !== 'none'`.
  - Expected: 6 or fewer with a sheet open.
  - Reset the viewport afterwards.
- [ ] **Step 5:** Commit: `Hero glass on Team, Schedule, MVP, Me and the player card`.

### Task 3: Team table logic

**Files:**
- Create: `src/features/team/table.ts`
- Test: `src/features/team/table.test.ts`

**Interfaces:**
- Consumes: `WeekRow` and `PointsLine` from `src/features/team/week.ts`, and `GamePoints` from `src/features/mvp/race.ts` (`stats` is keyed by stat code).
- Produces:
  ```ts
  export interface TableColumn { key: string; label: string; title: string; codes: StatTypeId[] }
  export const TABLE_COLUMNS: TableColumn[]
  export type StatCounts = Record<string, number> // keyed by TableColumn.key
  export function weekCounts(row: WeekRow): StatCounts
  export function seasonCounts(games: GamePoints[], playerId: string): { games: number; points: number; counts: StatCounts }
  export function visibleColumns(countsByPlayer: StatCounts[]): TableColumn[]
  export function cell(counts: StatCounts, key: string): string // "–" for zero or missing
  ```
- `TABLE_COLUMNS` in this exact order (key / label / title / codes):
  - `pass_td` / `Pass TD` / `Passing touchdowns` / `['pass_td']`
  - `td` / `TD` / `Touchdowns` / `['td', 'rec_td', 'qb_rush_td', 'return_td']`
  - `rec` / `Rec` / `Receptions` / `['rec']`
  - `int` / `INT` / `Interceptions` / `['int']`
  - `pick6` / `Pick 6` / `Pick sixes` / `['pick6']`
  - `sack` / `Sack` / `Sacks` / `['sack']`
  - `block` / `Blk` / `Blocks` / `['block']`
  - `int_thrown` / `INT thr` / `Interceptions thrown` / `['int_thrown']`
  - `rollout` / `Rollout` / `Rollouts` / `['rollout']`
  - `sack_taken` / `Sack tkn` / `Sacks taken` / `['sack_taken']`
  - `sack_allowed` / `Sack alw` / `Sacks allowed` / `['sack_allowed']`

- [ ] **Step 1: Write the failing tests** in `table.test.ts`:
  ```ts
  it('adds codes into their column', () => {
    const row = { playerId: 'p', isQb: false, position: 'WR', projected: 5, actual: 12,
      breakdown: [{ statTypeId: 'td', value: 1, points: 6 }, { statTypeId: 'rec_td', value: 1, points: 6 }, { statTypeId: 'rec', value: 4, points: 0 }] }
    expect(weekCounts(row)).toEqual({ td: 2, rec: 4 })
  })
  it('gives no counts before kickoff', () => {
    expect(weekCounts({ playerId: 'p', isQb: false, position: 'WR', projected: 5, actual: null, breakdown: [] })).toEqual({})
  })
  it('sums a season for one player only', () => {
    const games = [
      { player_id: 'p', game_id: 'g1', week: 1, points: 10, stats: { td: 1, rec: 3 } },
      { player_id: 'p', game_id: 'g2', week: 2, points: 4, stats: { sack: 2 } },
      { player_id: 'q', game_id: 'g1', week: 1, points: 99, stats: { td: 9 } },
    ]
    expect(seasonCounts(games, 'p')).toEqual({ games: 2, points: 14, counts: { td: 1, rec: 3, sack: 2 } })
  })
  it('gives zeros for a player with no games', () => {
    expect(seasonCounts([], 'p')).toEqual({ games: 0, points: 0, counts: {} })
  })
  it('hides columns that are zero for everyone and keeps the fixed order', () => {
    expect(visibleColumns([{ sack: 1 }, { td: 2, rec: 0 }]).map((c) => c.key)).toEqual(['td', 'sack'])
    expect(visibleColumns([{}, {}])).toEqual([])
  })
  it('shows a dash for zero or missing', () => {
    expect(cell({ td: 0 }, 'td')).toBe('–')
    expect(cell({}, 'rec')).toBe('–')
    expect(cell({ rec: 4 }, 'rec')).toBe('4')
  })
  ```
  Cast the `games` fixture to `GamePoints[]` if extra fields are required by the type.
- [ ] **Step 2:** Run `npx vitest run src/features/team/table.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `table.ts` with the interfaces above.
  - Codes not in any column are ignored.
  - Columns with a zero total are left out of the counts objects.
- [ ] **Step 4:** Run the test again. Expected: PASS. Then run the four checks.
- [ ] **Step 5:** Commit: `Team table: stat columns, week and season counts, hide empty columns`.

### Task 4: Team stats table on the Team tab

**Files:**
- Create: `src/features/team/TeamStatsTable.tsx`
- Modify: `src/features/roster/TeamPage.tsx` (the Players section near lines 212–240, plus the `pointsFor` state and `PointsSheet` use)
- Modify: `src/features/team/WeekRows.tsx` (remove `TeamPlayerRow`, which is no longer used; keep `PointsSheet`, because `MatchupPage` uses it)

**Interfaces:**
- Consumes: everything Task 3 produces; `TeamSide` (`rows`, `onField`) from `useGameWeek`; `useGamePoints(seasonId)` from `src/features/mvp/api.ts`; `useStatPoints()`; `Segmented` from `src/ui/motion`; `fmtPoints`; `opponentOf`.
- Produces:
  ```tsx
  export function TeamStatsTable(props: {
    side: TeamSide
    team: Team
    opponent: Team | undefined
    seasonId: string | undefined
    playerById: Map<string, Player>
    onOpenPlayer(p: Player): void
  }): JSX.Element
  ```

- [ ] **Step 1:** Build `TeamStatsTable`.
  - **Header:** a `Segmented` with label `Stats` and options `week` ("This week") and `season` ("Season"). Default `week`.
  - **Table:** one `<table>` inside a `glass-list rounded-panel` wrapper.
    - The wrapper has `overflow-x: auto`, so only the table scrolls sideways.
    - A right-edge fade shows while more columns are hidden (a mask gradient on the wrapper, removed when scrolled to the end).
  - **Columns:** Pos, Player (`position: sticky; left: 0` with a solid backing token so text doesn't show through), Opp, Proj, Pts, then `visibleColumns(...)`.
    - Week view uses `weekCounts(row)`.
    - Season view uses `seasonCounts(games, id)`. Opp shows the games count, the header changes to `GP` with the title "Games played", and Proj shows the season points per game.
  - **Rows:**
    - Row order is `side.rows` (QB first).
    - Rows are at least `--tap-min` tall, with thin dividers using `--glass-groove`.
    - The Player cell shows the badge, a truncated name, "C" for the captain (`team.captain_player_id`), and "On field" when the player is in `side.onField`.
  - **Header cells:** small grey `caps-label`. Each `<th>` has `<abbr title={col.title}>`, as in `StandingsTable`.
  - **Pts cell:** a button.
    - Before kickoff it shows "–" and is disabled.
    - Otherwise it toggles the inline breakdown for that player.
  - **Inline breakdown:**
    - Open state is a single `openId: string | null`.
    - It renders as a `<tr>` under the row with one `colSpan` cell, listing each `PointsLine` (label from `useStatPoints`, ×count, ±points; same look as `PointsSheet`).
    - It opens with a clip reveal (`clip-path: inset(0 0 100% 0)` to `inset(0)`) plus a fade over `--dur-base` `--ease-out`, and closes over `--dur-fast`.
    - Reduced motion: fade only.
  - **Name cell** calls `onOpenPlayer`.
- [ ] **Step 2:** In `TeamPage.tsx`:
  - Replace the Players `<ul>` of `TeamPlayerRow` with `<TeamStatsTable … />`.
  - Remove `pointsFor` state and the `PointsSheet` use there.
  - Keep the section header ("Players · N").
  - Empty roster keeps today's message: "No one on this team yet. Use Move player to add someone."
- [ ] **Step 3:** Delete `TeamPlayerRow` from `WeekRows.tsx`. Fix any imports.
- [ ] **Step 4:** Run the four checks. Expected: all pass.
- [ ] **Step 5:** In the browser at 375×812 on the Team tab:
  - The table slides sideways while the page doesn't (check `document.documentElement.scrollWidth <= innerWidth`).
  - The name column stays pinned.
  - Week/Season switches the numbers.
  - On a Season 1 final game's team, Pts opens and closes the breakdown under the row.
  - Review Focus 4: confirm by code read that open state is keyed by player id. Do not add stats to a real game to test it.
  - Also check reduced motion with emulation. Reset the viewport afterwards.
- [ ] **Step 6:** Commit: `Team tab: Yahoo-style stats table with This week / Season, pinned names, points breakdown under the row`.

### Task 5: Restyle Schedule, MVP, player card, Me, rulebook, login and sheets, with a copy pass

**Files:**
- Modify: `src/features/schedule/SchedulePage.tsx`, `src/features/mvp/MvpPage.tsx`, `src/features/standings/StandingsSection.tsx`, `src/features/standings/LeagueLeaders.tsx`, `src/features/players/PlayerProfile.tsx`, `src/features/me/MePage.tsx`, `src/features/rules/RulebookPage.tsx`, `src/features/auth/LoginScreen.tsx`, `src/ui/Sheet.tsx`, `src/ui/SectionHeader.tsx`, `src/ui/EmptyState.tsx`, `src/ui/ErrorState.tsx`
- Modify (colours and tokens only, no layout): `src/features/game/LiveGamePage.tsx`, `src/features/game/LiveStatsPanel.tsx`, `src/features/game/BoxScorePanel.tsx`

**Interfaces:**
- Consumes: Task 1 classes.

- [ ] **Step 1:** Schedule week cards become clean rows: time, teams with badges, score or status. The Live and Enter score actions stay in place and get restyled.
- [ ] **Step 2:** MVP, standings, leaders, player card stat tiles and the "Last N games" list:
  - Use the new number style (`numeral` / `numeral-xl`) and the quiet labels.
  - Section gaps move up one spacing step.
- [ ] **Step 3:** `Sheet.tsx` gets the five glass layers (it stays blurred) and `glass-appear` on open. Cards inside sheets use `glass-flat`, never a blurred class.
- [ ] **Step 4:** Copy pass on every file in this task. Change labels and messages only, never behaviour, to match Global Constraints.
  - List each change as `old → new` in the commit body.
  - Error toasts follow "What failed. What to do."
- [ ] **Step 5:** Live game files: swap any colour or glass class for the new tokens. Do not change sizes, layout or animation.
- [ ] **Step 6:** Run the four checks. Expected: all pass. Fix any test that asserts on changed copy by updating the expected text.
- [ ] **Step 7:** In the browser at 375×812, visit every changed screen. Expected: no sideways scroll and tap targets of at least 44 px (56 px on the game screen). Reset the viewport afterwards.
- [ ] **Step 8:** Commit: `Premium restyle: schedule rows, MVP and player card numbers, glass sheets, clearer wording`.

### Task 6: Motion

**Files:**
- Modify: `src/ui/motion/CountUp.tsx`
- Modify: `src/features/standings/StandingsTable.tsx`
- Modify: `src/features/players/PlayerProfile.tsx`
- Create: `src/features/game/finalShine.ts`
- Test: `src/features/game/finalShine.test.ts`
- Modify: `src/features/game/LiveGamePage.tsx` (final score display only), `src/styles/motion.css`

**Interfaces:**
- Produces:
  ```ts
  // finalShine.ts
  export function shouldShine(gameId: string, storage: Pick<Storage, 'getItem' | 'setItem'> | null, seen: Set<string>): boolean
  ```
  - Returns true the first time for a game and records it (key `mlf-final-shine:<gameId>` in storage, plus the in-memory `seen` set).
  - Returns false afterwards.
  - If storage is null or throws, it uses only `seen`.
- `CountUp` gains an optional `from?: 'zero' | 'previous'` (default `'zero'`, so today's callers are unchanged). With `'previous'`, it animates from the last shown value.

- [ ] **Step 1: Write the failing test** `finalShine.test.ts`:
  ```ts
  it('shines once per game', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const seen = new Set<string>()
    expect(shouldShine('g1', storage, seen)).toBe(true)
    expect(shouldShine('g1', storage, new Set())).toBe(false) // a reload: storage remembers
    expect(shouldShine('g2', storage, seen)).toBe(true)
  })
  it('still shines only once when storage throws', () => {
    const storage = { getItem: () => { throw new Error('private') }, setItem: () => { throw new Error('private') } }
    const seen = new Set<string>()
    expect(shouldShine('g1', storage, seen)).toBe(true)
    expect(shouldShine('g1', storage, seen)).toBe(false)
  })
  ```
- [ ] **Step 2:** Run `npx vitest run src/features/game/finalShine.test.ts`. Expected: FAIL. Then implement `finalShine.ts`. Expected: PASS.
- [ ] **Step 3: Final whistle.**
  - In `LiveGamePage.tsx`, when the game's status changes from live or halftime to `final` while the screen is open, and `shouldShine(game.id, safeLocalStorage, moduleSeenSet)` is true, add class `final-shine` to the winning score number.
  - A tie gets no shine.
  - In `motion.css`, `final-shine` is a one-time `scale(1)` → `scale(1.04)` → `scale(1)` plus one highlight sweep over `--dur-shine`. Reduced motion: an opacity pulse only.
  - The clock, score buttons and stat pad are not touched.
- [ ] **Step 4: Standings glide.** In `StandingsTable.tsx`, render team rows as `motion.tr` with `layout` and `transition={houseSpring()}`, keyed by `team_id` (already the key). Reduced motion is covered by the app's existing `MotionConfig reducedMotion="user"`.
- [ ] **Step 5: CountUp.** Implement `from: 'previous'` by keeping the last value in a ref. Use it in `PlayerProfile.tsx` for the totals tiles (Fantasy pts, Games, Pts/game and the stat tiles), so switching Season 1 / Season 2 / Career counts between values.
- [ ] **Step 6: Game list cross-fade.** In `PlayerProfile.tsx`, key the "Last N games" list by the selected scope. It fades in over `--dur-base` `--ease-out` (opacity only).
- [ ] **Step 7:** Run the four checks. Expected: all pass, 2 new test files.
- [ ] **Step 8:** In the browser at 375×812:
  - Switch seasons on Lawrence's card: the numbers count between values.
  - MVP standings render without layout jumps.
  - With reduced motion emulated, nothing slides.
  - The final shine is checked by ending a test game only if Akiva OKs creating one. Otherwise it relies on the unit test and a code read.
  - Reset the viewport afterwards.
- [ ] **Step 9:** Commit: `Motion: standings glide, season switch counts between values, one final-whistle shine per game`.

### Task 7: Final checks

**Files:** none new. Fixes go where the review points.

- [ ] **Step 1:** Run the web-design-guidelines review (fetch `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`) on every file changed in Tasks 1–6. Fix every finding that applies.
- [ ] **Step 2:** Run the four checks. Expected: all pass.
- [ ] **Step 3:** In the browser at 375×812, do one full walk through Team, the matchup page, Schedule, the live game screen (open only, no changes), MVP, the player card, Me, the rulebook and sign-in. Check:
  - no console errors
  - no sideways scroll
  - 6 or fewer blurred surfaces
  - reduced motion and reduced transparency emulation both work

  Take screenshots of Team, Schedule and MVP for Akiva, then reset the viewport to desktop.
- [ ] **Step 4:** Run `graphify update .`.
- [ ] **Step 5:** Commit any fixes (`Premium pass: review fixes`) and ask Akiva before pushing.
