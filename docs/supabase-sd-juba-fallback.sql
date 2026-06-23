-- Talk Board — legacy DB mirrors for sd↔juba (optional migration).
-- Prefer app-layer sharing: one approved juba OR sd row serves both dialects
-- until a dialect-specific override is approved. The seed below is optional;
-- new deployments can skip the INSERT and rely on playback fallback only.

-- Track rows copied from another dialect (legacy admin UI).
alter table public.global_word_recordings
  add column if not exists fallback_from_dialect text;

comment on column public.global_word_recordings.fallback_from_dialect is
  'When set (e.g. juba), this approved sd row mirrors another dialect until replaced.';

-- Admins may remove fallback rows when a native sd recording is approved.
drop policy if exists "Admins delete global recordings" on public.global_word_recordings;
create policy "Admins delete global recordings"
  on public.global_word_recordings for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Seed sd rows from every approved juba recording (same audio URL, sd lang code).
insert into public.global_word_recordings (
  word_key, locale, dialect, lang, audio_url, status,
  submitted_by, reviewed_by, reviewed_at, fallback_from_dialect
)
select
  g.word_key,
  g.locale,
  'sd',
  'ar-SD',
  g.audio_url,
  'approved',
  g.submitted_by,
  g.reviewed_by,
  g.reviewed_at,
  'juba'
from public.global_word_recordings g
where g.locale = 'ar'
  and g.dialect = 'juba'
  and g.status = 'approved'
  and not exists (
    select 1 from public.global_word_recordings s
    where s.word_key = g.word_key
      and s.locale = g.locale
      and s.dialect = 'sd'
      and s.status = 'approved'
  );
