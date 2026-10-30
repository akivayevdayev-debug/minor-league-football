# Phase 1a: what Akiva does next

The app is built on this Mac. The database is still empty, so nobody can log in yet. Do these in order and tell Claude when each part is done.

## Part 1: set up the database (about 5 minutes)

Each step copies one file. Click **Run** on the command, then paste into Supabase.

1. Open supabase.com → your MLF project → **SQL Editor** (left menu) → **New query**.
2. Copy the first file:
   ```bash
   pbcopy < supabase/changes/001_initial_schema.sql
   ```
   Paste into the editor (Cmd+V) → **Run**. It should say "Success. No rows returned".
3. New query again. Copy the second file:
   ```bash
   pbcopy < supabase/changes/002_reference_data.sql
   ```
   Paste → **Run**.
4. New query again. Copy the league data (it stays on your Mac and never goes in git):
   ```bash
   pbcopy < data/private/import.sql
   ```
   Paste → **Run**. If you see "already been run", it was already imported. That's fine.

## Part 2: lock the door

5. **Authentication** → **Sign In / Providers** → turn **Allow new users to sign up** OFF → **Save**. (Without this, strangers could make accounts.)

## Part 3: make your own login (test one first)

6. **Authentication** → **Users** → **Add user** → **Create new user**.
   - Email: `akiva@mlf.invalid`
   - Password: type your own, here only. Never send it to Claude.
   - Tick **Auto Confirm User** → **Create user**.
7. Tell Claude "user made". Claude checks that logged-out visitors see nothing, then you try logging in with the name `akiva`.

After that works, add each friend the same way: `firstname@mlf.invalid`, with `leo@mlf.invalid` for Leon. Eddie's extra powers get switched on with one line of SQL Claude will give you once his login exists.

## Part 4: later, once Claude commits the code

- **Keep-awake ping** (stops free Supabase from pausing): GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Name `SUPABASE_PUBLISHABLE_KEY`, value is the `sb_publishable_…` key. Never use the secret key.
- **Website**: Cloudflare Pages setup. Claude will walk you through it click by click.

## Decisions Claude made that need your OK

- Teams is a tab inside the Players screen, not its own bottom button.
- The app opens on Schedule (Standings and Games come in later phases).
- The 5 imported games have no dates or week numbers.
- The current season is called "2026 season".

## Still owed by Akiva (asked when needed)

The 5 remaining games (count, pairings, dates) · Eddie's extra admin powers · photos · overtime format for the final.
