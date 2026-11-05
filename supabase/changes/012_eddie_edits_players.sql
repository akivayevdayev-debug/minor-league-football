-- Eddie (league manager) can edit any player's everyday details, like Akiva can (Akiva, 2026-11-04).
-- Everyone else can still only edit their own. Logins, guest status and removing a player stay
-- Akiva-only (guard_player_fields trigger), and every change is kept in the edit history.
drop policy if exists members_change on public.players;
create policy members_change on public.players for update
  using (app_private.is_member() and (id = app_private.my_player_id() or app_private.is_owner() or app_private.is_league_manager()))
  with check (app_private.is_member() and (id = app_private.my_player_id() or app_private.is_owner() or app_private.is_league_manager()));
