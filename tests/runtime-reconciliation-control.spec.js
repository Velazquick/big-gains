import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openApp } from './helpers/app.js';

const functionSourceUrl = new URL('../supabase/functions/reconciliation-control/index.ts', import.meta.url);
const supabaseConfigUrl = new URL('../supabase/config.toml', import.meta.url);
const functionEnvExampleUrl = new URL('../supabase/functions/.env.example', import.meta.url);

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('accepts only the revision-1 boolean true payload and sends an uncached authenticated invocation', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const calls = [];
    const control = BigGainsReconciliationControl.create({
      supabaseBoundary: {
        async session() { return { access_token: 'synthetic-user-jwt', user: { id: 'synthetic-user' } }; },
        getClient() {
          return { functions: { async invoke(name, options) {
            calls.push({ name, options: { ...options, signal: Boolean(options.signal) } });
            return { data: { automaticReconciliation: true, revision: 1 }, error: null };
          } } };
        }
      }
    });
    return { decision: await control.check(), calls };
  });

  expect(result.decision).toMatchObject({ enabled: true, reason: 'runtime-on', revision: 1 });
  expect(result.calls).toEqual([{
    name: 'reconciliation-control',
    options: {
      body: {},
      headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
      signal: true
    }
  }]);
});

for (const scenario of [
  { label: 'false', payload: { automaticReconciliation: false, revision: 1 }, reason: 'runtime-off', detail: 'remote-disabled' },
  { label: 'missing value', payload: { revision: 1 }, reason: 'runtime-unavailable', detail: 'invalid-value' },
  { label: 'numeric one', payload: { automaticReconciliation: 1, revision: 1 }, reason: 'runtime-unavailable', detail: 'invalid-value' },
  { label: 'yes string', payload: { automaticReconciliation: 'yes', revision: 1 }, reason: 'runtime-unavailable', detail: 'invalid-value' },
  { label: 'missing revision', payload: { automaticReconciliation: true }, reason: 'runtime-unavailable', detail: 'invalid-revision' },
  { label: 'stale revision', payload: { automaticReconciliation: true, revision: 0 }, reason: 'runtime-unavailable', detail: 'invalid-revision' },
  { label: 'future revision', payload: { automaticReconciliation: true, revision: 2 }, reason: 'runtime-unavailable', detail: 'invalid-revision' },
  { label: 'malformed JSON result', payload: '{not-json', reason: 'runtime-unavailable', detail: 'invalid-json' }
]) {
  test(`fails closed for ${scenario.label}`, async ({ page }) => {
    const decision = await page.evaluate(async payload => {
      const control = BigGainsReconciliationControl.create({
        supabaseBoundary: {
          async session() { return { access_token: 'synthetic-user-jwt', user: { id: 'synthetic-user' } }; },
          getClient() { return { functions: { async invoke() { return { data: payload, error: null }; } } }; }
        }
      });
      return control.check();
    }, scenario.payload);
    expect(decision).toMatchObject({ enabled: false, reason: scenario.reason, detail: scenario.detail });
  });
}

for (const status of [401, 403]) {
  test(`fails closed for HTTP ${status}`, async ({ page }) => {
    const decision = await page.evaluate(async statusCode => {
      const control = BigGainsReconciliationControl.create({
        supabaseBoundary: {
          async session() { return { access_token: 'synthetic-user-jwt', user: { id: 'synthetic-user' } }; },
          getClient() {
            return { functions: { async invoke() {
              return { data: null, error: { context: { status: statusCode } }, response: { status: statusCode } };
            } } };
          }
        }
      });
      return control.check();
    }, status);
    expect(decision).toMatchObject({ enabled: false, reason: 'runtime-unavailable', detail: `http-${status}` });
  });
}

test('fails closed on network failure and timeout', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const session = async () => ({ access_token: 'synthetic-user-jwt', user: { id: 'synthetic-user' } });
    const failed = BigGainsReconciliationControl.create({
      supabaseBoundary: {
        session,
        getClient() { return { functions: { async invoke() { throw new Error('synthetic network failure'); } } }; }
      }
    });
    const timedOut = BigGainsReconciliationControl.create({
      timeoutMs: 20,
      supabaseBoundary: {
        session,
        getClient() { return { functions: { invoke() { return new Promise(() => {}); } } }; }
      }
    });
    return { failed: await failed.check(), timedOut: await timedOut.check() };
  });

  expect(result.failed).toMatchObject({ enabled: false, reason: 'runtime-unavailable', detail: 'request-failed' });
  expect(result.timedOut).toMatchObject({ enabled: false, reason: 'runtime-unavailable', detail: 'timeout' });
});

test('signed-out checks fail closed without invoking the function', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let calls = 0;
    const control = BigGainsReconciliationControl.create({
      supabaseBoundary: {
        async session() { return null; },
        getClient() { return { functions: { async invoke() { calls += 1; } } }; }
      }
    });
    return { decision: await control.check(), calls };
  });
  expect(result).toMatchObject({
    decision: { enabled: false, reason: 'runtime-unavailable', detail: 'signed-out' },
    calls: 0
  });
});

test('every opportunity performs a fresh check and never reuses an earlier ON result', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const payloads = [
      { automaticReconciliation: true, revision: 1 },
      { automaticReconciliation: false, revision: 1 }
    ];
    let calls = 0;
    const control = BigGainsReconciliationControl.create({
      supabaseBoundary: {
        async session() { return { access_token: 'synthetic-user-jwt', user: { id: 'synthetic-user' } }; },
        getClient() { return { functions: { async invoke() { return { data: payloads[calls++], error: null }; } } }; }
      }
    });
    return { first: await control.check(), second: await control.check(), calls, status: control.status() };
  });

  expect(result.calls).toBe(2);
  expect(result.first).toMatchObject({ enabled: true, reason: 'runtime-on' });
  expect(result.second).toMatchObject({ enabled: false, reason: 'runtime-off' });
  expect(result.status).toEqual(result.second);
});

test('runtime control failure does not block local-first persistence or durable enqueue', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const control = BigGainsReconciliationControl.create({
      supabaseBoundary: {
        async session() { return { access_token: 'synthetic-user-jwt', user: { id: 'synthetic-user' } }; },
        getClient() { return { functions: { async invoke() { throw new Error('offline'); } } }; }
      }
    });
    const decision = await control.check();
    const workout = { id: 'runtime-outage-local-first', completedAt: '2026-08-17T12:00:00.000Z' };
    const operation = await BigGainsCloudSync.enqueueSyntheticCompletedWorkout({
      owner: { accountId: 'synthetic-account', profileId: 'synthetic-profile' },
      workout,
      persistLocal(value) { localStorage.setItem('runtime-outage-local-first', JSON.stringify(value)); }
    });
    return {
      decision,
      operation,
      local: JSON.parse(localStorage.getItem('runtime-outage-local-first')),
      pending: BigGainsCloudSync.queue.pending().some(item => item.entityId === workout.id)
    };
  });

  expect(result.decision).toMatchObject({ enabled: false, reason: 'runtime-unavailable' });
  expect(result.local.id).toBe('runtime-outage-local-first');
  expect(result.operation.entityId).toBe('runtime-outage-local-first');
  expect(result.pending).toBe(true);
});

test('Edge Function defaults OFF, requires JWT verification, and marks every response no-store', async () => {
  const [source, config, envExample] = await Promise.all([
    readFile(functionSourceUrl, 'utf8'),
    readFile(supabaseConfigUrl, 'utf8'),
    readFile(functionEnvExampleUrl, 'utf8')
  ]);

  expect(source).toContain("Deno.env.get('BIG_GAINS_AUTOMATIC_RECONCILIATION') === 'true'");
  expect(source).toContain("'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'");
  expect(source).toContain("'Pragma': 'no-cache'");
  expect(source).toContain("'Expires': '0'");
  expect(source).toContain('revision: 1');
  expect(config).toMatch(/\[functions\.reconciliation-control\]\s+verify_jwt = true/);
  expect(envExample).toContain('BIG_GAINS_AUTOMATIC_RECONCILIATION=false');
});
