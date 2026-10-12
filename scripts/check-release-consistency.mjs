import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const git = promisify(execFile);
const introducedKey = file => `migration-introduction:${file}`;
const releaseHistoryKey = 'manifest-release-history';

export const releaseFiles = [
  'asset-manifest.js', 'index.html', 'auth-setup.html', 'service-worker.js',
  'tests/offline.spec.js', 'tests/helpers/telemetry.js', 'tests/user-data-export.spec.js',
  'tests/startup-interactivity.spec.js', 'tests/pwa-update.spec.js'
];

export async function readReleaseSources(root = new URL('../', import.meta.url)) {
  const cwd = fileURLToPath(root);
  const shallow = await git('git', ['rev-parse', '--is-shallow-repository'], { cwd });
  if (shallow.stdout.trim() !== 'false') throw new Error('Registration provenance requires complete Git history; fetch unshallow before checking.');
  // Freeze pre-existing migrations at the accepted baseline before this gate
  // was introduced. Earlier merged SQL edits are not repaired by a UI pilot.
  const gateHistory = (await git('git', ['log', '--reverse', '--diff-filter=A', '--format=%H', '--', 'scripts/check-release-consistency.mjs'], { cwd })).stdout.trim();
  const gateIntroduction = gateHistory.split(/\s+/)[0];
  const gateParents = gateIntroduction ? (await git('git', ['rev-list', '--parents', '-n', '1', gateIntroduction], { cwd })).stdout.trim().split(/\s+/) : [];
  const checkpoint = gateParents[1];
  const checkpointPaths = checkpoint ? (await git('git', ['ls-tree', '-r', '--name-only', checkpoint, '--', 'supabase/migrations'], { cwd })).stdout.trim().split('\n') : [];
  const committedPaths = (await git('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'supabase/migrations'], { cwd })).stdout.trim().split('\n');
  const indexPaths = (await git('git', ['ls-files', '--', 'supabase/migrations'], { cwd })).stdout.trim().split('\n');
  const diskPaths = (await readdir(new URL('supabase/migrations/', root))).map(file => `supabase/migrations/${file}`);
  const migrations = [...new Set([...diskPaths, ...committedPaths, ...indexPaths, ...checkpointPaths])]
    .filter(file => /^supabase\/migrations\/\d{14}_.*\.sql$/.test(file));
  const sources = new Map(await Promise.all([...releaseFiles, ...migrations].map(async file => {
    try { return [file, await readFile(new URL(file, root), 'utf8')]; }
    catch (error) { if (migrations.includes(file) && error.code === 'ENOENT') return [file, '']; throw error; }
  })));
  const manifestHistory = await git('git', ['log', '--reverse', '--format=', '-p', '--', 'asset-manifest.js'], { cwd });
  const releases = [...manifestHistory.stdout.matchAll(/^\+\s*const release = ['"]([^'"]+)['"];$/gm)].map(match => match[1]);
  if (!releases.length) throw new Error('Manifest release provenance requires recorded release history.');
  sources.set(releaseHistoryKey, JSON.stringify(releases.filter((release, index) => index === 0 || release !== releases[index - 1])));
  await Promise.all(migrations.map(async file => {
    // Use path introduction, not --follow: copy detection can incorrectly trace
    // a genuinely new registration back to a similar historical SQL file.
    const history = await git('git', ['log', '--reverse', '--diff-filter=A', '--format=%H', '--', file], { cwd });
    const introduction = history.stdout.trim().split(/\s+/)[0];
    const committed = committedPaths.includes(file);
    const reference = checkpointPaths.includes(file) ? checkpoint : introduction;
    const original = reference ? (await git('git', ['show', `${reference}:${file}`], { cwd })).stdout : committed ? '' : sources.get(file);
    const staged = indexPaths.includes(file) ? (await git('git', ['show', `:${file}`], { cwd })).stdout : null;
    const isRegistration = sql => /insert\s+into\s+private\.product_releases/i.test(sql || '');
    if (![original, staged, sources.get(file)].some(isRegistration)) return;
    if (staged !== null && staged.replace(/\r\n/g, '\n') !== sources.get(file).replace(/\r\n/g, '\n')) {
      throw new Error(`${file}: registration index and worktree differ; stage the reviewed contents before checking`);
    }
    sources.set(introducedKey(file), original);
  }));
  sources.set('registration-provenance-baseline', checkpoint || 'path-introduction');
  return sources;
}

export function registrationFor(sources, release) {
  return [...sources].find(([file, sql]) => /^supabase\/migrations\/\d{14}_operator_.*\.sql$/.test(file)
    && sources.has(introducedKey(file))
    && sql.replace(/\r\n/g, '\n') === sources.get(introducedKey(file)).replace(/\r\n/g, '\n')
    && [...sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '').matchAll(/insert\s+into\s+private\.product_releases\s*\(\s*release\s*\)\s*values\s*\(\s*'([^']+)'\s*\)\s*on\s+conflict\s+do\s+nothing\s*;/gi)]
      .some(match => match[1] === release))?.[0] || null;
}

// Inspect only current-release contracts. Prior caches, retained telemetry
// episodes, and synthetic fixtures deliberately contain historical releases.
export function checkReleaseSources(sources) {
  const scope = {};
  runInNewContext(sources.get('asset-manifest.js'), scope, { timeout: 1000 });
  const manifest = scope.BIG_GAINS_ASSET_MANIFEST;
  if (!manifest || !/^v\d+-[a-z0-9-]+$/.test(manifest.release)
      || !/^config-[a-f0-9]{16}$/.test(manifest.cloudConfigVersion)) {
    throw new Error('asset-manifest.js: missing or invalid release/config version');
  }
  const errors = [];
  for (const [key, original] of sources) {
    if (!key.startsWith('migration-introduction:')) continue;
    const file = key.slice('migration-introduction:'.length);
    if ((sources.get(file) || '').replace(/\r\n/g, '\n') !== original.replace(/\r\n/g, '\n')) {
      errors.push(`${file}: historical registration must remain unchanged; add a fresh migration rather than rewriting or deleting an existing one`);
    }
  }
  const releaseHistory = JSON.parse(sources.get(releaseHistoryKey) || 'null');
  if (!Array.isArray(releaseHistory) || !releaseHistory.length) {
    errors.push('asset-manifest.js: complete release history is required');
  } else if (releaseHistory.slice(0, releaseHistory.at(-1) === manifest.release ? -1 : undefined).includes(manifest.release)) {
    errors.push('asset-manifest.js: a retired release ID cannot be reused; choose a fresh release and registration');
  }
  const registrationMigration = registrationFor(sources, manifest.release);
  if (!registrationMigration) errors.push('supabase/migrations: current release requires an unchanged operator-classified product_releases registration; add a fresh migration rather than rewriting an existing one');
  function pin(file, pattern, expected, label) {
    const matches = [...sources.get(file).matchAll(pattern)];
    if (matches.length !== 1 || matches[0][1] !== expected) {
      errors.push(`${file}: ${label} must occur once and equal ${expected}`);
    }
  }
  const deployment = `${manifest.release}-${manifest.cloudConfigVersion}`;
  if (manifest.deploymentVersion !== deployment) errors.push('asset-manifest.js: inconsistent deployment version');
  if (manifest.cacheName !== `${manifest.cachePrefix}${deployment}`) errors.push('asset-manifest.js: inconsistent cacheName');
  if (manifest.runtimeCacheName !== `${manifest.runtimeCachePrefix}${deployment}`) errors.push('asset-manifest.js: inconsistent runtimeCacheName');
  const manifestAsset = `./asset-manifest.js?v=${encodeURIComponent(deployment)}`;
  if (manifest.manifestAsset !== manifestAsset) errors.push('asset-manifest.js: inconsistent manifestAsset URL');
  if (!manifest.coreAssets.includes(manifestAsset)) errors.push('asset-manifest.js: offline core omits current manifestAsset URL');
  for (const file of ['index.html', 'auth-setup.html', 'service-worker.js']) {
    pin(file, /asset-manifest\.js\?v=([^"'\s]+)/g, encodeURIComponent(deployment), 'deployment manifest reference');
  }
  pin('index.html', /product-telemetry\.js\?v=([^"'\s]+)/g, manifest.release, 'telemetry asset version');
  pin('tests/offline.spec.js', /const CURRENT_RELEASE = '([^']+)';/g, manifest.release, 'CURRENT_RELEASE');
  pin('tests/offline.spec.js', /const CURRENT_CONFIG_VERSION = '([^']+)';/g, manifest.cloudConfigVersion, 'CURRENT_CONFIG_VERSION');
  pin('tests/helpers/telemetry.js', /expect\(event\.release\)\.toBe\('([^']+)'\)/g, manifest.release, 'current telemetry expectation');
  pin('tests/user-data-export.spec.js', /metadata:\s*\{\s*exportedAt: EXPORTED_AT, appVersion: '([^']+)'/g, manifest.release, 'current export expectation');
  pin('tests/startup-interactivity.spec.js', /expect\(result\.release\)\.toBe\('([^']+)'\)/g, manifest.release, 'current startup expectation');
  pin('tests/pwa-update.spec.js', /const RELEASE = '([^']+)';/g, manifest.release, 'current PWA harness RELEASE');
  for (const key of ['styles', 'scripts', 'authSetupStyles', 'authSetupScripts']) {
    for (const asset of manifest[key]) {
      const url = new URL(asset, 'https://synthetic.invalid/');
      const expected = url.pathname === '/cloud-config.js' ? manifest.cloudConfigVersion : manifest.release;
      if (url.searchParams.get('v') !== expected) errors.push(`asset-manifest.js: stale ${key} asset ${asset}`);
      if (!manifest.coreAssets.includes(asset)) errors.push(`asset-manifest.js: offline core omits ${asset}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { release: manifest.release, cloudConfigVersion: manifest.cloudConfigVersion, registrationMigration, registrationProvenanceBaseline: sources.get('registration-provenance-baseline') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkReleaseSources(await readReleaseSources());
    console.log(`Release references consistent: ${result.release} (${result.cloudConfigVersion})`);
    console.log(`Registration artifact: ${result.registrationMigration} (hosted application requires separate verification)`);
    console.log(`Registration immutability baseline: ${result.registrationProvenanceBaseline}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
