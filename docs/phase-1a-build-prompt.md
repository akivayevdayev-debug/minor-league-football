# MLF Phase 1a: build prompt for a new chat

**How to use:** open a NEW chat in the folder `Minor-League-Football`, then copy everything below the line and paste it as your first message. The new chat loads the project rules and memory by itself. It will load its skills as it reaches each stage.

---

You are building **Phase 1a** of Minor League Football (MLF) for Akiva, a friend-group football league app (mobile-first installable PWA). Akiva does not code and dictates by voice, so odd words are probably speech-to-text mistakes: confirm before building on them. Use plain language, give exact click-and-paste steps, and stop at every checkpoint below. At each checkpoint: a 3-line recap, then ONE question (use the ask-then-build layout: question, options A to D each on its own line with a blank line between, then "My pick"). Then wait.

## 1. Read first, in this order

1. `CLAUDE.md` (project rules, loaded automatically) and the memory index (loaded automatically).
2. `docs/checkpoint-0-database-plan.md`: what is stored, who can do what, league rules. Approved by Akiva on 2026-10-29.
3. `docs/frontend-design-plan.md`: look, libraries, tokens, screens, code layout (section 12), security checklist (section 11), and what Phase 1a covers (section 13). Approved the same day.
4. `data/private/league-data.json`: the real roster, played games, standings and old stat sheet. **Private.** It is gitignored. Never commit it, never paste its contents into docs, code or chat summaries.

If code and a doc disagree, or a doc says nothing, stop and ask. Do not redesign anything the plans already decide.

## 2. Skills (load each with the Skill tool when you reach the stage; do not load them all at once)

- **Always on:** `anthropic-skills:apex-craft` (edit don't regenerate, verify before asserting, smallest diff) and `codebase-design` (deep modules, small doors).
- **Stage 3, the look:** `anthropic-skills:liquid-glass-web` (glass tiers, performance budget), `anthropic-skills:design-excellence` (self-review before showing any screen), `emil-design-eng` (press feedback and polish). Use `animate` only for the few allowed moments (login, home hero, empty states) and the press scale. `ask-sonner` when wiring toasts.
- **Stage 4, the rules of the data:** `tdd` for the pure logic (standings and tiebreakers, score totals, clock countdown from saved state, offline-queue de-duplication). Add Vitest for this and say why in one line.
- **Stages 5 and 6, screens:** `react-performance-optimization`, `ui-ux-pro-max` for checks only (its palettes and styles must NOT override our tokens), `design:ux-copy` for button and error wording.
- **Stage 8, checks on real code:** `web-design-guidelines` on every UI file, `design:design-system` (audit for hard-coded colours, sizes and timings outside `tokens.css`), `design:accessibility-review`, `impeccable` (installed globally; run `/impeccable audit`, `/impeccable critique` and `/impeccable polish` on the real screens, and `npx impeccable detect src/`), `engineering:code-review`.
- **Stage 8, security:** `owasp-top-10`, `security-best-practices`, `slopsec`, `security-review`, on the login, the database rules and the frontend.
- **Stage 9, deploy:** `cloudflare:cloudflare` and `cloudflare:web-perf`.
- **When something breaks:** `diagnosing-bugs`. To see a screen in the app: `run`. For a long unattended stretch: `anti-sleep`.
- **Do NOT load:** `frontend-design`, `redesign-skill`, `taste-skill`, `brutalist-skill`, `minimalist-skill`, `soft-skill`, `stitch-skill`, `gpt-tasteskill` (they push a new look and would fight the approved design), `animate-expo`, `shadcn` (we use daisyUI plus Radix), and do NOT switch on impeccable's automatic edit hook (it was left off on purpose).
- **No `/impeccable init`** without asking Akiva first: it writes a design-context file into the project.

## 3. Facts already decided (do not re-ask)

- Stack and libraries: exactly as in the frontend plan, section 1. Versions were read on 2026-10-29; re-check each with `npm view <name> version` before installing. Confirm `vite-plugin-pwa` supports the Vite version you install; if not, tell Akiva and propose the fallback. Do not install Ant Design in 1a. Any library not in the plan needs a one-line reason first.
- Web address: `mlf.pages.dev` is already taken by someone else's site (it served a "Temp Email" page on 2026-10-29). Use **`minor-league-football.pages.dev`**. If that is also taken when the Cloudflare project is created, ask Akiva for another name.
- Team colours (tokens): Speed Demons red `#F04444`, Daybies blue `#5B7CFF`, Tigers orange `#FF7A1A`. Stripe or dot only, always next to the written team name.
- Logins: first name in lowercase for everyone, **`leo` for Leon**. Supabase accounts need an email-shaped address, so the login screen asks only for login name and password and adds a fixed made-up email ending in code (for example `leo@mlf.invalid`; test which ending Supabase accepts). **Test this with ONE user before asking Akiva to create nine.** Akiva types each password straight into the Supabase dashboard, never to you.
- Eddie: league manager, no team, QB for everyone, no stats. Akiva says he has "general admin powers". Build the plan as written (MVP and stat-order control) behind one role check, and ask Akiva what else "general admin" should include when you reach that rule. Do not guess.
- Past results: 5 saved game scores (import as "Final score (entered by hand)"), the old stat sheet as an "Earlier totals" season (never counts toward standings), plus hand-entered **record adjustments** to match the league's confirmed records (Tigers 5-1, Speed Demons 4-2, Daybies 0-6; these balance). The adjustments are the confirmed record minus the 5 saved games: Tigers +2-1, Speed Demons +2-1, Daybies +0-2. That makes 9 games played of 14, so 5 are left. Conversions stay one old-sheet stat (1-point and 2-point split unknown). Leon is 48 receptions and 24 drops (already corrected in the data file).
- Birth year only is stored. Jerseys for Chaimy, Morris and Eddie stay blank. Morris's birth year is unknown.
- Phase 1a does NOT include the clock, score buttons, stat pad, standings screen or MVP race. Those are 1b onward.

## 4. Questions Akiva still owes you (ask one at a time, at the stage that needs the answer)

1. **The 5 games still to play (before the Schedule screen):** the standings are settled, and 9 played of 14 leaves 5. Ask him to confirm that number, then who plays whom and on which Friday or Sunday for each. Until he answers, leave the future schedule empty and do not invent fixtures.
2. **Eddie's extra powers** (before writing the role rules).
3. **Supabase Project URL and anon key** (Stage 1). Never the `service_role` key, never the database password.
4. **Photos** for `public/images/` (a stadium hero, friend-group shots). HEIC is fine; convert them. Not blocking: use clean placeholders until they arrive.
5. **Overtime format** for a tied final (needed in Phase 1b; just keep it in the open list).

## 5. What to build (stop and check in with Akiva after each stage)

1. **Orientation.** Read the docs. Tell Akiva in 10 lines or fewer what you will build and in what order. Wait for "go".
2. **Accounts and setup (Akiva clicks).** Give exact click-by-click steps, after checking the current Supabase dashboard wording in its docs: create the Supabase project, find the Project URL and anon key. Put them in `.env.local` (gitignored) and a placeholder-only `.env.example`. Use the GitHub repo that already exists (`akivayevdayev-debug/minor-league-football`, private, `main`).
3. **Scaffold and look.** Vite + React + TypeScript + Tailwind v4 + HashRouter, the folder layout in section 12 of the frontend plan. Then `src/styles/tokens.css` (every colour, size and timing, nothing typed anywhere else), the three glass tiers (`glass-subtle`, `glass-panel`, `glass-strong`), self-hosted fonts (Fontsource), the daisyUI `mlf` theme, the `ui/Icon` wrapper (Phosphor only), the app shell with bottom navigation, and the MLF lettermark app icon. Check contrast with the real colours.
4. **Database.** `supabase/schema.sql` plus numbered change files (`supabase/changes/001_*.sql`). Every table has Row Level Security. Event rows, void instead of delete, automatic edit history, the views and "one-press actions" from the database plan that Phase 1a needs, and the login-to-player link. Tests for the pure logic first (`tdd`). Akiva pastes SQL into the Supabase SQL Editor: give exact steps. Prove that a logged-out request to every table returns nothing.
5. **Login.** Login screen, "ask the owner to link your login" screen, sign out, change own password, session that survives a reload. Build it against the single test user first.
6. **Screens.** Players list and basic profile, guests, Teams with roster history, Schedule with a change-time sheet that takes a couple of taps, Settings (password, **Export everything** button). Then the **import**: write a small script that reads `data/private/league-data.json` and produces `data/private/import.sql` (gitignored). Akiva pastes it into the SQL Editor, so no `service_role` key is ever needed. Check the result against the data file (10 people, 3 teams, the 5 scores, Leon 48 and 24).
7. **Installable and safe.** `vite-plugin-pwa` manifest and icons, the `_headers` security file from section 11, and a small scheduled keep-alive ping so the free Supabase project does not pause (verify how you will make sure it keeps running).
8. **Check everything** (see section 6).
9. **Deploy.** Cloudflare Pages from the GitHub repo: build `npm run build`, output `dist`, the two public env values set in Cloudflare. The Cloudflare connector needs Akiva to sign in; if it cannot, give him the dashboard click path instead. Test the live address on his iPhone and on Android.
10. **Knowledge graph and hand-off.** Build the graph (`graphify --help` for the first-time command), then `graphify update .` after code changes from now on. Update the memory file `project-mlf-decisions.md` and the plan docs with anything that changed, and list what Phase 1b needs.

## 6. How to validate

- `npm run build`, `npm run lint`, type-check and the Vitest tests all pass with no warnings you cannot explain.
- Look at every screen yourself in the in-app browser at 375 px wide and at desktop width: no sideways scroll, nothing hidden, touch targets at least 44 px (56 px on game screens, not built yet).
- Contrast re-measured on the real screens (AA, 4.5:1 for text). Reduced-motion and reduced-transparency respected. No more than 5 blurred surfaces on a screen, no glass inside glass.
- `design:design-system` audit finds no colours, sizes or timings outside `tokens.css`. `npx impeccable detect src/` and `/impeccable audit` findings are fixed or explained.
- Security: the four security skills run on the real code. Confirm with commands: logged-out requests get nothing; no `service_role` string anywhere in the repo; `git check-ignore data/private/league-data.json` succeeds; `git status` shows nothing from `data/private/`, `.env` or `.env.local`; user-written text is rendered as plain text.
- Real-data check: the imported players, teams, scores and old totals match `data/private/league-data.json`. If a number disagrees with Akiva's records, show him both numbers; do not "fix" either silently.
- Performance targets from section 10 of the frontend plan, using `cloudflare:web-perf` on the deployed address.

## 7. Rules

- **Do not commit or push** until Akiva asks. When he asks: plain commit messages, authored as his own git identity, and **no Claude credit anywhere** (no `Co-Authored-By` line, no "Generated with Claude Code" line, in commits, pull requests or the repo description). Check `git diff --cached` first so nothing from `data/private/` or `.env*` goes in.
- Never put a password, key or token in code, config, git or chat. Never touch `~/Documents/Sh'elah_app` or anything in it.
- Never delete data: void it and keep the history.
- Edit existing files with small changes; do not regenerate whole files. Say what you are about to change and which files.
- When Akiva changes a decision, update the plan docs the same turn and say what it replaced.
- Keep chat replies short; put detail in files. At the end report: files changed, what Akiva must click or paste next, what is verified, what is not.
