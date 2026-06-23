-- Talk Board — global approved word recordings (baseline voices per locale/dialect)
-- Run in Supabase SQL editor on the HouseGames project.
-- Seed baseline from doggy account: npm run seed:global (after .env.local is configured)

create table if not exists public.global_word_recordings (
  id uuid primary key default gen_random_uuid(),
  word_key text not null,
  locale text not null,
  dialect text,
  lang text not null,
  audio_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists global_word_recordings_locale_dialect_status
  on public.global_word_recordings (locale, dialect, status);

create unique index if not exists global_word_recordings_one_approved
  on public.global_word_recordings (word_key, locale, coalesce(dialect, ''))
  where status = 'approved';

alter table public.global_word_recordings enable row level security;

create policy "Approved global recordings are public"
  on public.global_word_recordings for select
  using (status = 'approved');

create policy "Contributors submit pending global recordings"
  on public.global_word_recordings for insert
  to authenticated
  with check (status = 'pending' and submitted_by = auth.uid());

create policy "Contributors see own pending global recordings"
  on public.global_word_recordings for select
  to authenticated
  using (submitted_by = auth.uid() or status = 'approved');

create policy "Admins review global recordings"
  on public.global_word_recordings for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Admins read pending global recordings"
  on public.global_word_recordings for select
  to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

insert into storage.buckets (id, name, public)
values ('global-audio', 'global-audio', true)
on conflict (id) do update set public = true;

create policy "Global audio is public-read"
  on storage.objects for select
  using (bucket_id = 'global-audio');

create policy "Admins upload global baseline"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'global-audio'
    and (storage.foldername(name))[1] in ('baseline', 'approved')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy "Contributors upload pending global audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'global-audio'
    and (storage.foldername(name))[1] = 'pending'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Admins manage global audio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'global-audio'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
