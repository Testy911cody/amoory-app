-- Talk Board — personal recordings & custom words (caregiver accounts)
-- Run in Supabase SQL editor on the HouseGames project.
--
-- REQUIRED (Supabase Dashboard → Authentication → Providers → Email):
--   Turn OFF "Confirm email" — username accounts use synthetic @talkboard.local
--   addresses that cannot receive confirmation mail. Without this, sign-up never
--   completes and cloud recording sync will not work.

create table if not exists public.user_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_key text not null,
  lang text not null,
  audio_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, word_key, lang)
);

create index if not exists user_recordings_user_lang
  on public.user_recordings (user_id, lang);

alter table public.user_recordings enable row level security;

create policy "Users read own recordings"
  on public.user_recordings for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own recordings"
  on public.user_recordings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own recordings"
  on public.user_recordings for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users delete own recordings"
  on public.user_recordings for delete
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.user_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_key text not null,
  label text not null check (char_length(label) between 1 and 80),
  english_hint text,
  emoji text default '💬',
  category text not null default 'social',
  locale text not null,
  dialect text,
  audio_path text,
  created_at timestamptz not null default now(),
  unique (user_id, word_key)
);

create index if not exists user_words_user_locale
  on public.user_words (user_id, locale, dialect);

alter table public.user_words enable row level security;

create policy "Users read own words"
  on public.user_words for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own words"
  on public.user_words for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own words"
  on public.user_words for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users delete own words"
  on public.user_words for delete
  to authenticated
  using (user_id = auth.uid());

-- Private bucket — signed URLs for playback
insert into storage.buckets (id, name, public)
values ('user-audio', 'user-audio', false)
on conflict (id) do nothing;

create policy "Users read own audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users upload own audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own audio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'user-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own audio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
