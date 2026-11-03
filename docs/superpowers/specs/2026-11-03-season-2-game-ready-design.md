# Season 2, Part 1: game-ready by Sunday Nov 8 (design spec)

**Status:** design approved in chat by Akiva on 2026-11-03 ("Yes, write the spec"). This written spec is waiting for his review.
**Part of:** the Season 2 revamp, built in three parts, each with its own spec:
1. **This spec:** Season 2 data, permissions, and game-day fixes. Must work on Sunday Nov 8, 2026.
2. Redesign: fantasy-style team and matchup pages, MVP page, rulebook screen, Liquid Glass, animation, merged pages.
3. Prediction and ranking engine: per player and per team, set before each game, with a way to change who plays whom.

Part 1 changes as little of the look as possible. Screens get rebuilt in Part 2, so Part 1 must not pour effort into visuals that Part 2 will replace.

**Rules that always apply:** `CLAUDE.md` (private data only in `data/private/`, Row Level Security everywhere, void instead of delete, stats as event rows, tokens only, Phosphor icons through `src/ui/Icon`, no animation on the clock, score or stat pad beyond a press scale, game buttons at least 56 px, commit only when Akiva asks, no Claude credit in git).

**Where this differs from the approved plan docs:** Akiva's 2026-11-03 request changes three things in `docs/checkpoint-0-database-plan.md`. (a) "Any logged-in friend can edit anything" no longer holds for profiles or for stats outside live games (section B below). (b) Safeties now exist. (c) Half length now depends on the season. The plan doc gets updated to match in the same change.

---

## A. Season 1 archived, Season 2 set up

### A1. Seasons
- Rename the season "2026 season" to **Season 1** and set its status to `finished`. Its games, scores, lineups, clocks and stats are untouched.
- "Earlier totals" stays as it is: history only, not counted in standings.
- Create **Season 2**: status `regular`, `starts_on` 2026-11-08, `ends_on` 2027-01-03, 18 regular games planned plus a final.
- The **active season** is the one season that is not `finished` and not voided. The existing `current_season` view must return Season 2 after this change. Check that every view built on it (standings, player projections, leaders) then counts Season 2 only.
- **Season rules move onto the season.** Add `half_minutes`, `halftime_minutes` and `overtime_minutes` to `seasons`. Season 1 gets 10 / 7 / null (null means no overtime length was ever set). Season 2 gets 12 / 7 / 8. The clock reads its length from the game's season, not from `settings.half_minutes`. The old setting stays as a fallback only.
- A **season switcher** (a plain select at the top of Standings, Schedule and the player profile) lets anyone view Season 1. It defaults to the active season. Part 2 restyles it.

### A2. Teams belong to a season
- Add `season_id` to `teams` (not null after backfill). The 3 old teams are set to Season 1.
- Team names stay unique within a season, not across all seasons.
- Replace the `color_key` check (`demons`, `daybies`, `tigers`) with the new keys `gooners`, `sucks`, `spicy` and `shpitzy`, plus the old three. Each gets a token in `tokens.css`.
- The 4 new teams:

| Team | Short name | Captain | Players | Colour (unconfirmed) |
|---|---|---|---|---|
| Mair's Team Sucks | SUCKS | Leon Souid | Moshe Lahav, Norman (last name to confirm), Michael Bensimon | red |
| Torj's Spicy Feet | SPICY | Mair Salman | Joseph Torjman Thomas (JTT), Eddie Rasp, Akiva Yevdayev | orange |
| Shpitzy Etshalom | SHPZ | David Kopolovitz | Ben Haber, Max Simovitch, Morris Kurtz | blue |
| Golden Gooners | GOON | Lawrence Kurtz | Aaron Ozone, Ariel Levy, Chaimy Salman | gold |

- Add `captain_player_id` to `teams`. The app shows a "C" badge next to the captain.
- Short names are my suggestion. Akiva can change them in the app.

### A3. Players
- **New players:** Moshe Lahav, Joseph Torjman Thomas (nickname JTT), Norman, Michael Bensimon, Ben Haber, Aaron Ozone, Eddie Rasp.
- **Maurice Cohen:** changes from a guest to a real player (`is_guest = false`). He gets a login name of `maurice`, positions `{QB}`, and no team.
- **Backups:** Joseph Cohen (for Moshe) and Ilan Gorbatov (for David) are added as players with no team and the note "Backup". Either can be picked as a sub with one tap, the same way guests are now. Ilan's details arrived 2026-11-03 (private file). Michael's arrived too. Joseph Cohen's and Ben's come later.
- Season 2 roster memberships start on 2026-11-08. Season 1 memberships end on 2026-11-07, so every Season 1 game still shows who played for whom.
- **Private details** (jersey, birthday, height, weight) for the 6 new players Akiva listed go into a new gitignored file, `data/private/season-2-import.sql`. Only the birth **year** is stored, as before. Jersey numbers are not private, but they ride in the same file so there is only one import.
- **Positions:** add `OL/TE` and `DL` to the position list in `src/features/players/positions.ts`. QB, WR, DL and so on stay the same codes.

### A4. Schedule
- 18 games in Season 2. Every game is at Marine Park (the default field). Start times are 12:15 pm and 1:45 pm New York time on each Sunday. "David" means David's team, and so on.

| Week | Date | 12:15 | 1:45 |
|---|---|---|---|
| 1 | Nov 8 | Shpitzy v Gooners | Sucks v Spicy |
| 2 | Nov 15 | Gooners v Spicy | Shpitzy v Sucks |
| 3 | Nov 22 | Gooners v Sucks | Shpitzy v Spicy |
| 4 | Nov 29 | Sucks v Spicy | Shpitzy v Gooners |
| 5 | Dec 6 | Shpitzy v Sucks | Gooners v Spicy |
| 6 | Dec 13 | Sucks v Gooners | Spicy v Shpitzy |
| 7 | Dec 20 | Sucks v Spicy | Shpitzy v Gooners |
| 8 | Dec 27 | Gooners v Spicy | Shpitzy v Sucks |
| 9 | Jan 3 | Gooners v Sucks | Shpitzy v Spicy |

- The first-named team is `home`. Each pair of teams meets 3 times.
- **Final:** a `kind = 'playoff'` game with slots `rank:1` and `rank:2`, no date yet. A tied final goes to overtime (8 minutes; see A5).
- Times stay easy to change, as today.

### A5. Rulebook rules the app needs (Season 2 only)
- **Scoring types:** add `safety` = 2 points. TD = 6, 1-point and 2-point conversions stay.
- **Score buttons:** +6, +1, +2 and **Safety +2**. A safety is credited to the defending team.
- **Halves:** 12 minutes each. Overtime is 8 minutes, then sudden death (the clock just shows overtime; no automatic winner logic).
- **QBs:** each game records which QB plays for which side: a new nullable column on `games` for each side, `home_qb_id` and `away_qb_id`. The game screen asks for it before kickoff, defaulting to the last game's pick for that team. A QB's stats count for him; his team for that game is the side he played on.
- The rulebook text itself is shown in Part 2. Part 1 only stores what the stats need.

### A6. Stat types (counts only, no yards)
The old stat types stay (Season 1 uses them). New ones are added. Each is tagged with a **group** so the stat pad can show the right buttons for the player's position.

| Group | Stats |
|---|---|
| QB | completion, incompletion, pass TD, interception thrown, QB run, QB rush TD, rollout, sack taken, fumble, fumble lost, passing first down, rushing first down |
| Receiving (WR and OL/TE) | target, reception, receiving TD, drop, first-down catch |
| Line (OL/TE) | sack allowed, pressure allowed, successful block, blocking penalty |
| Defense | sack, interception, pass defended, forced fumble, fumble recovery, safety, two-hand touch |
| Kicks and punts | kickoff return, punt return, return TD, touchback, onside recovery, kickoff, punt |
| Team | penalty, first down, turnover |

- Add `stat_group` (text) and `max_per_game` (smallint) to `stat_types`. Stat types used only in Season 1 (for example the old-sheet conversion) are hidden from the Season 2 pad with `active = false`. They still show in Season 1 history.
- Reuse existing ids where they mean the same thing (`rec`, `target`, `drop`, `int`, `fumble`). The receiving TD and other new ids are listed in the migration.
- Fantasy points for the new stats are **not** set in Part 1. Part 3 builds the engine. Until then the new stats count 0 fantasy points, so Season 2 projections are only rough.

### A7. Lineups
- Season 1 had 2 team players on the field plus Eddie at QB, with the third player subbing in (`ON_FIELD = 2` in `src/features/game/lineup.ts`).
- Season 2 follows the same pattern. The rulebook's "four players on the field" means the QB plus 3 of the team's 4 players (2 WRs and the OL/TE). The fourth player subs in. So `ON_FIELD` = 3 for Season 2 and 2 for Season 1, read from a new `seasons.on_field` column.
- `lineups.on_field` already allows 1 to 3 players, so it needs no change.
- A lineup lists only the team's own players. The QB is stored per game (A5).
- Not confirmed by Akiva (G6). If all 4 team players are always on the field, set `on_field` = 4 for Season 2 and widen the check to 1 to 4.

---

## B. Who can change what

### B1. Roles
- **Owner:** Akiva. Add `is_owner boolean` to `member_logins`, true only for Akiva's login. Add `app_private.is_owner()` alongside the existing `is_league_manager()`.
- **League manager:** Eddie, unchanged.
- **Member:** everyone else.

### B2. Profiles (`players` table)
- A member may update **only their own** player row (the row linked to their login in `member_logins`).
- The owner may update any player row, and add or void players.
- The league manager has no extra rights here.
- Guests and backups have no login, so only the owner can edit them. Adding a quick guest during a live game stays open to everyone, because it is game-day data. It is the one exception.

### B3. Stats (`stat_events`, `score_events`, `lineups`)
- While the game's status is `live` or `halftime`, any member may add, change or void stats, scores and lineups for that game.
- At any other time (`scheduled` or `final`, or a line with no game), only the owner and the league manager may.
- **Limits:** a trigger rejects a stat line if it would push that player's total for that stat in that game above the stat type's `max_per_game`. The defaults are generous: touchdowns 15, receptions 40, targets 60, and so on. The error message says which limit was hit. The owner and league manager can change the limits.
- Score lines: at most 30 per team per game.

### B4. Everything else
- Schedule, games, rosters, trades, teams, injuries, news and settings stay editable by every member, as today. Akiva has not answered this yet; if he says otherwise, it becomes one policy change.

### B5. Passwords and accounts
- **Forced change:** on sign-in, the app checks the length of the password just typed. If it is under 8 characters, or the login's `must_change_password` flag (new column on `member_logins`) is true, the app shows only the "Choose a new password" screen until a new password of 8+ characters is saved. Saving clears the flag through a small security-definer function that only lets you clear your own flag.
- Supabase's minimum password length is raised to 8 in the dashboard (Akiva does this; steps provided).
- **Accounts:** Akiva follows click steps provided in chat:
  1. Reset the password of every existing login except `akiva` and `leo`, using a temporary password he chooses.
  2. Add logins for the new players (`moshe`, `jtt`, `norman`, `michael`, `ben`, `aaron`, `eddierasp`, `maurice`; names to confirm) with temporary passwords.
  3. Each gets linked to their player and flagged `must_change_password`.
  4. Passwords are never typed to Claude or put in code or git.
- **Sign everyone out:** after the accounts are ready, and only with Akiva's OK at that moment, revoke every session in Supabase (this signs out Akiva and Leo too). Everyone then signs in again.

---

## C. Game day

### C1. Schedule opens the game
- Tapping a game in Schedule opens `/game/:id`. It shows the two teams, the score, the time and a large **Go live** button (Box score once final).
- The separate Game tab is removed from the bottom bar. Its route redirects to the next game, so old links still work.
- The bottom bar keeps the other tabs until Part 2.

### C2. Clock
1. **Bug: the clock stops by itself with a minute or two left.**
   - The cause is not yet known. Diagnose it first: reproduce with a 3-minute test game on a local dev server, watch the stored clock rows, and check the realtime updates and the phone sleeping.
   - A likely suspect is the phone locking and a stale screen sending a "pause" with old numbers, but this must be shown, not assumed.
   - Then fix it with a test that fails before the fix and passes after.
2. **The clock keeps running until time is up.** At 0:00 it stops on its own, shows "End of half" (or "End of game"), and waits for a tap. Nothing else stops it.
3. **No team picker on the clock screen.** Both teams always show, side by side, each with its score buttons.
4. **Landscape:** when the phone is sideways, the clock fills the middle with each team's score and buttons on either side. Same functions, no animation. Buttons stay at least 56 px.

### C3. Keep screen on
- A small, discreet button on the live game screen uses the browser's Screen Wake Lock.
- When on, the screen stays awake while the game is live. It releases at halftime and at final. If it was on before halftime, it turns back on when the 2nd half (or overtime) starts.
- The browser drops the wake lock whenever the app goes to the background, so the app asks for it again when it comes back into view.
- If the phone does not support it, the button is hidden.

### C4. Subs and minutes
- **Subs stay.** A sub added to a game stays in that game's lineup and box score even with no stats. They are removed only if someone taps **Remove** and confirms; Remove voids the row, it does not delete it.
  - Cause found 2026-11-03: subs added in `LiveStatsPanel.tsx` are kept only in the screen's memory (`addedSubs` state). A reload or another phone forgets them unless they have stats.
  - Fix: a new table, `game_subs` (game, team, player, voided), with the same rules as stats (B3).
- **Minutes by hand:** in the box score, any player with no tracked minutes can have minutes typed in.
  - Stored in a new table, `player_minutes` (game, player, minutes, voided), with the same rules as stats (section B3).
  - Typed minutes take the place of lineup-tracked minutes for that player and game.

### C5. When each stat happened
- Add `clock_seconds` (seconds left in the half) to `stat_events` and `score_events`, next to the existing `half`.
- A stat logged during a live game saves the clock time at that moment. A stat added outside a live game leaves it empty.
- The box score and the player's game log show it, for example "2nd · 4:12".

### C6. Stat pad for Season 2
- Pick a player, and the pad shows that player's position groups first (QB stats for the QB, Receiving and Line for OL/TE, and so on). An "All" choice shows every group.
- Every button stays at least 56 px with press scale only.
- Kickoffs, punts and safeties are on the pad.
- Each tap is still one event row with a client-made id, so resends can't double count.

### C7. Design rules for the Part 1 screens
These cover the screens Part 1 adds or changes: the game page, the landscape clock, the keep-screen-on button, the stat pad groups and the password screen. They come from the design skills Akiva named on 2026-11-03: apple-design, emil-design-eng, ux-writing, liquid-glass-web, design-excellence, design-guide and ui-ux-pro-max. Part 2's spec applies the same skills to the whole app.

- **One main action per screen.** The game page's main action is Go live (Box score once final). Everything else is quieter.
- **Press feedback happens on touch-down.** A press scales to 0.97 over 100 to 160 ms. That is the only motion on the clock, score buttons and stat pad (CLAUDE.md rule).
- **Glass only where it helps.**
  - The game page header and the landscape score bar use the existing glass tokens.
  - Never glass inside glass. At most 5 blurred surfaces on screen.
  - Always the `-webkit-` prefix, plus a solid fallback for when blur is unavailable or "Reduce Transparency" is on.
  - The clock digits sit on a solid surface so they stay sharp and easy to read in sunlight.
- **Battery:**
  - No looping animation on the live game screen. The moving background lights pause while a game is live.
  - The clock redraws once a second, not every frame.
  - Wake lock is on only while the button is on and the game is live.
- **Text** (ux-writing):
  - Buttons are a verb plus an object in sentence case: "Go live", "Keep screen on", "Remove sub", "Save new password".
  - Errors say what failed and what to do. Example: "Couldn't save that stat. Check your signal and try again." Another: "That's more than 15 touchdowns for one game. Check the number."
  - Statuses always pair colour with words, never colour alone.
- **Sizes:** game-screen buttons are at least 56 px tall, other buttons at least 44 px, and body text at least 16 px. Every colour, size and timing comes from `tokens.css`.
- **Reduced motion and reduced transparency** settings are respected everywhere.
- **Check before showing Akiva:** portrait and landscape on a phone-sized screen, and the installed app on the iPhone simulator.

---

## D. Testing and checks
- Database: extend the PGlite tests in `supabase/tests`. Cover: a member can edit only their own profile; the owner can edit anyone; stat rules in live versus final games; the per-game limits; the season switch in `current_season`; the per-season on-field count.
- App: Vitest for the clock bug, the wake-lock state rules, subs staying, the stat-time label and position groups.
- `npx tsc --noEmit -p .` and `npx vitest run` pass.
- Run `graphify update .` after the code changes.
- Manual check on the local dev server: a full 2-minute test game in Season 2, start to final, with a sub who has no stats.
- Migration: one new file, `supabase/changes/008_season_2.sql`, safe to run once. It is tested on PGlite before Akiva pastes it into the Supabase SQL Editor. The private import is a separate file in `data/private/`.

## E. Order of work
1. Migration 008 and its tests (seasons, teams, players, stat types, permissions, limits, minutes, stat times).
2. Private import file for the new players, rosters and schedule.
3. Clock bug diagnosis and fix, then the clock changes and landscape.
4. Schedule opens the game, QB pick, Safety button, stat pad groups, stat times.
5. Subs stay, minutes by hand, keep screen on.
6. Forced password change screen.
7. Checkpoint with Akiva: he pastes 008 and the import, does the account steps, and then OKs signing everyone out and the commit and push.

Routine pieces (stat type rows, tests, the import file) go to Haiku 5.5 subagents with the full rules in each brief, at most 5 at a time. Claude does the migration's permission rules, the clock bug and the review.

## F. Not in Part 1
- Fantasy-style team, matchup and player pages, MVP page, rulebook screen, Liquid Glass and animation work, merging Standings into Roster: **Part 2**.
- New projections, rankings and the "who plays whom" override: **Part 3**.
- Yards: not tracked (Akiva, 2026-11-03).

## G. Still to confirm with Akiva (built with these defaults until he answers)
1. Team colours: Gooners gold, Sucks red, Spicy orange, Shpitzy blue.
2. Norman's last name: Sabot or Shabot.
3. Schedule, rosters and trades: still editable by everyone (B4).
4. New login names (B5) and team short names (A2).
5. Details for Ben and Joseph Cohen (coming later; Ilan and Michael received 2026-11-03).
6. On-field count: QB plus 3 team players, with the fourth subbing in (A7).

## G. Trades and owner tools (added by Akiva, 2026-11-03)

### G1. Trades
- **Who proposes:** a team's captain, for a trade between **their own team** and another team. David's team has two captains for now: David and Ilan (David can't play for a while).
- **Who decides:** Eddie or Maurice. A proposed trade waits as "Pending". The **first** of them to answer decides: Approve makes it happen (rosters change), Veto cancels it. Neither of them needs the other.
- **Akiva** can do anything (propose, approve, veto, edit or undo a trade).
- Nothing is deleted: a vetoed trade stays in the history as "Vetoed".
- The database enforces all of this, not just the screens.

### G2. Owner tools (Akiva only)
A "Developer tools" screen that only Akiva's login can open (hidden for everyone else; the database refuses everyone else too). "In case something is wrong."
1. **Logins:** every player's login name, with "Set a new password" (a temporary one; the player must pick their own at next sign-in). Passwords can never be read back by anyone: the login system keeps only a scrambled version. This runs as a server function using the secret key held by Supabase, never in the app or in git.
2. **Edit any record:** fix any game, score, stat line, roster line or player.
3. **Edit history:** who changed what and when, with Undo for a change.
4. **Sign everyone out:** asks Akiva to confirm first.
5. **App info:** app version, database status, recent errors.

### G3. Profiles and teams (Akiva, 2026-11-03)
- Everyone can change their own profile, and only their own. Akiva can change anyone's. (Already built in section 2 of change 008.)
- A team's captain can change that team's name, short name and logo. Akiva can change any team. Nobody else can.
- A team can have two captains. David's team has David and Ilan while David can't play. Stored as a second captain on the team.
