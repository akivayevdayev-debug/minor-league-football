# Part 2: redesign (draft for Akiva's OK)

**Status:** draft, 2026-11-03. Nothing here is built until Akiva approves it.
**Based on:** Akiva's revamp request (items 3, 5 and 6), the approved plan docs (the MVP race with Eddie's override is already approved in `docs/checkpoint-0-database-plan.md`), and three research passes (MVP pages, ESPN/Yahoo/Sleeper screens, Apple Liquid Glass and live-game UIs). Points the research could not confirm from a real app screen are marked *(unverified)*.
**Rules that always apply:** `CLAUDE.md` (tokens only, Phosphor icons through `src/ui/Icon`, no emoji, game buttons at least 56 px, no animation on the clock, score or stat pad beyond a press scale, nothing deleted, private data only in `data/private/`).

## 1. Tabs: five, one tap each
Today: Roster, Schedule, Standings, Me. New:

| Tab | What it holds |
|---|---|
| **Team** | Your team (fantasy-style), this week's matchup card, quick actions |
| **Schedule** | Weeks and games; a game opens its page; live games go straight to the game screen |
| **League** | Standings, playoff picture, league leaders, all four teams |
| **MVP** | The season MVP race and player of the week |
| **Me** | Profile, rulebook, password, install, Developer tools (Akiva) |

Apple allows 3 to 5 tabs. MVP gets its own tab because Akiva asked for it to be "its own thing", not a submenu.

## 2. MVP tab
- **Leader card** at the top: photo or jersey number, name, team, points per game, games played.
- **Player of the week**: top fantasy points from the latest Sunday, with a one-line reason (for example "3 TDs, 2 picks"). Weeks are listed below the card so you can look back.
- **The race**: a numbered list of every player. Each row shows points per game (big), total points (small), games played, and an up or down arrow with how many places they moved since last week.
- **Who qualifies:** ranked by points per game, Season 2 only. A player must have played at least half of their team's games to be ranked. Those below that show in a short "Not enough games yet" list. This is fair to players who miss a Sunday without letting someone with one big game top the list. *(The rule is our proposal; the research found ladders that use "qualifies after N games".)*
- **Eddie's override (already approved):** Eddie Salem and Akiva can pin a player to a place. Pinned rows show "Set by Eddie". Everyone else follows the formula. This needs one small new database table, readable by all and writable only by the league manager and the owner.
- QBs (Eddie, Maurice) are ranked with everyone, using their QB stats.

## 3. Team tab (ESPN/Yahoo "My Team")
- **Header:** team name, crest, record (W-L), points for and against, and this week's projected score vs actual.
- **Player rows:** position, name, this week's opponent and kickoff time, projected points, actual points (live during games), and a status chip if needed. The QB playing for you this week is shown in its own row at the top.
- Tap a player to open their card. Tap a points number to see how the points were scored *(Sleeper pattern)*.
- A **Team / All teams** switch lets you look at any team, not just your own.
- Text stays full size. ESPN's 2025 redesign drew complaints for cramming rows with small text.

## 4. Matchup page (from the Team tab or a game)
- Your team and the opponent **side by side**, with projected and actual totals in a header that stays pinned while you scroll.
- Player rows facing each other, for example WR vs WR.
- **No win-probability percentage.** With so few games it would mostly be noise. Projected totals only. *(Part 3 builds the real projection engine; until then this uses today's estimates.)*

## 5. League tab
- **Standings** first: W, L, PF, PA and streak, plus a line under the top two for the final.
- The old Standings page goes away, and the Roster tab's team details move to Team. That is the "merge standings into the roster" item.
- **League leaders** (touchdowns, catches, picks, and the new stats) below the standings.

## 6. Player card
- Header: photo or number, name, team, position.
- Season totals, the last nine games, and next game's estimate.
- A Season 1 / Season 2 / Career switch.
- No news feed or trend charts. Too much for a 4-team league.

## 7. Look and speed
- **Glass only where Apple puts it:** the top bar, the tab bar, sheets and one floating button. At most 3 to 4 glass surfaces on screen at once. Cards and lists use the cheaper look that has the same appearance but no blur. That is already done on Developer tools, where it fixed the lag.
- **Live game screen stays solid and flat:** big score numbers, undo always visible, no glass.
- Animate only movement and fading. Pause background motion when the app is hidden. Respect the phone's Reduce Motion and Reduce Transparency settings.
- **Sports-editorial style** (Apple Sports, The Athletic): big condensed numbers, quiet grey labels, team colour as an accent only.

## 8. Build order
1. MVP tab (needs the override table).
2. Team tab and matchup page.
3. League tab (standings merged, old pages retired).
4. Player card.
5. Look and speed pass across every screen, then a full UX check of each screen on a phone.

Each step is checked in the browser on a phone-sized screen and pushed before the next one.

## 9. Questions for Akiva
1. Five tabs (Team, Schedule, League, MVP, Me): OK?
2. MVP qualifying rule: at least half of your team's games. OK, or a different number?
3. Should Maurice also be able to pin MVP places, or only Eddie (and Akiva)?
