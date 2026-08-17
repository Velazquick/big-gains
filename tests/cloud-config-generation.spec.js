import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';

const execFileAsync = promisify(execFile);
const GENERATOR_PATH = fileURLToPath(new URL('../scripts/write-cloud-config.mjs', import.meta.url));
const WORKFLOW_PATH = new URL('../.github/workflows/deploy-pages.yml', import.meta.url);

async function generatedConfig(flagValue) {
  const directory = await mkdtemp(join(tmpdir(), 'big-gains-cloud-config-'));
  const scriptsDirectory = join(directory, 'scripts');
  const generatorPath = join(scriptsDirectory, 'write-cloud-config.mjs');
  try {
    await mkdir(scriptsDirectory);
    await copyFile(GENERATOR_PATH, generatorPath);
    const env = {
      ...process.env,
      SUPABASE_URL: 'https://config-generation.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_config_generation'
    };
    if (flagValue === undefined) delete env.BIG_GAINS_AUTOMATIC_RECONCILIATION;
    else env.BIG_GAINS_AUTOMATIC_RECONCILIATION = flagValue;

    const { stderr } = await execFileAsync(process.execPath, [generatorPath], { cwd: directory, env });
    const source = await readFile(join(directory, 'cloud-config.js'), 'utf8');
    const context = { window: {} };
    runInNewContext(source, context);
    return {
      config: JSON.parse(JSON.stringify(context.window.__BIG_GAINS_CLOUD_CONFIG__)),
      stderr
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

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
    if (scenario.warning) expect(result.stderr).toContain('defaulting to false');
    else expect(result.stderr).toBe('');
  });
}

test('Pages passes the automatic-reconciliation Actions variable to the config generator', async () => {
  const workflow = await readFile(WORKFLOW_PATH, 'utf8');
  expect(workflow).toContain('BIG_GAINS_AUTOMATIC_RECONCILIATION: ${{ vars.BIG_GAINS_AUTOMATIC_RECONCILIATION }}');
  expect(workflow).not.toMatch(/BIG_GAINS_AUTOMATIC_RECONCILIATION:\s*\$\{\{\s*secrets\./);
});
