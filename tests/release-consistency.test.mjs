import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkReleaseSources, readReleaseSources, releaseFiles, registrationFor } from '../scripts/check-release-consistency.mjs';

const baseline = await readReleaseSources();
const release = checkReleaseSources(baseline).release;
const rotated = 'v999-synthetic-release';
const registration = registrationFor(baseline, release);

test('checked-in current release is consistent; historical fixtures remain allowed', () => {
  const sources = new Map(baseline);
  sources.set('tests/offline.spec.js', sources.get('tests/offline.spec.js') + "\nconst HISTORY = 'v1-historical-cache';\n");
  assert.equal(checkReleaseSources(sources).release, release);
});

test('a coordinated release rotation passes', () => {
  const sources = new Map([...baseline].map(([file, source]) => [file, source.replaceAll(release, rotated)]));
  assert.equal(checkReleaseSources(sources).release, rotated);
});

for (const file of [...releaseFiles, registration].filter(file => file !== 'asset-manifest.js')) {
  test(`release rotation rejects stale current reference in ${file}`, () => {
    const sources = new Map([...baseline].map(([path, source]) => [path, path === file ? source : source.replaceAll(release, rotated)]));
    assert.throws(() => checkReleaseSources(sources), error => error.message.includes(file === registration ? 'product_releases registration' : file));
  });
}

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
