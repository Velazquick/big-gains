import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

export const releaseFiles = [
  'asset-manifest.js', 'index.html', 'auth-setup.html', 'service-worker.js',
  'tests/offline.spec.js', 'tests/helpers/telemetry.js', 'tests/user-data-export.spec.js',
  'tests/startup-interactivity.spec.js', 'tests/pwa-update.spec.js'
];

export async function readReleaseSources(root = new URL('../', import.meta.url)) {
  return new Map(await Promise.all(releaseFiles.map(async file =>
    [file, await readFile(new URL(file, root), 'utf8')])));
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
  function pin(file, pattern, expected, label) {
    const matches = [...sources.get(file).matchAll(pattern)];
    if (matches.length !== 1 || matches[0][1] !== expected) {
      errors.push(`${file}: ${label} must occur once and equal ${expected}`);
    }
  }
  const deployment = `${manifest.release}-${manifest.cloudConfigVersion}`;
  if (manifest.deploymentVersion !== deployment) errors.push('asset-manifest.js: inconsistent deployment version');
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
  return { release: manifest.release, cloudConfigVersion: manifest.cloudConfigVersion };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkReleaseSources(await readReleaseSources());
    console.log(`Release references consistent: ${result.release} (${result.cloudConfigVersion})`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
