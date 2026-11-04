# Part 2, step 5: premium Liquid Glass look (design spec)

**Status:** design approved in chat by Akiva on 2026-11-04 ("Yes, write it up"). This written spec is waiting for his review.
**Part of:** `docs/superpowers/specs/2026-11-03-part-2-redesign-design.md`, build order step 5 ("look and speed pass across every screen, then a full UX check of each screen on a phone"). Steps 1 to 4 are done.
**Deadline:** nothing in this spec may put Sunday Nov 8 at risk. The live game screen only changes colour.

**Akiva's words:** "a major ui bump from looking like a semi-finished product to a premium webpage… premium liquid glass feel… still keeping it completely usable on a regular phone." Then: "apple sports liquid glass combination. also include the dense stat table style for team in a way like yahoo has it except super clean and neat and nice", "make it Liquid Glass still", and "use also apple liquid glass and apple liquid glass animation directly (also have it work on android devices in that exact way)".

**Rules that always apply:** `CLAUDE.md`. In particular:
- Every value comes from `src/styles/tokens.css`.
- Icons are Phosphor through `src/ui/Icon`.
- The clock, score buttons and stat pad get no animation beyond a press scale.
- Game-screen buttons are at least 56 px tall.
- No new library. Motion (`motion/react`) and vaul are already installed, and this spec uses only those.

---

## 1. What "done" looks like

- Every main screen reads as one premium product: dark, calm, big confident numbers, glass on the parts that float.
- iPhone Safari and Android Chrome look and move the same.
- Scrolling stays smooth on a mid-range Android phone. At most 6 blurred surfaces are on screen at once.
- The Team tab has a clean, Yahoo-style stats table.
- All checks pass: tests, types, lint and build. Every screen is checked at 375 px wide with no sideways page scroll.

## 2. The look (Apple Sports base)

- **Background:** the existing dark stadium backdrop, kept dim so the glass has something rich to sit over.
- **Type:** Barlow Condensed (bold, uppercase) for scores, numbers and team short names. Inter for everything else. Both stay as chosen in the frontend plan.
  - Big numbers get tighter letter spacing (-0.02em). Small labels get slightly looser spacing.
  - Numbers are tabular, so columns line up.
- **Colour:** neutral greys do most of the work, with one accent. Team colours appear only as accents: badge, stripe and the "You" marker.
- **Labels:** quiet grey, small, sentence case. All-caps only for short labels of 3 words or fewer above a number (for example `PTS`, `PROJ`).
- **Spacing:** more space between groups than inside them. Section gaps grow one step on the token scale.

## 3. Liquid Glass

Glass is rebuilt with CSS. It is the same on iPhone and Android because it uses only features both browsers support. The lens-bending edge that iPhone apps have is **left out**: on the web it works only in Chrome, so it would look different on iPhone. A highlight gradient stands in for it.

**Every glass surface has the five layers:** a see-through fill, a blur (where allowed), a bright top rim, an inner top highlight, and a soft drop shadow. New tokens in `tokens.css` hold these values. No component invents its own.

| Tier | Blur | Used for |
|---|---|---|
| Glass (blurred) | yes | top bar, bottom tab bar, sheets, toasts, the hero card at the top of each tab, the matchup sticky header |
| Glass edge (no blur) | no | cards, lists, table wrapper, segmented switches, secondary buttons (the existing `glass-list` and `glass-flat` classes, upgraded with the shine) |
| Solid | no | the live game screen's score, clock and stat pad (`surface-solid`) |

Changes:
- **Hero card (new use of blur):** the big card at the top of Team, Schedule, MVP and Me becomes real glass. That makes 4 blurred surfaces per screen at most (bar, tab bar, hero, plus a sheet or toast when open). There is never glass inside glass. Cards inside a sheet use the no-blur edge.
- **Primary buttons:** accent-tinted glass (accent at about 30% in the fill) instead of a flat solid. Same height and press scale as today.
- **Fallbacks:**
  - Without `backdrop-filter`, or with `prefers-reduced-transparency`, glass becomes a near-solid fill.
  - With `prefers-contrast: more`, glass becomes near-solid with a clear border.
- `-webkit-backdrop-filter` is always sent alongside `backdrop-filter`.

## 4. Screens

### 4.1 Team tab: Yahoo-style stats table
Replaces the current player rows (`src/features/team/WeekRows.tsx`, used by `src/features/roster/TeamPage.tsx`).

- **Above the table:** a `Segmented` switch with **This week | Season**. This week is the default.
- **One table, one row per player.** The QB row comes first, as today.
- **Columns, left to right:**
  - Pos
  - **Player**: badge, name and "C" for captain. This column is pinned and stays visible while the rest slides.
  - Opp: this week's opponent short name. Season view shows games played instead.
  - **Proj**
  - **Pts**: bold, the largest number in the row.
  - Stat columns in this fixed order: Pass TD, TD, Rec, INT, Pick 6, Sack, Blk, INT thr, Rollout, Sack tkn, Sack alw.
- A stat that is zero shows a quiet "–". A column that is zero for every player on the team is hidden.
- **Only the table scrolls sideways,** never the page. A soft fade on the right edge hints that there is more.
- **Look:**
  - Thin divider lines between rows, no boxes.
  - Rows are at least 44 px tall.
  - The header row has small grey labels with the full name as a tooltip and screen-reader text.
  - The whole table sits in one glass-edge (no blur) panel.
- **Taps:**
  - The name opens the player card, as today.
  - Pts opens the points breakdown **inline under the row** (see 5.3) instead of the current sheet.
- Before the game starts, Pts shows "–" and Proj carries the row.
- Live points still update from the existing live data.

### 4.2 Schedule
- "Next up" stays the hero, as glass over the field image.
- Each week card becomes clean rows: time, teams with badges, score or status. The Live and Enter score actions stay where they are, restyled.

### 4.3 MVP tab
- The race, then standings and the final, then league leaders, in that order (as built).
- Restyled to the new type and spacing. The race leader's card is the hero.

### 4.4 Player card
- The profile header is the hero glass card.
- The stat tiles get the new number style.
- The "Last N games" list becomes clean rows.

### 4.5 Me, rulebook, sheets, login
- Restyled with the same tokens.
- Sheets get the glass layers and the "glass appearing" entrance (5.4).

### 4.6 Not redesigned
- **Live game screen:** new colours and glass tokens only. Layout, button sizes and the no-animation rules are unchanged.
- **Developer tools:** inherits the new tokens with no layout work.

## 5. Motion

Values come from the existing tokens:
- `--ease-out`, `--ease-in-out`, `--ease-drawer`
- `--dur-press` 120ms, `--dur-fast` 160ms, `--dur-base` 240ms, `--dur-sheet` 300ms, `--dur-count` 900ms
- `--spring-duration` 0.45 and `--spring-bounce` 0.15 for Motion springs (the `houseSpring` helper)

Only `transform` and `opacity` animate, except the clip reveal in 5.3. Every item has a reduced-motion version that fades instead of moving.

**Kept as is (polish only):**
- the glass bubble that slides between tabs (`BottomNav`, `layoutId="nav-lens"`)
- the spring switches (`Segmented`)
- page fade on route change (`AppShell`)
- one-time entrances (`rise`)
- count-ups (`CountUp`)
- vaul sheets with drag and flick to close
- sonner toasts
- the press scale on buttons

**New:**

| # | Where | What | Why |
|---|---|---|---|
| 5.1 | Standings rows (`StandingsTable`) | Rows glide to their new rank with Motion `layout` and the house spring | Rank changes are readable instead of jumping |
| 5.2 | Player card season switch (`PlayerProfile`) | Totals count from the old value to the new one over `--dur-count`. The game list cross-fades over `--dur-base` | The change of season is visible |
| 5.3 | Team table points (4.1) | The breakdown opens under the row: clip reveal from the top plus fade, `--dur-base` `--ease-out`. It closes the same way, faster (`--dur-fast`). Only one is open at a time | Shows where the points came from without leaving the table |
| 5.4 | Hero cards and sheets | "Glass appearing": scale 0.97 to 1 and opacity 0 to 1 over `--dur-sheet` `--ease-drawer`, once per visit for heroes and on each open for sheets. The blur is not animated (too slow on phones) | The glass arrives like a material |
| 5.5 | Live game, at the final whistle | When a game becomes Final, the winning score lifts (scale 1 to 1.04 and back) with one shine sweep (`--dur-shine`), **once per game** on that phone. It happens after the game ends, so it never touches the clock, score buttons or stat pad while playing | The one celebration moment |

**Dropped from the chat list: hold-to-end-game.** "End game" already opens an "End this game?" sheet with Keep playing / End game. A hold on top of that would only add friction.

**Not animated, on purpose:**
- clock digits, score buttons, stat pad (rule)
- tab taps beyond the bubble (tapped constantly)
- tilt on phones (needs a mouse; it stays desktop-only)
- extra background motion (battery)
- table cell values changing during a live game (people are reading them; the existing single highlight flash on the score stays)

## 6. Words

- Buttons are verb first, 1 to 3 words, sentence case: "Save changes", "Enter score", "Open game".
- Success messages use the past tense ("Game saved"). Errors say what happened and what to do ("Couldn't save. Check your connection and try again."). No "please", no "successfully", no "!".
- Empty states say what goes there and offer the next step.
- Copy is reviewed screen by screen during the build. Only labels and messages change, not what any button does.

## 7. Checks

- `npx vitest run`, `npx tsc -b --noEmit`, `npx eslint src` and `npm run build` all pass.
- New logic gets unit tests: the table's column choice (hide all-zero columns, fixed order) and Week/Season totals.
- Built-in browser at 375×812 for every screen:
  - no sideways page scroll
  - at most 6 blurred surfaces
  - tap targets at least 44 px (56 px on the game screen)
  - reduced motion and reduced transparency checked with emulation
- web-design-guidelines review of the changed files before commit.
- `graphify update .` after the code changes.
- One commit per screen group (tokens and glass, Team table, other screens, motion), each pushed when Akiva says so.

## 8. Out of scope

- Part 3: the projection engine, rankings and the "who plays whom" override.
- Any change to the database, permissions or league rules.
- New fonts or libraries.
