import assert from 'node:assert/strict';

// Called immediately before the new migration in the disposable full-schema
// PostgreSQL harness. Roll back the synthetic data AND migration afterward.
export async function verifyActiveSessionIdentity({ client, migration, uuid }) {
  await client.query('begin');
  const account = uuid(8101), profile = uuid(8201), actor = uuid(8001);
  const session = async (id, key = id) => client.query(
    `insert into public.active_sessions(account_id,profile_id,client_id,idempotency_key,payload)
     values($1,$2,$3,$4,$5) returning id`,
    [account, profile, id, key, { contract: 'big-gains.cloud-shadow.v1', version: 1,
      entityType: 'activeSession', data: { workout: { id, startedAt: '2026-10-08T12:00:00Z' }, restTimerEndsAt: null } }]);
  const rejected = async (fn, code, constraint) => {
    await client.query('savepoint rejection');
    try { await assert.rejects(fn, error => error.code === code && (!constraint || error.constraint === constraint)); }
    finally { await client.query('rollback to savepoint rejection'); }
  };
  try {
    await client.query('insert into auth.users(id) values($1)', [actor]);
    await client.query("insert into public.accounts(id,owner_user_id,display_name) values($1,$2,'Synthetic session owner')", [account, actor]);
    await client.query("insert into public.profiles(id,account_id,client_id,display_name) values($1,$2,'synthetic-session','Synthetic session')", [profile, account]);
    await session('old-session');
    await client.query(`insert into public.tombstones(account_id,profile_id,entity_type,entity_id,idempotency_key,version,deleted_at)
      values($1,$2,'active_sessions','old-session','old-session-deleted',2,now())`, [account, profile]);
    await client.query(`insert into public.workouts(account_id,profile_id,client_id,idempotency_key,completed_at,payload)
      values($1,$2,'saved-history','saved-history',now(),'{"sentinel":"preserve completed sets"}')`, [account, profile]);
    // The actual old schema rejects a new identity despite a winning tombstone.
    await rejected(() => session('next-session'), '23505', 'active_sessions_account_id_profile_id_key');
    const snapshot = async () => (await client.query(`select
      (select jsonb_agg(to_jsonb(s) order by id) from public.active_sessions s) as sessions,
      (select jsonb_agg(to_jsonb(t) order by id) from public.tombstones t) as tombstones,
      (select jsonb_agg(to_jsonb(w) order by id) from public.workouts w) as history,
      (select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public') as policies,
      (select jsonb_agg(to_jsonb(g) order by grantee,table_name,privilege_type) from information_schema.role_table_grants g where table_schema='public') as grants,
      (select jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity,'forced',relforcerowsecurity) order by relname)
        from pg_class where oid in ('public.active_sessions'::regclass,'public.workouts'::regclass,'public.tombstones'::regclass)) as rls`)).rows[0];
    const before = await snapshot();
    await client.query(migration);
    assert.deepEqual(await snapshot(), before, 'all rows, RLS policies and grants must remain identical');
    await session('next-session');
    await rejected(() => session('next-session', 'different-operation'), '23505', 'active_sessions_account_id_profile_id_client_id_key');
    await rejected(() => session('another-session', 'next-session'), '23505', 'active_sessions_account_id_idempotency_key_key');
    // Genuine multiple live identities must remain visible to the client's
    // fail-closed recovery validator, never overwritten through an upsert.
    await session('another-session');
    assert.equal((await client.query('select count(*)::int as n from public.active_sessions where account_id=$1', [account])).rows[0].n, 3);
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [uuid(8999)]);
    await client.query('set local role authenticated');
    assert.equal((await client.query('select count(*)::int as n from public.active_sessions where account_id=$1', [account])).rows[0].n, 0);
    await rejected(() => session('wrong-owner'), '42501');
    await client.query('reset role');
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
    await client.query('set local role authenticated');
    const count = (await client.query('select count(*)::int as n from public.active_sessions where account_id=$1', [account])).rows[0].n;
    assert.equal(count, 3);
    await session('owner-next');
    await client.query('reset role');
  } finally { await client.query('rollback'); }
}
