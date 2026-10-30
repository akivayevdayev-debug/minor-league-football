# Minor League Football (MLF): frontend design plan

**Status:** DRAFT for your OK. No app code has been written yet.
**Goes with:** `docs/checkpoint-0-database-plan.md` (the database plan). That plan decides what is stored; this one decides how it looks, feels and is built.
**Checked on:** 2026-10-29. Library versions below were read from npm that day, not from memory.

---

## 0. The short version, in plain language

- It looks like a sports broadcast at night: near-black, a little frosted glass, big condensed numbers. One cyan colour, used rarely, so it always means "look here".
- It is built for thumbs. Anything you tap during a game is at least 56 px tall. Nothing important sits at the top corners of the screen.
- It never shows a stranger anything. Logged out = login box and nothing else.
- Motion is rare and quick. The clock, the score and the stat buttons never animate for show, because you press them hundreds of times a night. Fancy motion lives on the login screen, the home hero and the final-score moment.
- Icons are drawn icons (Phosphor), never emoji.
- Phone first. Desktop is a wider version of the same thing, not a different app.

---

## 1. Technology decisions (and why)

### 1.1 Language and framework

I read your question as: "Which language do I write it in (JavaScript or TypeScript), and do I build it with Next.js, plain React, Vue or something else?" Correct me if you meant something else.

**Decision: TypeScript + React + Vite. Not Next.js, not Vue.**

| Choice | Why |
|---|---|
| **TypeScript** (not plain JavaScript) | Same language as JavaScript, plus a spell-checker for data. If a stat event is missing its player ID, the build fails instead of a wrong number showing up on game night. You don't code, so this is the safety net that lets me change things later without breaking old screens. |
| **React** (not Vue) | Every library you asked for (Phosphor, Motion, vaul, Radix, Ant Design, React Bits) is built for React first. Vue is a fine framework, but we would lose React Bits entirely and fight the rest. |
| **Vite** (not Next.js) | Next.js is built for sites that need a server and search-engine visibility. We have neither: everything is behind login, so Google can't see it anyway, and the database is Supabase. Vite builds plain static files, which Cloudflare Pages hosts for free with no server to keep running. Next.js on Cloudflare runs through an adapter on Workers instead of plain static hosting, which is more moving parts for no gain here. |
| **HashRouter** | Links look like `/#/games/12`. Works on any static host, nothing to configure, refresh never 404s. Every screen and tab still has its own link. |

### 1.2 What about writing a server in Python or Rust?

I read this as: "What if the backend were a server we write ourselves in Python or Rust? Would that be a bit worse, a lot better, or a lot more complicated?"

**Answer: a lot more complicated, and not better for this app.**

- Today there is no server of ours. Supabase is the server: it stores data, handles logins, pushes live updates to every phone, and the database itself enforces the rules (see Checkpoint 0, "the database is the lock").
- A Python or Rust server means we write and host those parts ourselves: login, live updates, security rules, and a computer that is always on. Free always-on hosting tends to sleep or ask for a card (I haven't re-checked current limits, so treat that as unverified).
- Speed is not the problem. Nine friends tapping buttons is tiny traffic. Rust's speed would be wasted; Python would work but needs that always-on host.
- Maintenance: you don't code and I'd be the one fixing it. More code that only I understand is a risk.
- **Where it would make sense:** a small job on a schedule, not a server. Examples: the keep-awake ping, a nightly backup export, or squeezing video clips in Phase 5. Those can be a tiny Python script on GitHub Actions (free) or a Supabase Edge Function / Cloudflare Worker (TypeScript). Decide when we get there.

### 1.3 Libraries, one job each

Rule: **one library per job.** Three UI kits fighting over the same button is how apps end up looking like three apps.

| Job | Library | Notes |
|---|---|---|
| Build + dev server | Vite 8.3.5 | |
| UI | React 19.3.1 | |
| Routing | react-router-dom 7.18.5 (HashRouter) | |
| Styling | Tailwind CSS 4.3.3 (`@tailwindcss/vite`) | All raw values live in `tokens.css` (section 2). |
| Simple controls (look only) | **daisyUI 5.7.50** | Buttons, inputs, badges, tabs, tables, toggles, skeletons, loading. CSS only, no JavaScript. We write one custom theme called `mlf` that maps daisyUI's colours to our tokens. daisyUI ships its own `glass` class, so ours are named `glass-subtle`, `glass-panel`, `glass-strong` to avoid a clash (check at install). |
| Overlays + behaviour (sheets, dialogs, menus, tooltips, selects) | Radix primitives + **vaul** 1.1.2 (bottom sheets) | Keyboard, focus and screen-reader behaviour done properly. daisyUI's own modal/dropdown are not used. |
| Toasts | **sonner** 2.0.8 | |
| Icons | **Phosphor** (`@phosphor-icons/react` 2.1.10) | Hugeicons was the other option you named. Phosphor has football, football-helmet, flag, timer, first-aid-kit, swap, crown and all the others we need (checked one by one). One set only. |
| Animation | **Motion** (`motion/react`, 14.8.0) + plain CSS | CSS for press, hover, fades. Motion only for springs, sheet drags, layout reorders and exits. |
| Animated showpieces | **React Bits** (copy-in, no install) | See 1.4. |
| Dense data tables (later) | **Ant Design** 6.6.8 | See 1.4. Phase 4 only. |
| Data fetching + live updates | `@supabase/supabase-js` 2.118.0 + TanStack Query 5.105.0 | |
| Offline stat queue | idb-keyval 6.3.0 (IndexedDB) | |
| Installable app + offline shell | vite-plugin-pwa 2.0.0 | Confirm it supports Vite 8 at install time. |
| Fonts | Fontsource, self-hosted: `@fontsource/barlow-condensed` 5.3.0, `@fontsource-variable/inter` 5.3.0 | No Google Fonts requests: faster, private, simpler security policy. |

### 1.4 How I will use the three libraries you added

**daisyUI (yes, as the base layer).** Tiny, CSS only, works with Tailwind 4, themeable. It gives us consistent buttons, inputs, tabs and tables without writing each one. Everything is restyled through the `mlf` theme so it matches the glass look. No daisyUI modals or dropdowns.

**React Bits (yes, but fenced).** 215+ animated components and backgrounds, free to use in your app (licence is MIT + Commons Clause: fine for us, it only forbids reselling the components). You copy the files into the project, so there is no dependency to keep updated. Rules:
- Allowed on: login screen, home hero, "Final" result moment, empty states.
- **Banned on:** clock/score screen, stat pad, standings, any list that updates live. Reason: animated backgrounds (many are WebGL) drain phone batteries and make taps feel laggy exactly when you need them snappy.
- Pick 2 or 3 pieces total (for example a subtle background for login, a text reveal for the hero). Every piece is read and edited by me before it goes in, because copied code is code we now own.

**Ant Design (yes, narrowly, and later).** Honest take: it is built for desktop admin tools, it is a very large package (about 49 MB on disk; the shipped size after trimming is much smaller, but I'll measure it), and it has its own look that fights glass. Its real strength is data-heavy tables. Plan: not used at all in Phase 1 to 3. In Phase 4 (Records, Hall of Fame, edit history) it may be used for tables only, on wide screens, loaded lazily so phones that never open those pages never download it. Dark theme via its `ConfigProvider` using our tokens. If it looks wrong or weighs too much when we test, we drop it and use daisyUI tables. Game times use the phone's own date and time picker, which is better on touch than Ant's.

### 1.5 Build order for design

1. Tokens and base styles first (section 2). No screen is built before them.
2. Shared parts (`ui/` folder) with every state.
3. Screens.
4. Checks: web-design-guidelines review, accessibility pass, security pass, animation review, `graphify update .`.

---

## 2. Design tokens (single source of truth)

All of these live in **one file**, `src/styles/tokens.css`. No colour, size or timing is typed anywhere else in the app. Change a token and the whole app follows.

### 2.1 Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#050B14` | page background |
| `--panel` | `#0B1624` | solid panels, behind glass |
| `--accent` | `#20CFFF` | live tag, primary button, active tab, rank 1. Nothing else. |
| `--text` | `#F5F7FA` | main text |
| `--text-2` | `#8795A8` | secondary text and labels |
| `--text-2-strong` | `#A6B2C3` | secondary text on sheets (strong glass) |
| `--danger` | `#FF6B7A` | Out, errors, NOT SYNCED |
| `--warn` | `#FFB347` | Questionable, caution |
| `--ok` | `#3DDC97` | Back, success |
| Team colours | set per team | A 4 px stripe or dot only. Never a button or panel fill, so the single-accent rule holds. |

Contrast I calculated (WCAG AA needs 4.5:1 for normal text):

| Pair | Ratio |
|---|---|
| text on bg | 18.4 |
| text on glass | 14.2 |
| text-2 on bg | 6.5 |
| text-2 on panel | 6.0 |
| text-2 on standard glass | 5.0 to 5.6 |
| text-2 on **strong** glass | **4.3, fails** |
| accent on bg | 10.7 |
| dark text on accent button | 10.7 |
| danger / warn / ok on panel | 6.6 / 10.2 / 10.3 |

So secondary text on sheets uses `--text-2-strong` (about 6:1 by my estimate, re-check when built). The check repeats on real screens at the end.

### 2.2 Type

- **Barlow Condensed** (600 and 700): headlines, team names, scoreboard numerals, rank numbers. Uppercase with slight tracking for labels.
- **Inter** (variable): everything else.
- Scale (rem so system text-size settings work): `label 0.75` (12 px minimum, uppercase, 0.12em tracking, only ever `--text-2` or brighter), `body 1` (16 px), `body-lg 1.125`, `title 1.5`, `headline 2 to 3` (fluid), `score clamp(3.5rem, 18vw, 6rem)`.
- Numbers always use `font-variant-numeric: tabular-nums` so scores, clocks and stat counts never jiggle sideways when they change (confirm Barlow's tabular digits at build).
- Headings use `text-wrap: balance`. Real typographic characters: `…` and curly quotes.

### 2.3 Space, shape, depth

- Spacing steps: 4, 8, 12, 16, 24, 32, 48. More space between groups than inside them.
- Radius: 12 (controls), 18 (panels, the 18 px in your brief), 999 (pills).
- Gap between neighbouring tap targets: at least 8 px.
- Layers (z-index): content 0, sticky header 10, bottom nav 20, sheets 30, toasts 40.
- Safe areas: bottom nav and sheets pad with `env(safe-area-inset-bottom)`; the page is `100dvh`, never `100vh`.

### 2.4 Motion tokens

```
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1)     /* things responding to you */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)    /* things moving on screen */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)     /* sheets */
--dur-press 120ms · --dur-fast 160ms · --dur-base 220ms · --dur-sheet 300ms
```

---

## 3. The glass system

**Background first.** Glass only looks like glass over something. Every screen sits on the dark base plus a very low-contrast ambient layer (soft cyan glow top-left, deep blue bottom-right, optional stadium photo on Home). Without it the panels read as grey boxes.

Three tiers, no one-off values:

| Tier | Fill | Blur | Used for |
|---|---|---|---|
| `glass-subtle` | 5% white | 8 px | list rows, chips, badges |
| `glass-panel` | 7% white | 16 px | cards, bottom nav, header, scoreboard |
| `glass-strong` | 12% white | 24 px | sheets, dialogs |

Every glass surface has five layers: translucent fill, backdrop blur (+ saturate), 1 px semi-transparent border, a faint **cyan** top-edge highlight (your brief) as an inner shadow, and a soft drop shadow.

Hard rules:
1. At most **5 blurred surfaces on screen at once**. The scoreboard, nav, header and one sheet are the budget on game screens.
2. **Never glass inside glass.** A card on a glass panel gets fill and border only.
3. **Never animate the blur.** Only move or fade the whole surface.
4. Always ship the `-webkit-` prefix (iPhone), a solid fallback with `@supports`, and a near-solid version for `prefers-reduced-transparency`.
5. Rows in long lists (more than about 50) are solid, not glass.
6. Test on a mid-range Android, not only an iPhone.

---

## 4. Icons

One set: **Phosphor**. Wrapped in a single `ui/Icon` file with a name-to-icon map, so swapping the icon pack later is a one-file change. Regular weight normally, **fill** weight for the active tab. Icons next to text are decorative (`aria-hidden`); icon-only buttons always get an `aria-label`. Stat buttons always show the word as well as the icon.

I checked that every name below exists in Phosphor. `stopwatch`, `podium` and `stadium` do **not** exist, so I use `timer`, `ranking` and `map-pin`.

| Thing | Icon | Thing | Icon |
|---|---|---|---|
| Receptions | `hand-grabbing` | Standings tab | `ranking` |
| Targets | `target` | Games tab | `football` |
| Drops | `arrow-fat-line-down` | Players tab | `users-three` |
| Touchdown | `football` | Schedule tab | `calendar-blank` |
| Fumble | `warning-circle` | Clock | `timer`, `play`, `pause` |
| Interception | `shield-chevron` | Undo | `arrow-u-up-left` |
| Pick 6 | `lightning` | Edit / change time | `pencil-simple` |
| 1-pt conversion | `number-circle-one` | Injury | `first-aid-kit` |
| 2-pt conversion | `number-circle-two` | Trade | `arrows-left-right` |
| Block | `hand-palm` | MVP / Hall of Fame | `crown-simple` / `medal` |
| Add guest / sub | `user-plus` / `user-switch` | Offline / waiting to send | `wifi-slash` / `cloud-arrow-up` |
| News | `newspaper` | Menu / settings | `dots-three` / `gear-six` |
| Export backup | `export` | Show / hide password | `eye` / `eye-slash` |

---

## 5. Motion rules

Every animation must pass four questions: **How often is it seen? What is it for? Is it under about 300 ms? Does it help or get in the way of reading?** Purpose must be one of: feedback, showing where something came from, showing a state change, bridging an otherwise jarring change, or (only for rare moments) delight.

### 5.1 Surface by surface

| Surface | How often | Decision |
|---|---|---|
| Clock digits | every second | **No animation.** |
| Stat button taps | hundreds a night | Press feedback only: `scale(0.97)`, 120 ms. The count changes instantly. No ticker, no confetti. |
| Score buttons (+6/+1/+2) | dozens a night | Press feedback only. The changed score gets one 200 ms highlight fade on its container. |
| Bottom nav switching | tens a day | Colour and icon fill swap. No sliding indicator. No page-slide between top-level tabs. |
| Drilling into a game or player | many a day | 180 ms fade with 8 px rise, `--ease-out`. Back reverses it. |
| Bottom sheets | occasional | vaul, 300 ms `--ease-drawer`, drag with velocity, rubber-band at the edges, can be interrupted. |
| Toasts | occasional | Enter and leave the same edge. CSS transitions, not keyframes, so quick repeats retarget smoothly. |
| Standings reorder | occasional | Motion `layout`, so rows glide to the new rank instead of teleporting. |
| MVP reorder by Eddie | rare | Drag to reorder with neighbours shifting. Up/down buttons as the non-drag way. |
| Loading | often | Skeleton shapes that match the final layout, so nothing jumps. |
| Login, home hero, Final result, empty states | rare | The **only** places for delight. Staged entrance, 30 to 60 ms stagger, React Bits pieces allowed here. |

### 5.2 Rejected ideas (and which question killed them)

- Rolling-number ticker on the live score: it is data you read and act on, and it changes constantly.
- Sliding pill under the active tab: core navigation, repeated all day.
- Confetti on every touchdown: too frequent to be special, and distracts the person logging stats. Final whistle only.
- Parallax on the hero: decoration on a screen people hit every time they open the app.
- Hold-to-confirm for End game: everything is undoable and editable anyway, so a normal confirm sheet is enough and faster on a thumb.
- Phone vibration: iPhone browsers can't do it; Android only, and it would be tiny. Maybe later.

### 5.3 Always-on rules

- Animate only `transform` and `opacity`. Never `transition: all`, never width/height/blur.
- `scale(0)` is never a start state (start from 0.95 plus opacity 0).
- Anything hover-based is wrapped in `@media (hover: hover) and (pointer: fine)`; phones have no hover.
- `prefers-reduced-motion`: keep fades, remove movement. Gentler, not zero. Motion wrapped in `MotionConfig reducedMotion="user"`.
- Popovers grow from the thing that opened them. Dialogs stay centred.
- Use CSS for anything predetermined, Motion only where we need springs, gestures or exit animations.

---

## 6. Who uses it, and when (a quick synthesis of what you told me)

| Moment | Who | What they need | Design consequence |
|---|---|---|---|
| **Game night, live** | Whoever holds the clock; 1 or 2 others logging stats | Speed, big targets, no accidents, works with bad signal | Clock/score and stat pad are the best-made screens in the app. Undo always visible. "NOT SYNCED" impossible to miss. |
| **Between games** | Everyone | Quick lookups: who's playing when, standings, my stats | Home answers "what's next and how are we doing" with no tapping. |
| **Off-night browsing and trash talk** | Everyone, Eddie especially | Rankings, MVP race, records, injuries, news | Rich, readable, a little showy. This is where the design earns its keep. |

Not yet verified with real users: all of this comes from your answers, not from watching friends use it. After Phase 1c we run one real game and adjust.

---

## 7. Screens and flows

**Bottom navigation (4):** Standings · Games · Players · Schedule. A small avatar/menu at the top right opens "More": News, Injuries, Trades, Hall of Fame, Records, Draft board, Settings. Each screen has exactly one primary action. Every tab, filter and sheet that matters is in the link (`?tab=`), so the back button and sharing a link both work.

### 7.1 Login (the front door)
- Logged out, the only thing that exists is this screen. While the app checks if you're already logged in, it shows the dark background and the wordmark only (no flash of other content).
- Fields: **Login name**, **Password** (show/hide eye). Button: **Sign in**. Correct autofill attributes so iPhone and Android password managers work. Paste is never blocked. No auto-capitalising or spell-checking the login name.
- Error (same text for either mistake, so nobody can probe for valid names): "That login name or password isn't right. Check both and try again."
- Logged in but not linked to a player: "Your login isn't linked to a player yet. Ask Akiva to link it." plus a Sign out button.
- Footer link: "Forgot your password? Ask Akiva to reset it."

### 7.2 Home
Dark-overlaid stadium hero (swappable image path), asymmetric layout, no logo.
1. If a game is live: a **Live** card (cyan tag, score, clock). It is the primary action: "Open game".
2. Otherwise: next game with the time and "Open".
3. Below: standings preview, injuries strip, latest news, weekly awards once there are some.

### 7.3 Game page (`#/games/:id`)
Scoreboard header always visible: team names, the two scores in big Barlow numerals, clock, status chip (Scheduled / Live / Halftime / Final), and "Clock: Jordan" or "No one has the clock". Three tabs: **Score & clock · Live stats · Box score**.

**Score & clock tab (thumb-first):**
- Not the clock holder: the clock is read-only and the one big button is **Claim clock** (56 px+).
- Taking it from someone else: a sheet asks "Jordan is running the clock. Take over?" with Take over / Cancel.
- Holder: one big **Start** / **Stop** button, then for each team three buttons **+6 TD · +1 · +2** (each at least 56 px with 8 px gaps), then **Undo last score** and the last three scores in a short list.
- Lower down: a halftime timer (default 7 minutes, adjustable), Start 2nd half, Start overtime (playoff final only), **End game** (confirmation sheet). Ending locks the result into the standings; it can still be edited afterwards.
- Badge: "Score vs logged TDs" when they don't match. Information only, never blocks.
- Offline or failed to save: a full-width banner **NOT SYNCED** in `--danger` at the top of the screen, and the buttons say "Retry". Clock and score never queue silently.
- Screen readers: the ticking clock is hidden from announcements; "2 minutes left", halftime and score changes are announced politely instead.

**Live stats tab:**
1. Team toggle at the top (two teams + "Both").
2. Players as big cards, two per row: jersey number in Barlow, name, a tiny running total. Subs/guests marked "Sub".
3. Tap a player → a **stat pad** slides up as a bottom sheet (about 70% height) and **stays open** across taps. Ten buttons in a 2-column grid, each at least 56 px: icon + word + current count. Each tap adds 1. Order follows Eddie's stat order.
4. At the top of the sheet: the last action in words ("Jordan · Receptions +1") with **Undo**.
5. Tap a count to type a total instead; it records the difference.
6. A team stats row appears if any team-level stat types exist.
7. **Add sub:** choose who they replace → pick an existing guest or type a name → Done. The sub is credited from then on.
8. A small pill shows "3 waiting to send" with a cloud icon when offline; it empties as taps sync.
9. Considering for later: a "by stat" mode (pick Receptions once, then tap players) if one-person logging feels slow. We'll see after a real game.

**Box score tab:** both teams' player lines, scoring timeline, edit history for the game.

### 7.4 Schedule and changing a game time
- Games grouped by week with sticky week headings. Each game row has a time chip with a pencil icon.
- **Change time in 2 to 3 taps:** tap the chip → a sheet with the phone's own date/time picker (the iPhone wheel / Android dial) plus quick buttons: **+15 min · +1 hr · Tomorrow, same time · Next week, same time** → **Save**. A toast says "Moved to Sat 4:30 PM" with **Undo**.
- "Add game" is the primary button at the top of each week. Any number of games per week.
- All times shown in New York time with a clear zone label.

### 7.5 Standings
Rows, not a cramped table: big rank numeral (rank 1 in cyan), team name with its colour stripe, W-L-T, win %, points for/against, difference. An info icon opens a sheet explaining the tiebreakers (head-to-head, point difference, points scored). Designed for 3 teams now and up to 12. Rows glide when ranks change.

### 7.6 Players and profile
- List with search and a sort-by-stat control.
- Profile: photo (or jersey-number placeholder), big jersey numeral, name, position, team stripe, age, height in feet and inches, injury chip, MVP rank, achievements, season/career toggle, stat totals, game log.
- **Eddie only:** pencil icons appear to reorder the stats shown on any profile and to place the player in the MVP race. Everyone else doesn't see these controls (the database also refuses them).

### 7.7 MVP race
Ranked list with formula points and a "Set by Eddie" tag on manually placed players. Eddie's edit mode: drag handle plus up/down buttons on each row, and a sheet for the formula weights.

### 7.8 Everything else (later phases)
Injuries (status chips: Out in danger, Questionable in warn, Back in ok, plus note and expected return), News and comments, Trades, Draft board, Hall of Fame, Records, Projections (always labelled "estimate"), playoff final card, event polls, Highlights. Same patterns: rows, one primary action, sheets for editing.

### 7.9 Settings
Change password, Sign out, **Export everything** (backup), install-the-app tip, app version.

### 7.10 Every screen has all its states
Loading (skeleton), empty (says what to do: "No games this week. Add the first game."), error (says what happened and the fix, never just "Something went wrong"), offline, and long-content cases (long names truncate; text containers can shrink). Button names stay the same through the flow: "Save time" button → "Time saved" toast.

---

## 8. Component list (each ships all states)

States for every interactive part: default, hover (only where a mouse exists), pressed, focus-visible, disabled, loading. Data parts also: empty, error, loading.

| Part | Variants / notes |
|---|---|
| `Button` | primary (accent, one per screen), secondary (glass), ghost, danger; sizes md (44 px) and xl (56 px for game screens) |
| `GlassPanel` | subtle / panel / strong; solid fallback built in |
| `Sheet` (vaul) | default, with sticky footer; strong glass; drag handle |
| `Toast` (sonner) | success, error, with Undo action |
| `Tabs`, `Segmented` | URL-linked |
| `StatButton` | icon + word + count; pressed, pending |
| `PlayerCard`, `TeamStripe` | guest/sub badge |
| `ScoreBoard` | tabular numerals; Final, Live, Halftime, Scheduled |
| `ClockDisplay` | running, stopped, not synced |
| `StatusChip` | live, final, out, questionable, day-to-day, back |
| `TimeChip` | opens the time sheet |
| `Banner` | NOT SYNCED, offline, update available |
| `Skeleton`, `EmptyState`, `ErrorState` | |
| `Field` (input) | label, hint, inline error, show/hide for password |
| `ConfirmSheet` | take over clock, end game |
| `Icon` | the one place that imports Phosphor |

---

## 9. Mobile, installed-app and accessibility details

- **Installed app:** web manifest (name, short name, standalone display, `theme-color` and `background-color` = `#050B14`, 192/512 icons, a maskable icon, and an Apple touch icon). The app icon is a plain "MLF" lettermark in Barlow Condensed. That is not a league logo; if you want something else, tell me.
- iPhone: install via Share → Add to Home Screen (I'll write exact steps). No vibration, and background syncing only happens while the app is open. Android has more freedom.
- Offline: the app shell is cached so it opens without signal. Data is **not** cached by the service worker, only stat taps are held in a queue. Login responses are never cached. A toast says "New version ready. Refresh" when an update lands.
- Touch: `touch-action: manipulation` (no double-tap delay), considered tap-highlight, `overscroll-behavior: contain` in sheets. No gesture is the only way: every drag has a button.
- Never disable pinch-zoom. Text honours system text size. `color-scheme: dark` so scrollbars and inputs match. Safe areas respected for notches.
- Keyboard and screen readers: real buttons and links, visible `:focus-visible` ring (2 px accent, offset), a "skip to content" link, headings in order, labels on every input, errors next to the field with focus moved to the first one, `aria-live="polite"` for toasts, status never shown by colour alone (chips also carry words).
- Reduced motion and reduced transparency honoured (sections 3 and 5).
- Copy: sentence case, plain verbs, numerals for counts, no apologies in errors.

---

## 10. Performance targets

These are targets I'll measure against, not promises yet.
- First load on a mid-range phone on 4G: usable fast. Only the shell, Home and Login code in the first download; other screens load when opened (route-level code splitting).
- Initial JavaScript budget: aim under about 250 KB compressed. If we go over, we find out why before adding more.
- Images: WebP/AVIF, sized for phone, explicit width and height (no layout jumps), the hero preloaded, everything else lazy. Profile photos shrunk on the phone before upload.
- Lists over about 50 rows are virtualised or use `content-visibility: auto`.
- Live updates: one Supabase subscription per open game, closed when you leave. Server data cached with TanStack Query; the stat pad updates optimistically.
- Test on a throttled CPU and a real mid-range Android before calling any phase done.

---

## 11. Frontend security checklist

Checked again with the OWASP Top 10, security-best-practices and slopsec skills when real code exists (those audit code, so they run after Phase 1a and 1b, not on a plan).

1. Only the Supabase **URL and anon key** are ever in the frontend. The `service_role` key never touches the repo, the build, or this chat.
2. No passwords in code, config, git or chat (see Checkpoint 0, section 3). Passwords are typed straight into Supabase.
3. Every table has Row Level Security; the frontend is treated as untrusted. Tested with a logged-out request and with a normal member trying Eddie-only actions.
4. User-written text (news, comments, guest names, notes) is rendered as plain text. No `dangerouslySetInnerHTML`. Links in comments are not auto-trusted.
5. Cloudflare Pages `_headers` file sets a strict **Content-Security-Policy** (scripts from our own site only, connections only to our Supabase project, no framing), plus HSTS, `X-Content-Type-Options`, a locked-down `Referrer-Policy`. Trade-off to confirm: animation libraries write inline styles, so `style-src` needs `'unsafe-inline'`; scripts stay strict.
6. Photo uploads: allow-listed types and a size cap, checked in the browser and again by Supabase Storage rules; files renamed on upload.
7. Fonts self-hosted; no third-party scripts or CDNs, so nobody else can change what runs in the app.
8. Dependencies: exact versions in a lockfile, `npm audit` before each deploy, no packages added without a reason, every copied React Bits file read first.
9. Sessions: Supabase's standard session handling. Signing out with unsent stat taps asks first ("3 stat taps haven't sent. Sign out anyway?") so nothing is lost by accident.
10. Login attempts rely on Supabase's built-in rate limits; error text never reveals which part was wrong.
11. The offline queue stores only stat taps (IDs and numbers), never tokens or passwords.
12. Errors shown to people never include database or code details.

---

## 12. Code layout (deep modules, small doors)

Each folder is a **module**: a lot of work behind a small, simple interface, so a change stays in one place and tests can use the same door the app does.

```
src/
  app/          routes, providers, app shell (nav, banners, sheet host)
  styles/       tokens.css (the only place raw values live), glass.css, base.css
  ui/           the shared parts from section 8, plus Icon
  features/
    auth/       login, session, "not linked" screen
    clock/      useGameClock(gameId) -> { status, remainingMs, holder, actions }
    score/      add / undo score
    stats/      stat pad, logStat(event), offline queue
    games/  schedule/  standings/  players/  mvp/  injuries/  news/ ...
  lib/
    supabase.ts the ONLY file that creates the database connection
    time.ts     all New York time formatting (Intl)
    offline-queue.ts   enqueue(), flush(), pendingCount
  types/db.ts   types generated from schema.sql
```

Design choices:
- **Standings, awards, MVP points, records and projections are worked out in the database** (Checkpoint 0 views). The frontend only reads them, so there is one formula in one place and the app can't disagree with itself. The only real logic the phone owns is the **clock countdown** and the **offline queue**; those get the most tests.
- Features talk to each other through each folder's index file only, never by reaching into each other's insides.
- Swapping the icon pack, the toast library or the colours is a one-file change.
- Screens are short: they assemble parts, they don't contain rules.

### Knowledge graph (graphify)
Once Phase 1a code exists I run `graphify update .` to build the map in `graphify-out/`, and again after each batch of code changes. Before searching code by hand I use `graphify query "<question>"`, `graphify path "<A>" "<B>"` or `graphify explain "<thing>"` first. That is in the project `CLAUDE.md` so every future session does it too.

---

## 13. Which phase builds what

| Phase | Design work |
|---|---|
| **1a** | Tokens, base styles, glass system, Icon wrapper, shell and bottom nav, Login, "not linked", Players list and profile (basic), Teams, Schedule with the change-time sheet, Settings (password, export), PWA manifest and icons, `_headers` security file |
| **1b** | Game page header, Score & clock tab, Claim/Take-over flow, NOT SYNCED banner, clock announcements for screen readers |
| **1c** | Stat pad, subs and guests, offline queue and pending pill, Box score tab, profile stat totals |
| **2** | Standings, Injuries, power rankings, MVP race (Eddie's controls), weekly awards, Home polish |
| **3** | Projections (labelled estimate), event polls, playoff final card |
| **4** | Trades, draft board, Hall of Fame, Records (Ant Design tables only if still justified), News and comments |
| **5** | Highlights and photo uploads |

---

## 14. Skills I used, and ones I did not

**Used for this plan:** design-excellence, liquid-glass-web, apple-design, emil-design-eng, animate, animation-vocabulary, find-animation-opportunities, framer-motion, frontend-design, ui-ux-pro-max, design:design-system, design:research-synthesis (on your answers, since there are no interviews yet), web-design-guidelines (rules read; applied to real files once they exist), apex-craft, codebase-design.

**Not used now, and why:**
- `improve-codebase-architecture`, `pick-ui-library`, `before-building`: not installed on this computer. I covered the same ground with `codebase-design` and by choosing libraries by hand.
- `animate-expo`: for React Native phone apps. This is a web app.
- `cloudflare:agents-sdk`, `k2`, `nextjs-on-cloudflare`, `cf-cli`: for Cloudflare Workers, AI agents and Next.js. This project is static files on Pages. The Cloudflare plugin stays installed for deployment.
- `owasp-top-10`, `security-best-practices`, `slopsec`, `security-review`: they audit real code. Section 11 is the plan; they run on the finished login and database rules.
- `ask-then-build`: used when I write the long-run build prompt.
- Not installed yet: **impeccable** (a design-review toolkit). It would add commands to this project, so I'll only do it with your OK.

---

## 15. What I need from you

1. Your OK on this plan (or changes), especially: TypeScript + React + Vite (section 1.1), the fenced use of React Bits and Ant Design (1.4), and the "no animation on live screens" rule (5.1).
2. Photos in `public/images/`: a hero (stadium) and friend-group shots.
3. Team names and colours, and whether the "MLF" lettermark is fine as the app icon.
4. Yes or no to installing impeccable.
