-- Extend render-only presentation tokens for SZW's independent profile.
-- These constraints do not participate in ownership, RLS, or cloud authority.

alter table public.profiles
  drop constraint profiles_accent_check;

alter table public.profiles
  add constraint profiles_accent_check
  check (accent in ('ember', 'rose', 'cobalt', 'merlot')) not valid;

alter table public.profiles
  validate constraint profiles_accent_check;

alter table public.profiles
  drop constraint profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('performance-dark', 'wellness-light', 'slate-dark')) not valid;

alter table public.profiles
  validate constraint profiles_theme_check;

comment on column public.profiles.accent is
  'Render-only token name: ember, rose, cobalt, or merlot.';
comment on column public.profiles.theme is
  'Render-only token name: performance-dark, wellness-light, or slate-dark.';
