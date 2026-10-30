# Minor League Football (MLF): Checkpoint 0, the database plan

**Status:** APPROVED by Akiva on 2026-10-29 ("I approve"), with his later answers folded in. Phase 1a is cleared to start. No app code has been written yet.
**Companion:** `docs/frontend-design-plan.md` covers how it looks and which tools build it (TypeScript + React + Vite).
This is written in plain language. A "list" is a table (like one tab of a spreadsheet). A "calculation" is a view (the database works it out for you, nothing is stored). An "action" is a function (one button press that does several things safely at once).

---

## 1. The big ideas

1. **Everything is a log.** A stat tap, a score, an injury report: each one is a new line added to a list. Nothing stores "running totals". Totals, standings, rankings and records are always worked out from the log, so they can never drift out of sync.
2. **Nothing is ever really deleted.** "Delete" means "void" (mark as cancelled). Every change is also written to a history list (who, when, before, after), so any mistake can be undone.
3. **The score is separate from the stats.** One person (whoever holds the clock) presses +6 / +1 / +2. That is the official score. Stats are logged separately. A small badge shows when "touchdowns logged" and "touchdowns scored" don't match. It never blocks anything.
4. **The clock doesn't tick in the database.** Only changes are saved: started, stopped, how many seconds were left. Each phone counts down on its own screen.
5. **The database is the lock, not the screen.** Even if someone skipped the website and talked to the database directly, the rules below still apply.

---

## 2. Who can do what

| Person | What they can do |
|---|---|
| Not logged in | **Nothing.** The database returns nothing. The website shows only the login screen. |
| Logged in but not matched to a player | **Nothing.** Shows "ask the owner to link your login". |
| **Member** (every friend) | See everything. Add, change and void stats, scores, games, schedule, rosters, trades, injuries, news, comments, guests and settings. Claim the clock. Cannot permanently delete anything, cannot edit history, cannot touch the MVP controls, cannot give anyone a role. |
| **League manager** (Eddie) | Everything a member can, **plus** full control of the MVP race (order, formula weights, manual override) and the order stats appear on profiles. You also said Eddie has **general admin powers** (2026-10-29). Until you list what that adds, the extras stay as written here, because every member can already change everything else. The role check is one rule, so adding a power later is a small change. |
| **Owner** (you) | Works in the Supabase dashboard: create or remove logins, reset passwords, give the league-manager role, fix or restore anything. No special powers inside the app, which matches "anyone can change anything". |

---

## 3. How logging in works (**please check this section**)

You asked to choose the passwords yourself and give them to me to hardcode. I won't hardcode passwords in the site, because anyone could read them in the page source and they would sit forever in GitHub. This plan gives you the same control without that:

1. You create the player profile in the app and give it a **login name** (e.g. `jordan`).
2. In the Supabase dashboard you click **Authentication → Users → Add user**, enter that login name and **a password you choose**, and tick auto-confirm. I'll give exact click-by-click steps when we get there.
3. The database automatically matches that login to the player profile with the same login name.
4. Friends sign in with **login name + password**. No email is ever sent.
5. Passwords live only inside Supabase (stored scrambled). They never go in my chat, the code, or GitHub. **Please type them straight into Supabase, not to me.**
6. A friend can change their own password in the app, so you don't have to be the middleman. You can still reset anyone's in the dashboard.
7. Logged-out visitors see only the login box. Nothing else.

Tell friends to pick a password they don't use anywhere else, because you will know it.

---

## 4. The lists (tables)

### League setup
- **Settings:** half length (10 min), halftime length (default 7 min, adjustable per game because yours runs 5 to 10), overtime rule for the final, default field (**Marine Park**), time zone (New York), default scoring, optional "games per week". Anyone can change these, and every change is recorded.
- **Seasons:** each season has a name, dates and a status (regular season, playoffs, finished). The new league in late January is simply a new season. Old stats stay and career stats span all seasons.
- **Scoring types:** Touchdown = 6, 1-point conversion = 1, 2-point conversion = 2. Field goal and safety can be added later with one new line. **New:** "Final score (entered by hand)", used only to bring in games played before the app existed, where we know the final score but not how it was scored.
- **Stat types:** receptions, targets, drops, touchdowns, fumbles, interceptions, pick-6, 1-point conversion, 2-point conversion, blocks. Each has a label, a display order and an on/off switch. Team-level stats (like penalties) are supported, but none exist until you name them. **New:** "Conversion (old sheet, 1 or 2 pt not split)" holds the old spreadsheet's single "Conv" column, because it can't be split into 1-point and 2-point after the fact.

### People and teams
- **Players:** full name, nickname (what the app shows), login name, jersey number (0 is allowed, and it can be blank), **several positions** (e.g. corner, WR, fullback), birth year (age is calculated), height (stored in inches so 5'5.5" works, shown as feet and inches), **weight in pounds**, photo, achievements text, and a "guest" flag. Guests are subs added with one tap, name only, with no login. *(Updated 2026-10-29 from your real roster.)*
- **Teams:** name, short name, colour, optional logo.
- **Roster memberships:** which player is on which team, with a start date and an end date. A trade closes one line and opens another, so old games still show who played for whom. There is no limit on team size. A player can also have **no team** (Eddie, the quarterback and league manager, is like this).
- **Trades:** a record of who moved where and when, with before/after rosters.
- **Injuries:** player, status (out, questionable, day-to-day, back), note, expected return. The newest report per player is the current one.
- **Logins linked to players:** which login belongs to which player, and whether they are a league manager. One login per player.

### Games
- **Games:** season, week, date and time, field, the two teams, status (scheduled, live, halftime, final), regular or playoff. For the playoff final, each team slot says where it comes from, e.g. "rank 1" and "rank 2", and fills in the real team automatically.
- **Game clock:** one line per game: running or stopped, which period (1st half, halftime, 2nd half, overtime), seconds left when it was last started, the server time it started, and who is holding the clock.
- **Score events:** game, team, scoring type, points, who scored (optional), who entered it, when, voided or not. Current score = total of the non-voided lines.
- **Attendance and subs:** for each game, which player is out and which sub or guest replaces them. Stats are credited to the sub. The original player's roster spot never changes.
- **Stat events:** the heart of the system. Each line has a unique ID, the game, the team, the player, the stat type, a number, the half, who entered it, when, and voided or not. One tap on a button adds a line with the value 1. Typing a game total adds a line for the difference. Totals are always worked out from these lines.
- **Record adjustments:** a team's extra wins, losses and ties for a season, entered by hand with a note. Used only to bring in the league's older results that were never written down game by game. Voidable and logged like everything else.

### Community
- **News posts and comments:** anyone can post and comment.
- **Hall of Fame, achievements, draft board:** simple lists anyone can edit.
- **Event polls:** a vote for a special event only (e.g. final MVP). One vote per person, not for yourself. Off in general.
- **Highlights:** photos and clips (Phase 5).

### Safety
- **Edit history:** the database fills this in automatically for every change: who, when, before and after.
- **MVP overrides and weights:** only the league manager can write here.

---

## 5. The automatic calculations (views)

- **Game score and result:** sum of non-voided score lines per team, then win, loss or tie.
- **Standings:** (recorded games plus any record adjustments) wins, losses, ties, win % (a tie counts half), points for, points against, difference. Tiebreakers in order: head-to-head, point difference, points scored. Win % keeps it fair if teams play different numbers of games.
- **Player stats:** per game, per season and career, all from the stat lines.
- **Team power rankings:** a simple, visible formula: win %, point difference per game and form over the last 3 games. The weights are settings.
- **Weekly awards:** worked out automatically, by stat (since QBs have no stats): top receiver (receptions), top scorer (touchdowns), top defender (interceptions, pick-6, blocks).
- **MVP race:** points from stats using weights the league manager controls. His manual order always wins. Players he hasn't placed follow the formula.
- **Records:** all-time bests per stat, in a single game, a season and a career.
- **Projections:** win probability and a projected score from power ranking, recent form and head-to-head history. Labelled "estimate", with a note that it improves as more games are logged.
- **Score vs logged touchdowns badge:** per game, visible to everyone.
- **Playoff final:** rank 1 vs rank 2, filled in from the standings. If it ends tied it goes to **overtime** (regular-season games can still end in a tie). The overtime format is still to be confirmed with you.

---

## 6. The actions (one press, many safe steps)

- Match my login to my player profile.
- Claim, release or take over the clock for a game. Taking over asks "Are you sure?", so two phones can't fight.
- Start and stop the clock, start the 2nd half, end the game. Uses the server's time, so phones with wrong clocks don't matter.
- Add a score (TD / 1 / 2) and undo the last score.
- Log a stat tap. Each tap carries its own ID, so a phone that re-sends after bad signal can never double count.
- Set a player's game total.
- Void or restore anything. Add a guest. Record a trade. Undo from history.

---

## 7. Game night, step by step

1. Anyone opens the game and taps **Claim clock**. Everyone else sees who holds it.
2. They start the clock. Every phone counts down on its own.
3. At a score, the clock holder taps +6, +1 or +2 for a team. **Undo** is always there.
4. Anyone on any phone opens **Live stats**, taps a player (or team) and taps big buttons: Rec, Target, Drop, TD, Fumble, INT, Pick 6, Conv 1, Conv 2, Block. Each tap adds one. The total updates for everyone.
5. If a sub plays, tap **Add sub**, choose the player they replace, then pick or quickly create a guest.
6. A wrong number can be fixed any time, for any game, with no time limit. Every change is recorded.
7. At the end, **End game** (with a confirmation) locks the final score into the standings.

Weak signal: stat taps wait on the phone with a visible "pending" badge and send themselves when the signal returns. Clock and score changes never wait quietly. If a phone is offline the screen says **NOT SYNCED**.

---

## 8. Decisions I made for you (change any of them)

1. Tap buttons add 1 each. I'm dropping the "Already logged this?" warning for taps, because two quick receptions would keep triggering it. It stays only for typed totals.
2. Games per week is **not built in**. Anyone can add as many games to any week as you like (2, 3, whatever), and you can change it any time.
3. QBs have no stats. Interceptions and pick-6 go to the **defender**. Only the **scorer** gets the touchdown.
4. Weekly awards are by stat, not by position.
5. One login per player. Guests never have logins.
6. Profile photos are shrunk on the phone before they upload.
7. Free-plan safety: a small scheduled "keep awake" ping so Supabase doesn't pause the project, and an **Export everything** button as a backup.
8. Imperial units and the New York time zone.
9. A new league starts as a new season, nothing is lost.
10. **Birthdays:** only the birth year is stored (the app shows age). Full birth dates aren't needed to run a league and most of the players are teenagers. Your real data file stays on this Mac in a folder git ignores, so it never goes to GitHub.
11. **Bringing in your history (new):** games already played are imported with their final scores only (one "final score" line per team). The old spreadsheet's stat totals go into an **"Earlier totals" season** that counts toward career stats but **never** toward standings. Nothing has to be re-entered by hand. You confirmed (2026-10-29) that not every earlier game or score was written down, so the league's own records are bigger than the 5 saved scores. **Record adjustments** (section 4) top each team up to the records you confirmed (Tigers 5-1, Speed Demons 4-2, Daybies 0-6; 9 wins and 9 losses, so they balance) without inventing games. The adjustments are the confirmed record minus the 5 saved games: Tigers +2-1, Speed Demons +2-1, Daybies +0-2. That is 4 unrecorded games, so 9 games have been played in total. With 14 in the season, **5 are left** (not 9); Akiva has not confirmed that yet, nor given their dates or pairings.
12. **Eddie:** has a login and a profile, no team, no stats. He is the quarterback for **everyone**, so he never belongs to one team. Confirmed by you.
13. **Team colours** (your picks): Speed Demons red, Daybies blue, Tigers orange. Stored on each team.
14. **Login names:** each friend's first name in lowercase (`akiva`, `mair`, `david`, `lawrence`, `ariel`, `chaimy`, `max`, `morris`, `eddie`), except Leon, whose login is `leo`. Confirmed by you.
15. **Old stat sheet:** the single "Conv" column stays as the old-sheet conversion stat, because the 1-point and 2-point split is not known. Leon's receptions are 48 and drops 24 (your correction).

---

## 9. Build order

- **Phase 1a:** GitHub + Cloudflare Pages + Supabase setup, this schema, **design tokens and the shared look (see the frontend design plan)**, login, players, guests, teams, roster history, **import of your real roster, the played games and the old stat totals**, and a very easy schedule screen where changing a game's time is a couple of taps.
- **Phase 1b:** clock and score screen.
- **Phase 1c:** live stat buttons, subs, offline queue, player profile with totals.
- **Phase 2:** standings, injuries, rankings, MVP race, weekly awards.
- **Phase 3:** projections, event polls, playoff final.
- **Phase 4:** trades screen, draft board, Hall of Fame, records, news and comments.
- **Phase 5:** highlights and photo uploads.

---

## 10. What I need from you

Say **OK** to this, or tell me what to change. In particular check:
- Section 2, who can do what.
- Section 3, the login plan.
- Section 8, the decisions I made for you.
