import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkReleaseSources, readReleaseSources, releaseFiles, registrationFor } from '../scripts/check-release-consistency.mjs';

const baseline = await readReleaseSources();
const release = checkReleaseSources(baseline).release;
const rotated = 'v999-synthetic-release';
const registration = registrationFor(baseline, release);
function rotateShell(sources) {
  return new Map([...sources].map(([file, source]) => [file, releaseFiles.includes(file) ? source.replaceAll(release, rotated) : source]));
}
function addFreshRegistration(sources) {
  const file = 'supabase/migrations/20990101000000_operator_synthetic_release.sql';
  const sql = `insert into private.product_releases(release) values ('${rotated}') on conflict do nothing;`;
  sources.set(file, sql);
  sources.set(`migration-introduction:${file}`, sql);
}

test('checked-in current release is consistent; historical fixtures remain allowed', () => {
  const sources = new Map(baseline);
  sources.set('tests/offline.spec.js', sources.get('tests/offline.spec.js') + "\nconst HISTORY = 'v1-historical-cache';\n");
  assert.equal(checkReleaseSources(sources).release, release);
});

test('a coordinated release rotation with a fresh registration passes', () => {
  const sources = rotateShell(baseline);
  addFreshRegistration(sources);
  assert.equal(checkReleaseSources(sources).release, rotated);
});

test('coordinated pins cannot reuse a retired release ID even with its unchanged registration', () => {
  const sources = new Map([...baseline].map(([file, source]) => [file, releaseFiles.includes(file) ? source.replaceAll(release, 'v120-train-premium-pass-01') : source]));
  assert.throws(() => checkReleaseSources(sources), /retired release ID cannot be reused/);
});

for (const file of releaseFiles.filter(file => file !== 'asset-manifest.js')) {
  test(`release rotation rejects stale current reference in ${file}`, () => {
    const sources = rotateShell(baseline);
    sources.set(file, baseline.get(file));
    addFreshRegistration(sources);
    assert.throws(() => checkReleaseSources(sources), error => error.message.includes(file));
  });
}

test('rotated shell with a stale or rewritten historical registration fails', () => {
  for (const rewritten of [false, true]) {
    const sources = rotateShell(baseline);
    if (rewritten) sources.set(registration, sources.get(registration).replaceAll(release, rotated));
    assert.throws(() => checkReleaseSources(sources), /add a fresh migration/);
  }
});

test('even a matching release cannot edit its committed registration', () => {
  const sources = new Map(baseline);
  sources.set(registration, sources.get(registration) + '\n-- changed after introduction\n');
  assert.throws(() => checkReleaseSources(sources), /unchanged operator-classified/);
});

test('real Git provenance rejects a committed rewrite and accepts a fresh registration path', async context => {
  const prefix = join(tmpdir(), 'big-gains-release-provenance-');
  const directory = await mkdtemp(prefix);
  context.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(prefix)), 'cleanup must stay in the synthetic fixture directory');
    await rm(directory, { recursive: true, force: true });
  });
  const root = pathToFileURL(`${directory}${sep}`);
  const run = promisify(execFile);
  const git = (...args) => run('git', args, { cwd: directory });
  const put = async (file, source) => {
    await mkdir(new URL('./', new URL(file, root)), { recursive: true });
    await writeFile(new URL(file, root), source);
  };
  const commit = async message => {
    await git('add', '.');
    await git('-c', 'user.name=Synthetic QA', '-c', 'user.email=synthetic@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', message);
  };
  for (const file of [...releaseFiles, registration]) await put(file, baseline.get(file));
  await git('init');
  await git('config', 'core.autocrlf', 'false');
  await commit('Synthetic original registration');
  for (const file of [...releaseFiles, registration]) await put(file, baseline.get(file).replaceAll(release, rotated));
  await commit('Incorrect committed historical rewrite');
  const rewritten = await readReleaseSources(root);
  assert.throws(() => checkReleaseSources(rewritten), /add a fresh migration/);
  await put(registration, baseline.get(registration));
  const fresh = 'supabase/migrations/20990101000000_operator_synthetic_release.sql';
  await put(fresh, `insert into private.product_releases(release) values ('${rotated}') on conflict do nothing;\n`);
  await commit('Fresh synthetic registration');
  const result = checkReleaseSources(await readReleaseSources(root));
  assert.equal(result.release, rotated);
  assert.equal(result.registrationMigration, fresh);
  // A committed rollback must also fail: the latest history entry alone is
  // insufficient evidence that an identifier has never been retired.
  for (const file of releaseFiles) await put(file, baseline.get(file));
  await commit('Incorrect reuse of a retired release');
  const reused = await readReleaseSources(root);
  assert.throws(() => checkReleaseSources(reused), /retired release ID cannot be reused/);
});

test('matching shell pins without a release registration fail closed', () => {
  const sources = new Map(baseline);
  sources.delete(registration);
  assert.throws(() => checkReleaseSources(sources), /product_releases registration/);
});

test('registration comments and incorrect migration ordering cannot satisfy the gate', () => {
  for (const commented of [true, false]) {
    const sources = new Map(baseline);
    const sql = sources.get(registration);
    sources.delete(registration);
    sources.set(commented ? registration : registration.replace('_operator_', '_'), commented ? `/* ${sql} */` : sql);
    assert.throws(() => checkReleaseSources(sources), /product_releases registration/);
  }
});

test('a config rotation catches stale offline and entrypoint expectations', () => {
  const sources = new Map(baseline);
  sources.set('asset-manifest.js', sources.get('asset-manifest.js').replace(/config-[a-f0-9]{16}/, 'config-0000000000000000'));
  assert.throws(() => checkReleaseSources(sources), /tests\/offline\.spec\.js/);
});

test('missing and duplicate manifest references fail closed', () => {
  for (const duplicate of [false, true]) {
    const sources = new Map(baseline);
    const source = sources.get('index.html');
    const reference = source.match(/asset-manifest\.js\?v=[^"'\s]+/)[0];
    sources.set('index.html', duplicate ? source + `\n${reference}` : source.replace(reference, 'missing.js'));
    assert.throws(() => checkReleaseSources(sources), /index\.html/);
  }
});

test('missing telemetry/export contracts are reported rather than silently ignored', () => {
  for (const file of ['tests/helpers/telemetry.js', 'tests/user-data-export.spec.js']) {
    const sources = new Map(baseline);
    sources.set(file, '');
    assert.throws(() => checkReleaseSources(sources), error => error.message.includes(file));
  }
});

test('stale revisioned assets are rejected even with matching entrypoint pins', () => {
  const sources = new Map(baseline);
  sources.set('asset-manifest.js', sources.get('asset-manifest.js').replace(
    'const revisionedStyles = styles.map(revision);',
    "const revisionedStyles = styles.map(revision).map(asset => asset.replace(/\\?v=.*/, '?v=v1-stale'));"
  ));
  assert.throws(() => checkReleaseSources(sources), /stale styles asset/);
});

test('a revisioned runtime asset omitted from offline core is rejected', () => {
  const sources = new Map(baseline);
  sources.set('asset-manifest.js', sources.get('asset-manifest.js').replace(
    '...revisionedScripts,',
    "...revisionedScripts.filter(asset => !asset.startsWith('./timer-controller.js?')),"
  ));
  assert.throws(() => checkReleaseSources(sources), /offline core omits.*timer-controller/);
});

test('stale manifestAsset URL fails despite consistent entrypoint pins', () => {
  const sources = new Map(baseline);
  sources.set('asset-manifest.js', sources.get('asset-manifest.js').replace(
    'encodeURIComponent(deploymentVersion)', 'encodeURIComponent("v1-stale-config-0000000000000000")'
  ));
  assert.throws(() => checkReleaseSources(sources), /inconsistent manifestAsset URL/);
});

test('the current manifest URL must be present in offline core', () => {
  const sources = new Map(baseline);
  sources.set('asset-manifest.js', sources.get('asset-manifest.js').replace(
    '    manifestAsset,', '    "./old-manifest.js?v=v1-stale",'
  ));
  assert.throws(() => checkReleaseSources(sources), /offline core omits current manifestAsset URL/);
});

for (const key of ['cacheName', 'runtimeCacheName']) {
  test(`a stale ${key} fails despite matching release and asset URLs`, () => {
    const sources = new Map(baseline);
    const prefix = key === 'cacheName' ? 'cachePrefix' : 'runtimeCachePrefix';
    sources.set('asset-manifest.js', sources.get('asset-manifest.js').replace(
      `${key}: \u0060\u0024{${prefix}}\u0024{release}-\u0024{cloudConfigVersion}\u0060`,
      `${key}: 'big-gains-stale-cache'`
    ));
    assert.throws(() => checkReleaseSources(sources), new RegExp(`inconsistent ${key}`));
  });
}
