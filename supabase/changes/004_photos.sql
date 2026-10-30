-- ════════════════════════════════════════════════════════════════════════════
-- MLF change 004: player photos, team logos and team photos.
-- Run once, after 003.
--
--   • A private "photos" storage bucket. Only league members can see or add photos;
--     logged-out visitors get nothing. Only small images (WebP, JPEG, PNG, up to 2 MB).
--   • Photos are never overwritten or deleted: each upload gets a new file name, and the
--     player or team row points at the newest one. The old pointer stays in the edit history.
--   • teams.photo_path: a team group photo (players.photo_path and teams.logo_path already exist).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.teams add column photo_path text;

-- Paths look like players/<player id>/<random id>.webp — nothing else is accepted.
alter table public.players add constraint players_photo_path_shape
  check (photo_path is null or photo_path ~ '^players/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$');
alter table public.teams add constraint teams_logo_path_shape
  check (logo_path is null or logo_path ~ '^teams/[0-9a-f-]{36}/logo-[0-9a-f-]{36}\.(webp|jpg|png)$');
alter table public.teams add constraint teams_photo_path_shape
  check (photo_path is null or photo_path ~ '^teams/[0-9a-f-]{36}/photo-[0-9a-f-]{36}\.(webp|jpg|png)$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Members may look at and add photos. No update or delete policy: nothing is overwritten or removed.
create policy photos_members_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and app_private.is_member());
create policy photos_members_add on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and app_private.is_member()
    and name ~ '^(players/[0-9a-f-]{36}/|teams/[0-9a-f-]{36}/(logo|photo)-)[0-9a-f-]{36}\.(webp|jpg|png)$'
  );
