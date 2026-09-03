-- Render-only versioning. No accent backfill, Auth, RLS, or training changes.
begin;
alter table public.profiles add column accent_version smallint not null default 0;
alter table public.profiles drop constraint profiles_accent_check;
alter table public.profiles add constraint profiles_accent_check check (
  (accent_version = 0 and accent in ('ember','rose','cobalt','merlot')) or
  (accent_version = 1 and accent in ('volt','cobalt','merlot','rose','violet','ember'))
) not valid;
alter table public.profiles validate constraint profiles_accent_check;
comment on column public.profiles.accent_version is '0 preserves legacy rendering (ember means Volt); 1 is an explicit six-palette Appearance v1 choice.';
comment on column public.profiles.accent is 'Render-only profile accent. Interpret with accent_version; never use for authorization or training behavior.';
commit;
