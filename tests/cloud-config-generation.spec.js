import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';

const execFileAsync = promisify(execFile);
const GENERATOR_PATH = fileURLToPath(new URL('../scripts/write-cloud-config.mjs', import.meta.url));
const MANIFEST_PATH = fileURLToPath(new URL('../asset-manifest.js', import.meta.url));
const INDEX_PATH = fileURLToPath(new URL('../index.html', import.meta.url));
const AUTH_SETUP_PATH = fileURLToPath(new URL('../auth-setup.html', import.meta.url));
const SERVICE_WORKER_PATH = fileURLToPath(new URL('../service-worker.js', import.meta.url));
const WORKFLOW_PATH = new URL('../.github/workflows/deploy-pages.yml', import.meta.url);

async function withGenerationWorkspace(callback) {
  const directory = await mkdtemp(join(tmpdir(), 'big-gains-cloud-config-'));
  const scriptsDirectory = join(directory, 'scripts');
  const generatorPath = join(scriptsDirectory, 'write-cloud-config.mjs');
  try {
    await mkdir(scriptsDirectory);
    await copyFile(GENERATOR_PATH, generatorPath);
    await copyFile(MANIFEST_PATH, join(directory, 'asset-manifest.js'));
    await copyFile(INDEX_PATH, join(directory, 'index.html'));
    await copyFile(AUTH_SETUP_PATH, join(directory, 'auth-setup.html'));
    await copyFile(SERVICE_WORKER_PATH, join(directory, 'service-worker.js'));
    return await callback({ directory, generatorPath });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function generate({ directory, generatorPath }, flagValue) {
  const env = {
    ...process.env,
    SUPABASE_URL: 'https://config-generation.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_config_generation'
  };
  if (flagValue === undefined) delete env.BIG_GAINS_AUTOMATIC_RECONCILIATION;
  else env.BIG_GAINS_AUTOMATIC_RECONCILIATION = flagValue;

  const { stdout, stderr } = await execFileAsync(process.execPath, [generatorPath], { cwd: directory, env });
  const source = await readFile(join(directory, 'cloud-config.js'), 'utf8');
  const manifestSource = await readFile(join(directory, 'asset-manifest.js'), 'utf8');
  const indexSource = await readFile(join(directory, 'index.html'), 'utf8');
  const authSetupSource = await readFile(join(directory, 'auth-setup.html'), 'utf8');
  const serviceWorkerSource = await readFile(join(directory, 'service-worker.js'), 'utf8');
  const configContext = { window: {} };
  const manifestContext = {};
  runInNewContext(source, configContext);
  runInNewContext(manifestSource, manifestContext);
  const manifest = JSON.parse(JSON.stringify(manifestContext.BIG_GAINS_ASSET_MANIFEST));
  return {
    config: JSON.parse(JSON.stringify(configContext.window.__BIG_GAINS_CLOUD_CONFIG__)),
    configUrl: manifest.scripts.find(path => path.startsWith('./cloud-config.js?')),
    expectedVersion: `config-${createHash('sha256').update(source).digest('hex').slice(0, 16)}`,
    htmlManifestUrls: [indexSource, authSetupSource].map(html => (
      `./${html.match(/<script src="([^"]+)" data-big-gains-manifest><\/script>/)?.[1]}`
    )),
    manifest,
    workerManifestUrl: serviceWorkerSource.match(/importScripts\('([^']+)', '\.\/service-worker-core\.js'\);/)?.[1],
    stderr,
    stdout
  };
}

async function generatedConfig(flagValue) {
  return withGenerationWorkspace(workspace => generate(workspace, flagValue));
}

test('OFF, ON, and rollback OFF use deterministic payload versions and generated client references', async () => {
  await withGenerationWorkspace(async workspace => {
    const off = await generate(workspace, 'false');
    const on = await generate(workspace, 'true');
    const rollback = await generate(workspace, 'false');
    const unexpected = await generate(workspace, 'unexpected');

    expect(off.config.automaticReconciliation).toBe(false);
    expect(on.config.automaticReconciliation).toBe(true);
    expect(rollback.config.automaticReconciliation).toBe(false);
    expect(unexpected.config.automaticReconciliation).toBe(false);
    expect(on.manifest.cloudConfigVersion).not.toBe(off.manifest.cloudConfigVersion);
    expect(rollback.manifest.cloudConfigVersion).toBe(off.manifest.cloudConfigVersion);
    expect(rollback.configUrl).toBe(off.configUrl);
    expect(unexpected.configUrl).toBe(off.configUrl);

    for (const result of [off, on, rollback, unexpected]) {
      expect(result.manifest.cloudConfigVersion).toBe(result.expectedVersion);
      expect(result.configUrl).toBe(`./cloud-config.js?v=${result.expectedVersion}`);
      expect(result.configUrl).not.toBe(`./cloud-config.js?v=${result.manifest.release}`);
      expect(result.manifest.authSetupScripts).toContain(result.configUrl);
      expect(result.manifest.deploymentVersion).toBe(`${result.manifest.release}-${result.expectedVersion}`);
      expect(result.htmlManifestUrls).toEqual([result.manifest.manifestAsset, result.manifest.manifestAsset]);
      expect(result.workerManifestUrl).toBe(result.manifest.manifestAsset);
      expect(result.manifest.coreAssets).toContain(result.manifest.manifestAsset);
      expect(result.manifest.cacheName).toContain(result.expectedVersion);
      expect(result.manifest.runtimeCacheName).toContain(result.expectedVersion);
    }
  });
});

for (const scenario of [
  { label: 'missing', value: undefined, expected: false },
  { label: 'false', value: 'false', expected: false },
  { label: 'case-normalized true', value: 'TrUe', expected: true },
  { label: 'unexpected', value: '1', expected: false, warning: true }
]) {
  test(`generated cloud config treats ${scenario.label} automatic reconciliation as ${scenario.expected}`, async () => {
    const result = await generatedConfig(scenario.value);
    expect(result.config).toMatchObject({
      supabaseUrl: 'https://config-generation.supabase.co',
      supabasePublishableKey: 'sb_publishable_config_generation',
      automaticReconciliation: scenario.expected
    });
    expect(result.manifest.cloudConfigVersion).toBe(result.expectedVersion);
    expect(result.stdout).toContain(`Wrote browser config version ${result.expectedVersion}.`);
    if (scenario.warning) expect(result.stderr).toContain('defaulting to false');
    else expect(result.stderr).toBe('');
  });
}

test('Pages passes and validates the automatic-reconciliation deployment config version', async () => {
  const workflow = await readFile(WORKFLOW_PATH, 'utf8');
  expect(workflow).toContain('BIG_GAINS_AUTOMATIC_RECONCILIATION: ${{ vars.BIG_GAINS_AUTOMATIC_RECONCILIATION }}');
  expect(workflow).not.toMatch(/BIG_GAINS_AUTOMATIC_RECONCILIATION:\s*\$\{\{\s*secrets\./);
  expect(workflow).toContain('manifest.cloudConfigVersion');
  expect(workflow).toContain('./cloud-config.js?v=${manifest.cloudConfigVersion}');
});
