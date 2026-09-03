import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const cloudConfigUrl = new URL('../cloud-config.js', import.meta.url);
const assetManifestUrl = new URL('../asset-manifest.js', import.meta.url);
const indexHtmlUrl = new URL('../index.html', import.meta.url);
const authSetupHtmlUrl = new URL('../auth-setup.html', import.meta.url);
const serviceWorkerUrl = new URL('../service-worker.js', import.meta.url);
const manifestVersionPattern = /^  const cloudConfigVersion = '[^'\r\n]+'; \/\/ BIG_GAINS_CLOUD_CONFIG_VERSION$/m;
const releasePattern = /^  const release = '([^'\r\n]+)';$/m;
const htmlManifestPattern = /<script src="asset-manifest\.js\?v=[^"]+" data-big-gains-manifest><\/script>/;
const workerManifestPattern = /importScripts\('\.\/asset-manifest\.js\?v=[^']+', '\.\/service-worker-core\.js'\);/;

function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(new RegExp(pattern.source, `${pattern.flags}g`)) || [];
  if (matches.length !== 1) throw new Error(`${label} must contain exactly one deployment manifest reference.`);
  return source.replace(pattern, replacement);
}

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabasePublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

function deploymentBoolean(name, rawValue) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  console.warn(`${name} must be "true" or "false"; defaulting to false.`);
  return false;
}

const automaticReconciliation = deploymentBoolean(
  'BIG_GAINS_AUTOMATIC_RECONCILIATION',
  process.env.BIG_GAINS_AUTOMATIC_RECONCILIATION
);
const selfServeSignup = deploymentBoolean(
  'BIG_GAINS_SELF_SERVE_SIGNUP',
  process.env.BIG_GAINS_SELF_SERVE_SIGNUP
);
const programPortability = deploymentBoolean(
  'BIG_GAINS_PROGRAM_PORTABILITY',
  process.env.BIG_GAINS_PROGRAM_PORTABILITY
);

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.');
}

const source = `(() => {\n  'use strict';\n  window.__BIG_GAINS_CLOUD_CONFIG__ = Object.freeze({\n    supabaseUrl: ${JSON.stringify(supabaseUrl)},\n    supabasePublishableKey: ${JSON.stringify(supabasePublishableKey)},\n    automaticReconciliation: ${JSON.stringify(automaticReconciliation)},\n    selfServeSignup: ${JSON.stringify(selfServeSignup)},\n    programPortability: ${JSON.stringify(programPortability)},\n    programPortabilityVersion: ${programPortability ? '1' : 'null'},\n    authRedirectUrl: 'https://app.getbiggains.com/',\n    authSetupRedirectUrl: 'https://app.getbiggains.com/auth-setup.html'\n  });\n})();\n`;

const cloudConfigVersion = `config-${createHash('sha256').update(source).digest('hex').slice(0, 16)}`;
const [manifestSource, indexSource, authSetupSource, serviceWorkerSource] = await Promise.all([
  readFile(assetManifestUrl, 'utf8'),
  readFile(indexHtmlUrl, 'utf8'),
  readFile(authSetupHtmlUrl, 'utf8'),
  readFile(serviceWorkerUrl, 'utf8')
]);
const release = manifestSource.match(releasePattern)?.[1];
if (!release) throw new Error('asset-manifest.js must contain exactly one release marker.');
const versionedManifest = replaceExactlyOnce(
  manifestSource,
  manifestVersionPattern,
  `  const cloudConfigVersion = '${cloudConfigVersion}'; // BIG_GAINS_CLOUD_CONFIG_VERSION`,
  'asset-manifest.js'
);
const deploymentVersion = encodeURIComponent(`${release}-${cloudConfigVersion}`);
const htmlManifestReference = `<script src="asset-manifest.js?v=${deploymentVersion}" data-big-gains-manifest></script>`;
const versionedIndex = replaceExactlyOnce(indexSource, htmlManifestPattern, htmlManifestReference, 'index.html');
const versionedAuthSetup = replaceExactlyOnce(authSetupSource, htmlManifestPattern, htmlManifestReference, 'auth-setup.html');
const versionedServiceWorker = replaceExactlyOnce(
  serviceWorkerSource,
  workerManifestPattern,
  `importScripts('./asset-manifest.js?v=${deploymentVersion}', './service-worker-core.js');`,
  'service-worker.js'
);

await Promise.all([
  writeFile(cloudConfigUrl, source, { mode: 0o600 }),
  writeFile(assetManifestUrl, versionedManifest),
  writeFile(indexHtmlUrl, versionedIndex),
  writeFile(authSetupHtmlUrl, versionedAuthSetup),
  writeFile(serviceWorkerUrl, versionedServiceWorker)
]);

console.log(`Wrote browser config version ${cloudConfigVersion}.`);
