-- Migration journals are durable completion evidence, including for installed
-- clients that still submit unconditional updates. No existing row is rewritten.
create function private.enforce_migration_journal_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  previous_journal boolean := old.client_id like 'migration:%'
    and old.metadata->>'format' = 'big-gains.migration-journal.v1';
  next_journal boolean := new.client_id like 'migration:%'
    and new.metadata->>'format' = 'big-gains.migration-journal.v1';
  previous_status text := old.metadata->>'status';
  next_status text := new.metadata->>'status';
begin
  if not coalesce(previous_journal, false) and not coalesce(next_journal, false) then
    return new;
  end if;
  if not coalesce(previous_journal, false) or not coalesce(next_journal, false)
    or new.client_id is distinct from old.client_id
    or new.metadata->'migrationId' is distinct from old.metadata->'migrationId'
    or new.metadata->'migrationContract' is distinct from old.metadata->'migrationContract'
    or new.metadata->'migrationVersion' is distinct from old.metadata->'migrationVersion'
    or new.metadata->'account' is distinct from old.metadata->'account'
    or new.metadata->'mappings' is distinct from old.metadata->'mappings'
    or new.metadata->'source' is distinct from old.metadata->'source'
    or new.metadata->'target' is distinct from old.metadata->'target' then
    raise exception 'Migration journal identity is immutable.' using errcode = '23514';
  end if;
  if previous_status = 'complete' then
    if new is distinct from old then
      raise exception 'A completed migration journal is immutable.' using errcode = '23514';
    end if;
    return new;
  end if;
  if not coalesce(previous_status in ('pending', 'verifying', 'failed'), false)
    or not coalesce(next_status in ('verifying', 'complete', 'failed'), false)
    or (next_status = 'complete' and previous_status <> 'verifying')
    or new.version is distinct from old.version + 1
    or new.last_acknowledged_version is distinct from
      (case next_status when 'verifying' then 1 when 'complete' then 2 else 0 end) then
    raise exception 'Migration journal transition was superseded or is invalid.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_migration_journal_transition() from public, anon, authenticated;

create trigger migration_journal_transition
before update on public.sync_metadata
for each row execute function private.enforce_migration_journal_transition();
