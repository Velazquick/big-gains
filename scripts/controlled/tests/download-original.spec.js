import { expect, test } from '../download-fixture.mjs';
import { readFile } from 'node:fs/promises';
import { blankState, activeWorkout, completedWorkout } from '../../../tests/fixtures/local-storage.js';

async function seed(page, { corrupt = null, kind = 'managed-owner', version = 5 } = {}) {
  const workout = activeWorkout({ startedAt: new Date().toISOString() });
  workout.exercises[0].sets[1].completed = true;
  const value = { ...blankState('jorge'), version, workouts: [completedWorkout()], activeWorkout: workout };
  // Include the existing display default so the compatibility assertion can
  // compare the entire History record without conflating UI normalization.
  if (version !== 5) {
    value.workouts.forEach(entry => entry.exercises.forEach(exercise => { exercise.collapsed = true; }));
    value.weights = [{ weight: 0, date: '2026-10-12T12:00:00.000Z' }];
  }
  await page.context().route('**/*', route => new URL(route.request().url()).origin === new URL(test.info().project.use.baseURL).origin ? route.continue() : route.abort());
  await page.addInitScript(({ value, corrupt, kind }) => {
    if (localStorage.getItem('__integrity_seed')) return;
    let key = 'big-gains-v2';
    if (kind === 'independent' || kind === 'managed-member') {
      const authUserId = 'synthetic-user', cloudAccountId = 'synthetic-account', cloudProfileId = 'synthetic-profile';
      const clientId = kind === 'independent' ? 'independent-synthetic' : 'jorge';
      const record = { kind, authUserId, cloudAccountId, cloudProfileId, clientId, displayName: 'Synthetic', newlyProvisioned: false, accessKind: 'managed-member' };
      localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({ version: 1, activeAuthUserId: authUserId, accounts: { [authUserId]: record } }));
      value.profileId = clientId;
      key = kind === 'independent' ? `big-gains-cloud-${cloudAccountId}-${cloudProfileId}-v1` : `big-gains-managed-member-${authUserId}-${cloudAccountId}-${cloudProfileId}-v1`;
    } else if (kind === 'guest') { value.profileId = 'guest'; key = 'big-gains-device-guest-v1'; }
    else localStorage.setItem('big-gains-active-profile', 'jorge');
    localStorage.setItem(key, corrupt ?? JSON.stringify(value));
    localStorage.setItem('__integrity_seed', '1');
  }, { value, corrupt, kind });
  await open(page);
}

async function open(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.bigGainsStatePersistence
    && ((window.BigGainsAppRuntime?.initialized
      && (window.BigGainsRuntimeGate?.canInteract() || BigGainsBootGate.status().state === 'recovery'))
      || (bigGainsStatePersistence.writerStatus() === 'occupied' && BigGainsBootGate.status().state === 'recovery')));
}

const raw = page => page.evaluate(() => localStorage.getItem(bigGainsAccounts.registry.loadActive().storageKey));

for (const corrupt of ['null', '{"version":99,"profileId":"jorge","workouts":[],"weights":[]}', '{"version":5,"profileId":"jorge","workouts":[{"id":"keep-me"}],"weights":[]}']) {
  test(`unreadable structured state remains protected: ${corrupt.slice(0, 24)}`, async ({ page }) => {
    await seed(page, { corrupt });
    expect(await page.evaluate(() => BigGainsBootGate.status().state)).toBe('recovery');
    expect(await page.evaluate(() => {
      try { statePersistenceApi.save(state, active); return null; } catch (error) { return error.code; }
    })).toBe('local-state-unreadable');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await raw(page)).toBe(corrupt);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#downloadRecoveryData').click();
    expect(await readFile(await (await downloadPromise).path(), 'utf8')).toBe(corrupt);
  });
}
