-- Talk Board — admin RLS & RPC helpers
-- Project: bakwzpymzxuahbldialc (House Games)
-- Run in Supabase SQL editor after community-words + global-recordings + user-recordings schemas.

-- ---------------------------------------------------------------------------
-- Helper: reusable admin check (optional; policies inline below)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles — admins list users & toggle is_admin
-- ---------------------------------------------------------------------------
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Community words — admins read all statuses
-- ---------------------------------------------------------------------------
drop policy if exists "Admins read all community words" on public.community_words;
create policy "Admins read all community words"
  on public.community_words for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Global recordings — admins read all statuses (pending policy already exists)
-- ---------------------------------------------------------------------------
drop policy if exists "Admins read all global recordings" on public.global_word_recordings;
create policy "Admins read all global recordings"
  on public.global_word_recordings for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- User recordings & words — admin browse
-- ---------------------------------------------------------------------------
drop policy if exists "Admins read all user recordings" on public.user_recordings;
create policy "Admins read all user recordings"
  on public.user_recordings for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins read all user words" on public.user_words;
create policy "Admins read all user words"
  on public.user_words for select
  to authenticated
  using (public.is_admin());

-- Admins can create signed URLs for any user-audio object
drop policy if exists "Admins read all user audio" on storage.objects;
create policy "Admins read all user audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-audio'
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- RPC: list auth users (username, email, admin flag, last sign-in)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id uuid,
  username text,
  email text,
  is_admin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select
    u.id,
    coalesce(
      u.raw_user_meta_data->>'username',
      nullif(split_part(u.email, '@', 1), '')
    ) as username,
    u.email::text,
    coalesce(p.is_admin, false) as is_admin,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: dashboard counts
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  select json_build_object(
    'users', (select count(*)::int from auth.users),
    'pending_words', (select count(*)::int from public.community_words where status = 'pending'),
    'pending_recordings', (select count(*)::int from public.global_word_recordings where status = 'pending'),
    'approved_global', (select count(*)::int from public.global_word_recordings where status = 'approved'),
    'user_recordings', (select count(*)::int from public.user_recordings),
    'rejected_words', (select count(*)::int from public.community_words where status = 'rejected'),
    'rejected_recordings', (select count(*)::int from public.global_word_recordings where status = 'rejected')
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;
