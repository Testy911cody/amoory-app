-- Talk Board — Supabase schema for community words (Phase 2)
-- Run in Supabase SQL editor after creating your project.
-- RLS: contributors insert pending; only admins approve; everyone reads approved.

create table if not exists public.community_words (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 80),
  category text not null,
  emoji text default '💬',
  locale text not null,          -- BCP-47 base, e.g. 'ar', 'en', 'fr'
  dialect text,                  -- optional dialect id, e.g. 'sd', 'juba'
  audio_url text,                -- Supabase Storage path when uploaded
  source text not null default 'community'
    check (source in ('community', 'builtin', 'tts')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists community_words_locale_status
  on public.community_words (locale, dialect, status);

alter table public.community_words enable row level security;

-- Anyone can read approved words (including anonymous board users)
create policy "Approved words are public"
  on public.community_words for select
  using (status = 'approved');

-- Signed-in contributors can submit pending words
create policy "Contributors can submit"
  on public.community_words for insert
  to authenticated
  with check (status = 'pending' and submitted_by = auth.uid());

-- Contributors can see their own pending submissions
create policy "Contributors see own pending"
  on public.community_words for select
  to authenticated
  using (submitted_by = auth.uid() or status = 'approved');

-- Admins approve/reject (set is_admin on profiles or use a role claim)
-- Example: profiles.is_admin boolean; adjust to your auth model.
create policy "Admins can review"
  on public.community_words for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Admins can read all pending words for the in-app moderation queue
create policy "Admins can read pending"
  on public.community_words for select
  to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for contributed dialect recordings.
-- The app uploads to `community-audio/<user_id>/<word_id>.webm`.
-- Bucket is public-read (the app stores public URLs); writes are restricted
-- to signed-in contributors writing inside their own user folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-audio', 'community-audio', true)
on conflict (id) do nothing;

-- Public can read audio (needed so the board can play approved recordings)
create policy "Community audio is public-read"
  on storage.objects for select
  using (bucket_id = 'community-audio');

-- Signed-in contributors can upload into their own folder
create policy "Contributors upload own audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'community-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Contributors can replace their own uploads
create policy "Contributors update own audio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'community-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Auto-create a profile row on first sign-in (needed for the admin review flow)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optional: admin flag for review policy (run after enabling Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());
