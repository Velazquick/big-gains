\set ON_ERROR_STOP on
-- Disposable PostgreSQL CI service only. Never run against the hosted project.
create table public.profiles (
  id integer primary key, accent text not null default 'ember',
  theme text not null default 'performance-dark', pet_enabled boolean not null default true,
  sentinel text not null,
  constraint profiles_accent_check check (accent in ('ember','rose','cobalt','merlot'))
);
insert into public.profiles values
  (1,'ember','performance-dark',true,'legacy-a'),
  (2,'rose','wellness-light',true,'legacy-b'),
  (3,'cobalt','performance-dark',false,'legacy-c'),
  (4,'merlot','slate-dark',false,'legacy-d');
create temp table before_migration as select md5(string_agg(to_jsonb(p)::text,',' order by id)) as checksum from public.profiles p;
\ir ../supabase/migrations/20260903024032_appearance_v1_accent_contract.sql
do $$
declare color text; affected integer;
begin
  if (select checksum from before_migration) <> (select md5(string_agg((to_jsonb(p)-'accent_version')::text,',' order by id)) from public.profiles p) then
    raise exception 'Migration changed legacy columns';
  end if;
  if exists(select from public.profiles where accent_version <> 0) then raise exception 'Legacy version changed'; end if;
  foreach color in array array['volt','cobalt','merlot','rose','violet','ember'] loop
    insert into public.profiles(id,accent,accent_version,sentinel) values(10,color,1,'explicit');
    delete from public.profiles where id=10;
  end loop;
  begin
    insert into public.profiles(id,accent,accent_version,sentinel) values(10,'custom',1,'invalid');
    raise exception 'Invalid accent accepted';
  exception when check_violation then null; end;
  begin
    insert into public.profiles(id,accent,accent_version,sentinel) values(10,'violet',0,'invalid');
    raise exception 'Legacy violet accepted';
  exception when check_violation then null; end;
  begin
    insert into public.profiles(id,accent,accent_version,sentinel) values(10,'ember',2,'invalid');
    raise exception 'Invalid version accepted';
  exception when check_violation then null; end;
  update public.profiles set accent='violet',accent_version=1 where id=1 and accent='ember' and accent_version=0;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Expected compare-and-set update'; end if;
  update public.profiles set accent='ember',accent_version=1 where id=1 and accent='ember' and accent_version=0;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale update overwrote newer accent'; end if;
  if (select accent from public.profiles where id=1) <> 'violet' or (select accent from public.profiles where id=2) <> 'rose' then raise exception 'Isolation failed'; end if;
  raise notice '14 appearance contract checks passed';
end $$;
