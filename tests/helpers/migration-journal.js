import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const sourceRoot = process.env.MIGRATION_JOURNAL_SOURCE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
export const copy = value => JSON.parse(JSON.stringify(value));
export const ids = n => `74000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function loadMigration(extra = {}) {
  const context = vm.createContext({ window: {}, crypto: webcrypto, TextEncoder, Date, setTimeout, clearTimeout, console, ...extra });
  for (const file of ['migration-preview.js', 'migration-engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), context, { filename: file });
  }
  return { context, engine: context.window.BigGainsMigrationEngine, previewApi: context.window.BigGainsMigrationPreview };
}

export function loadLegacyMigration() {
  // Frozen deployed-era implementation, not a re-created model of its writer.
  // The CI lane uses a full checkout so this explicit compatibility witness is available.
  const sha = 'a61ddb8a44412dbe9b3714f68e47021269d493db';
  const context = vm.createContext({ window: {}, crypto: webcrypto, TextEncoder, Date, setTimeout, clearTimeout, console });
  for (const file of ['migration-preview.js', 'migration-engine.js']) vm.runInContext(execFileSync('git', ['show', `${sha}:${file}`], { cwd: sourceRoot, encoding: 'utf8' }), context, { filename: `legacy/${file}` });
  return { context, engine: context.window.BigGainsMigrationEngine, previewApi: context.window.BigGainsMigrationPreview };
}

export async function approvedFixture(number = 1) {
  const runtime = loadMigration();
  const owner = ids(number * 10), account = { id: ids(number * 10 + 1), owner_user_id: owner };
  const profiles = ['jorge', 'alexa'].map((client_id, i) => ({ id: ids(number * 10 + 2 + i), account_id: account.id, client_id, display_name: client_id }));
  const states = Object.fromEntries(profiles.map(({ client_id }) => [client_id, {
    version: 5, profileId: client_id, goals: { primary: 'Strength' },
    workouts: [{ id: `owned-${client_id}`, type: 'Push', startedAt: '2026-08-01T10:00:00Z', completedAt: '2026-08-01T11:00:00Z', durationSeconds: 3600, prs: 0, exercises: [] }],
    weights: [{ weight: 200, date: '2026-08-01T12:00:00Z' }], prs: {}, activeWorkout: null,
    restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: true, vibration: true }, exercisePreferences: {}
  }]));
  const localSnapshots = Object.fromEntries(Object.entries(states).map(([id, value]) => [id, { ok: true, value }]));
  const remote = { signedInUserId: owner, accounts: [account], profiles, counts: Object.fromEntries(runtime.previewApi.applicationTables.map(t => [t, 0])) };
  const preview = await runtime.previewApi.buildPreview({ localSnapshots, remote, appRelease: 'v47.1-phase4d-legacy-source-preview' });
  const audit = runtime.previewApi.auditArtifact(preview);
  // Retained six-table approved legacy contract; never relabel a current export.
  delete audit.remoteCounts.bodyweight_entries;
  const plan = await runtime.engine.buildMigrationPlan({ audit, preview, localSnapshots });
  return { ...runtime, owner, account, profiles, states, localSnapshots, remote, preview, audit, plan };
}

export function journalFor(fixture, status = 'failed', version = 7) {
  const p = fixture.plan;
  return {
    account_id: p.account.id, profile_id: p.mappings.jorge.cloudProfileId,
    client_id: `migration:${p.migrationId}`, version,
    last_acknowledged_version: status === 'complete' ? 2 : status === 'verifying' ? 1 : 0,
    metadata: {
      format: fixture.engine.journalFormat, migrationContract: p.format, migrationVersion: p.version,
      migrationId: p.migrationId, account: p.account, mappings: p.mappings, source: p.source, target: p.target, status,
      timestamps: { createdAt: '2026-10-20T12:00:00Z', startedAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z', completedAt: status === 'complete' ? '2026-10-20T12:01:00Z' : null },
      ...(status === 'complete' ? { verification: { verified: true, sourceStillMatches: true, targetCombinedChecksum: p.target.combinedChecksum } } : {})
    }
  };
}
