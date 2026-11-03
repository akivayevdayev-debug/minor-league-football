/*
 * Shared test helpers for the database tests: the Supabase stub, the migration loader and a
 * "run this query as this user" helper. Used by rules.test.ts and season2.test.ts.
 */
import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'

export const sql = (file: string) => readFileSync(new URL(`../changes/${file}`, import.meta.url), 'utf8')

// The bits of Supabase that our schema leans on: roles, auth.users, auth.uid(), and its
// default "expose everything to anon" grants (the worst case our revokes must undo).
export const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
`

/** Runs a query as a logged-out visitor ("anon") or as a login (its user id), like the Supabase API does. */
export async function runAs<T>(
  db: PGlite,
  user: string | 'anon',
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const role = user === 'anon' ? 'anon' : 'authenticated'
  const sub = user === 'anon' ? '' : user
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub])
    await tx.exec(`set local role ${role}`)
    const res = await tx.query<T>(query, params)
    return res.rows
  })
}
