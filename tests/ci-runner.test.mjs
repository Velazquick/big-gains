import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const childEnvironment = { ...process.env };
// A standalone test-runner subprocess must not inherit a Node test worker's
// internal recursive-run marker, which suppresses its real test execution.
delete childEnvironment.NODE_TEST_CONTEXT;

test('browser collection never executes Node tests as Playwright specs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'big-gains-ci-collection-'));
  try {
    const config = new URL('../playwright.config.js', import.meta.url).href;
    const playwright = new URL('../node_modules/@playwright/test/index.mjs', import.meta.url).href;
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    await writeFile(join(directory, 'playwright.config.mjs'), `import original from ${JSON.stringify(config)}; export default {...original,testDir:'.',webServer:undefined};`);
    await writeFile(join(directory, 'browser.spec.js'), `import {test} from ${JSON.stringify(playwright)}; test('browser sentinel',()=>{});`);
    await writeFile(join(directory, 'node.test.mjs'), "throw new Error('Node tests were imported by browser discovery');");
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/playwright/cli.js', import.meta.url)), 'test', '--list', '--config', join(directory, 'playwright.config.mjs')], { encoding: 'utf8', env: childEnvironment });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /browser sentinel/);
    assert.doesNotMatch(result.stdout + result.stderr, /Node tests were imported/);
  } finally { await removeFixture(directory); }
});

test('the explicit Node runner propagates a failing test to the caller', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'big-gains-ci-node-'));
  try {
    await writeFile(join(directory, 'failure.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';test('deliberate failure',()=>assert.fail('sentinel'));");
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/run-unit-tests.mjs', import.meta.url)), directory], { encoding: 'utf8', env: childEnvironment });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /deliberate failure/);
  } finally { await removeFixture(directory); }
});

async function removeFixture(directory) {
  assert.equal(dirname(directory), tmpdir());
  assert.match(basename(directory), /^big-gains-ci-(?:collection|node)-/);
  await rm(directory, { recursive: true, force: true });
}
