import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { approvedFixture, loadMigration, journalFor, sourceRoot, copy, ids } from './migration-journal.js';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const deferred = () => { let resolve;const promise = new Promise(r => { resolve = r; });return { promise, resolve }; };
export async function bounded(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 20000); })]); }
  finally { clearTimeout(timer); }
}

// Same synthetic auth scaffolding as operator-db.test.mjs. The JSON fallback
// accepts actual PostgREST JWT claims; no hosted Auth endpoint is contacted.
const bootstrap = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role migration_journal_rest login noinherit password 'owned-local-test'; exception when duplicate_object then null; end $$;
grant anon,authenticated to migration_journal_rest;
create schema auth;
create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean default false);
create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to authenticated,anon,service_role;
create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin return; end$$;
`;

export async function startLane() {
  const executable = process.env.MIGRATION_JOURNAL_POSTGREST;
  if (!executable || !fs.existsSync(executable)) throw new Error('MIGRATION_JOURNAL_POSTGREST must name a local PostgREST executable; the database regression is never silently skipped.');
  const evidence = process.env.MIGRATION_JOURNAL_EVIDENCE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'migration-journal-'));
  fs.mkdirSync(evidence, { recursive: true });
  const config = { host: '127.0.0.1', port: Number(process.env.OPERATOR_TEST_PG_PORT || 55432), user: 'postgres', password: process.env.PGPASSWORD, database: 'postgres' };
  const admin = new pg.Client(config);await admin.connect();
  const database = `migration_journal_${Date.now()}_${process.pid}`;await admin.query(`create database ${database}`);
  const db = new pg.Client({ ...config, database });await db.connect();
  let child;const streams = [];
  const close = async () => {
    if (child && child.exitCode === null) { const stopped = new Promise(r => child.once('exit', r));child.kill();await bounded(stopped, 'PostgREST shutdown'); }
    for (const fd of streams) fs.closeSync(fd);
    await db.end();await admin.end();
    // The isolated database is retained for forensic readback; CI discards its
    // disposable service on job completion. No application cleanup is run.
  };
  try {
    await db.query(bootstrap);fs.writeFileSync(path.join(evidence, 'bootstrap.sql'), bootstrap);
    const all = fs.readdirSync(path.join(sourceRoot, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
    const order = [...all.filter(f => !f.includes('operator_')), ...all.filter(f => f.includes('operator_'))];
    const migrations = [];
    for (const file of order) { const text = fs.readFileSync(path.join(sourceRoot, 'supabase/migrations', file), 'utf8');await db.query(text);migrations.push({ file, sha256: digest(text) }); }
    const socket = net.createServer();await new Promise(r => socket.listen(0, '127.0.0.1', r));const port = socket.address().port;await new Promise(r => socket.close(r));
    const origin = `http://127.0.0.1:${port}`, secret = 'migration-journal-owned-disposable-jwt-secret-00000000';
    const jwt = subject => {
      const head = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
      const body = Buffer.from(JSON.stringify({ role: 'authenticated', sub: subject, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
    };
    const restConfig = path.join(evidence, 'postgrest.conf');
    fs.writeFileSync(restConfig, `db-uri = "postgres://migration_journal_rest:owned-local-test@127.0.0.1:${config.port}/${database}"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "${secret}"\nserver-host = "127.0.0.1"\nserver-port = ${port}\n`);
    const env = { ...process.env };
    if (process.env.MIGRATION_JOURNAL_PG_BIN) { const key = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH';env[key] = process.env.MIGRATION_JOURNAL_PG_BIN + path.delimiter + env[key]; }
    for (const name of ['postgrest-stdout.log', 'postgrest-stderr.log']) streams.push(fs.openSync(path.join(evidence, name), 'w'));
    child = spawn(executable, [restConfig], { env, windowsHide: true, stdio: ['ignore', ...streams] });
    await bounded((async () => {
      for (;;) {
        if (child.exitCode !== null) throw new Error(`PostgREST exited ${child.exitCode}; retained logs: ${evidence}`);
        try { if ((await fetch(origin + '/')).status < 500) return; } catch {}
        await new Promise(r => setTimeout(r, 100));
      }
    })(), 'local PostgREST readiness');
    let sequence = 0;
    const record = (event, data) => { fs.appendFileSync(path.join(evidence, 'events.ndjson'), JSON.stringify({ sequence: ++sequence, at: Date.now(), event, ...data }) + '\n'); };
    const facts = {
      database, origin, migrations,
      version: (await db.query('select version()')).rows,
      roles: (await db.query("select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('migration_journal_rest','authenticated','anon')")).rows,
      policies: (await db.query("select * from pg_policies where tablename='sync_metadata' order by policyname")).rows,
      rls: (await db.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='public.sync_metadata'::regclass")).rows
    };
    fs.writeFileSync(path.join(evidence, 'schema.json'), JSON.stringify(facts, null, 2));
    let fixtureNumber = 0;
    async function fixture(status = 'failed') {
      const number = ++fixtureNumber, f = await approvedFixture(number), B = loadMigration();
      await db.query('insert into auth.users(id,email) values($1,$2)', [f.owner, `${f.owner}@example.invalid`]);
      await db.query('insert into public.accounts(id,owner_user_id,display_name) values($1,$2,$3)', [f.account.id, f.owner, 'Synthetic journal']);
      for (const p of f.profiles) await db.query('insert into public.profiles(id,account_id,client_id,display_name) values($1,$2,$3,$4)', [p.id, p.account_id, p.client_id, p.display_name]);
      const held = deferred(), release = deferred();let verifying = false, refusing = false, captured = false, holdEnabled = false;
      const wire = who => async (input, options = {}) => {
        const url = new URL(String(input));if (url.origin !== origin) throw new Error('Refuse nonlocal synthetic transport');
        const readback = who === 'A' && holdEnabled && verifying && options.method === 'GET' && url.pathname.endsWith('/workouts') && !url.searchParams.has('client_id');
        const headers = new Headers(options.headers);headers.set('x-journal-test', `${number}-${who}`);
        let body = null;try { body = options.body ? JSON.parse(options.body) : null; } catch {}
        record('request', { fixture: number, who, method: options.method || 'GET', url: url.href, body });
        if (readback && refusing) { record('refused-retry', { fixture: number, who });throw new TypeError('Load failed'); }
        url.pathname = url.pathname.replace(/^\/rest\/v1(?=\/)/, '');
        const response = await fetch(url, { ...options, headers });
        let data = null;try { data = await response.clone().json(); } catch {}
        record('response', { fixture: number, who, method: options.method || 'GET', url: url.href, status: response.status, data });
        if (readback && !captured) { captured = true;record('held-readback', { fixture: number });held.resolve();await release.promise;throw new TypeError('Load failed'); }
        return response;
      };
      const client = who => createClient(origin, 'sb_publishable_owned_journal_test', { accessToken: async () => jwt(f.owner), global: { fetch: wire(who) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const AClient = client('A'), BClient = client('B');
      const ARepo = f.engine.createSupabaseRepository({ client: AClient, accountId: f.account.id }), BRepo = B.engine.createSupabaseRepository({ client: BClient, accountId: f.account.id });
      for (const r of f.plan.records) await ARepo.insertRow(r.table, r.row);
      const initial = await ARepo.insertJournal(journalFor(f, status));
      const snapshot = async label => {
        const row = (await db.query('select to_jsonb(j)::text as bytes from public.sync_metadata j where id=$1', [initial.id])).rows[0].bytes;
        const tables = {};
        for (const t of (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(x => x.tablename)) {
          if (!/^[a-z_]+$/.test(t)) throw new Error('Unexpected table name');
          const bytes = (await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text as bytes from public.${t} t`)).rows[0].bytes;
          tables[t] = digest(bytes);
        }
        const result = { journal: JSON.parse(row), bytes: row, sha256: digest(row), tables };
        fs.writeFileSync(path.join(evidence, `${number}-${label}.json`), JSON.stringify(result, null, 2));return result;
      };
      const verifySource = async (runtime, c) => {
        const remote = await runtime.previewApi.readRemoteDestination({ client: c, session: { user: { id: f.owner } } });
        const current = await runtime.previewApi.buildPreview({ localSnapshots: f.localSnapshots, remote });return { combinedChecksum: current.combinedChecksum };
      };
      const run = (who, existingJournal, legacy = null) => {
        const runtime = legacy || (who === 'A' ? f : B), c = who === 'A' ? AClient : BClient;
        const repository = legacy ? legacy.engine.createSupabaseRepository({ client: c, accountId: f.account.id }) : who === 'A' ? ARepo : BRepo;
        record('execute', { fixture: number, who, expectedVersion: existingJournal.version, legacy: Boolean(legacy) });
        return runtime.engine.executeMigration({ plan: copy(f.plan), repository, existingJournal, verifySource: () => verifySource(runtime, c), onProgress: p => { record('progress', { fixture: number, who, ...p });if (who === 'A' && p.stage === 'verifying') verifying = true; } }).then(value => ({ value }), error => ({ error }));
      };
      return { ...f, ARepo, BRepo, AClient, BClient, initial, snapshot, run, held, B,
        hold() { holdEnabled = true; }, reject() { refusing = true;release.resolve(); },
        stopHolding() { holdEnabled = false;refusing = false;release.resolve(); },
        async outsider(method = 'GET') { return fetch(origin + '/sync_metadata?id=eq.' + initial.id, { method, headers: { Authorization: 'Bearer ' + jwt(ids(9999)), 'Content-Type': 'application/json', Prefer: 'return=representation' }, ...(method === 'PATCH' ? { body: '{"last_acknowledged_version":999}' } : {}) }); },
        async anonymous() { return fetch(origin + '/sync_metadata'); }
      };
    }
    return { db, facts, fixture, record, close, evidence };
  } catch (error) { await close();throw error; }
}
