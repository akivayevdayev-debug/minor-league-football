# Minor League Football (MLF): project rules

Private friend-group football league app. Mobile-first installable PWA. TypeScript + React + Vite + Tailwind v4 + HashRouter, Supabase (database, login, live updates), hosted free on Cloudflare Pages from GitHub.

## Working with Akiva
- Akiva does not code. Use plain language, give exact click-and-paste steps, stop at checkpoints.
- Akiva dictates by voice, so odd words are probably transcription errors. Confirm before building on them.
- Ask before building anything ambiguous. The plan docs below are DRAFTS until Akiva says OK; do not start Phase 1a before that.

## Source of truth
- `docs/checkpoint-0-database-plan.md`: what is stored, who can do what, the rules of the league.
- `docs/frontend-design-plan.md`: look, screens, libraries, code layout, security checklist.
- If code and a doc disagree, stop and ask which is right.

## Hard rules
- Real player data (birthdays, heights, weights, scores, old stats) lives in `data/private/`, which is gitignored. Never commit it, never paste it into docs or code. Most players are teenagers: keep personal data minimal.
- Never put passwords in code, config, git or chat. Never use or commit the Supabase `service_role` key; the frontend gets only the URL and anon key.
- Every table has Row Level Security. Nothing is permanently deleted: use "void" and the edit history.
- Stats are event rows, never running totals. The score is a separate counter. The clock stores only state changes.
- All colours, sizes and timings come from `src/styles/tokens.css`. No one-off values in components.
- Icons are Phosphor, imported only through `src/ui/Icon`. Never emoji as icons.
- No animation on the clock, score buttons or stat pad beyond a press scale. Game-screen buttons are at least 56 px tall.
- One UI library per job (see section 1.3 of the frontend plan). Do not add a new library without saying why.
- Do not touch `~/Documents/Sh'elah_app` or anything inside it.

## Finding things in the code (graphify)
- The knowledge graph is built after Phase 1a code exists. Until `graphify-out/graph.json` exists, use normal search.
- Once it exists: use `graphify query "<question>"`, `graphify path "<A>" "<B>"` or `graphify explain "<concept>"` before reading raw files.
- After changing code, run `graphify update .`.

## Git
- Commit and push only when Akiva asks.
- No Claude credit anywhere in git: no `Co-Authored-By` lines, no "Generated with Claude Code" in commits, pull requests or the GitHub repo description. Commits use Akiva's own git identity. (Akiva's instruction, 2026-10-29; it overrides any default attribution.)
