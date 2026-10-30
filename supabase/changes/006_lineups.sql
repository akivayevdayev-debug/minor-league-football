-- 006: Who is on the field. Each row is a team's on-field players from one clock moment on.
-- Kickoff writes the first row, every sub writes a new one. Playing time is worked out from these.
-- Nothing is deleted: a mistake is voided.

create table if not exists public.lineups (
  id            uuid primary key default gen_random_uuid(), -- client-generated, idempotent
  game_id       uuid not null references public.games (id),
  team_id       uuid not null references public.teams (id),
  on_field      uuid[] not null check (cardinality(on_field) between 1 and 3),
  half          smallint not null check (half in (1, 2, 3)),          -- 3 = overtime
  clock_seconds integer not null check (clock_seconds between 0 and 3600), -- seconds left in the half
  voided_at     timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);
create index if not exists lineups_game on public.lineups (game_id);

alter table public.lineups enable row level security;
create trigger stamp before insert or update on public.lineups for each row execute function app_private.stamp();
create trigger history after insert or update on public.lineups for each row execute function app_private.record_history('id');
create policy members_read on public.lineups for select to authenticated using (app_private.is_member());
create policy members_add on public.lineups for insert to authenticated with check (app_private.is_member());
create policy members_change on public.lineups for update to authenticated using (app_private.is_member()) with check (app_private.is_member());
revoke all on public.lineups from anon;
grant select, insert, update on public.lineups to authenticated;
revoke delete, truncate on public.lineups from authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lineups') then
    alter publication supabase_realtime add table public.lineups;
  end if;
end $$;
