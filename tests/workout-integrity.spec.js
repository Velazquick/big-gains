import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { blankState, activeWorkout, completedWorkout } from './fixtures/local-storage.js';

async function seed(page, { corrupt = null, kind = 'managed-owner' } = {}) {
  const workout = activeWorkout({ startedAt: new Date().toISOString() });
  workout.exercises[0].sets[1].completed = true;
  const value = { ...blankState('jorge'), workouts: [completedWorkout()], activeWorkout: workout };
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
  await page.waitForFunction(() => (window.BigGainsAppRuntime?.initialized || window.bigGainsStatePersistence)
    && BigGainsBootGate.status().state !== 'unresolved');
}

const raw = page => page.evaluate(() => localStorage.getItem(bigGainsAccounts.registry.loadActive().storageKey));

for (const kind of ['managed-owner', 'independent', 'managed-member', 'guest']) {
  test(`completed History survives stale tab writes in ${kind}`, async ({ page, context }) => {
    await seed(page, { kind });
    const other = await context.newPage();
    await open(other);
    expect(await other.evaluate(() => ({ writer: bigGainsStatePersistence.writerStatus(), sync: typeof window.BigGainsCloudSync }))).toEqual({ writer: 'occupied', sync: 'undefined' });
    expect(await page.evaluate(() => workoutSessionController.complete())).toBe(true);
    const committed = await raw(page);
    expect(JSON.parse(committed).workouts).toHaveLength(2);
    expect(await other.evaluate(committed => {
      try { bigGainsStatePersistence.writeRawOwnedState(bigGainsAccounts.registry.loadActive().storageKey, committed); return null; }
      catch (error) { return error.code; }
    }, committed)).toBe('local-writer-unavailable');
    await other.evaluate(() => {
      try { workoutSessionController.updateSet(0, 1, 'reps', 99); } catch {}
      try { workoutSessionController.complete(); } catch {}
      window.dispatchEvent(new Event('pagehide'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await raw(other)).toBe(committed);
    await page.close();
    // No automatic promotion of the old in-memory document when the owner exits.
    await other.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await raw(other)).toBe(committed);
    await other.reload();
    await other.waitForFunction(() => BigGainsBootGate.canRender());
    expect(await other.evaluate(() => ({ history: state.workouts.length, active: active?.id ?? null }))).toEqual({ history: 2, active: null });
  });
}

for (const action of ['discard', 'complete']) {
  test(`failed ${action} keeps recoverable workout and usable controls`, async ({ page }) => {
    await seed(page);
    const before = await raw(page);
    const result = await page.evaluate(action => {
      const before = structuredClone(active), deadline = state.restTimerEndsAt;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key === ACCOUNT.storageKey) throw new DOMException('Synthetic quota', 'QuotaExceededError'); return original.call(this, key, value); };
      let outcome, error;
      try { outcome = workoutSessionController[action](); } catch (e) { error = e.name; }
      Storage.prototype.setItem = original;
      return { outcome, error, before, after: structuredClone(active), deadline, afterDeadline: state.restTimerEndsAt };
    }, action);
    expect(result.outcome).toBe(false);
    expect(result.error).toBeUndefined();
    expect(result.after).toEqual(result.before);
    expect(result.afterDeadline).toBe(result.deadline);
    expect(await raw(page)).toBe(before);
    await expect(page.locator('#activePanel')).toBeVisible();
    await expect(page.locator('#cancelWorkout')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(JSON.parse(await raw(page)).activeWorkout.id).toBe(result.before.id);
    await page.reload();
    await page.waitForFunction(() => BigGainsBootGate.canRender());
    expect(await page.evaluate(() => active.id)).toBe(result.before.id);
  });
}

test('deferred completion cannot advance a replacement workout', async ({ page }) => {
  await seed(page);
  const result = await page.evaluate(() => {
    const original = requestAnimationFrame, callbacks = [];
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
    active.exercises[0].sets.forEach(set => { set.completed = true; });
    active.exercises[0].sets[1].completed = false;
    workoutSessionController.toggleSetCompleted(0, 1);
    const replacement = structuredClone(active);
    replacement.id = 'replacement'; replacement.exercises[0].collapsed = false;
    replacement.exercises.push({ ...structuredClone(replacement.exercises[0]), id: 'lat-pulldown', sets: [{ id: 'new-set', weight: 90, reps: 10, warmup: false, completed: false }] });
    active = replacement; state.activeWorkout = replacement;
    const before = JSON.stringify(replacement);
    callbacks.slice().forEach(callback => callback());
    window.requestAnimationFrame = original;
    return { scheduled: callbacks.length, before, after: JSON.stringify(active) };
  });
  expect(result.scheduled).toBeGreaterThan(0);
  expect(result.after).toBe(result.before);
});

test('corrupt boot preserves original bytes through background and reload', async ({ page }) => {
  const corrupt = '{synthetic-unreadable-workout';
  await seed(page, { corrupt });
  expect(await raw(page)).toBe(corrupt);
  await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await raw(page)).toBe(corrupt);
  await page.reload();
  await page.waitForFunction(() => window.BigGainsAppRuntime?.initialized);
  expect(await raw(page)).toBe(corrupt);
});

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

test('external drift cannot be legitimized by loading again or raw recovery writes', async ({ page }) => {
  await seed(page);
  const result = await page.evaluate(() => {
    const newer = JSON.stringify({ ...state, activeWorkout: null, workouts: [{ ...state.workouts[0], id: 'newer-authority' }, ...state.workouts] });
    localStorage.setItem(ACCOUNT.storageKey, newer);
    statePersistenceApi.load();
    const errors = [];
    for (const action of [() => statePersistenceApi.save(state, active), () => bigGainsStatePersistence.writeRawOwnedState(ACCOUNT.storageKey, '{}'), () => bigGainsStatePersistence.removeRawOwnedState(ACCOUNT.storageKey)]) {
      try { action(); errors.push(null); } catch (error) { errors.push(error.code); }
    }
    window.dispatchEvent(new Event('pagehide'));
    return { newer, stored: localStorage.getItem(ACCOUNT.storageKey), errors };
  });
  expect(result.errors.every(Boolean)).toBe(true);
  expect(result.stored).toBe(result.newer);
  await page.reload();
  await page.waitForFunction(() => BigGainsBootGate.canRender());
  expect(await page.evaluate(() => state.workouts[0].id)).toBe('newer-authority');
});

test('cached document retires its profile and queue write ownership', async ({ page, context }) => {
  await seed(page);
  const before = await raw(page);
  const result = await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    BigGainsBootGate.authorize();
    let error;
    try { statePersistenceApi.save(state, active); } catch (failure) { error = failure.code; }
    return { error, gate: BigGainsBootGate.status().state, writer: bigGainsStatePersistence.writerStatus() };
  });
  expect(result).toEqual({ error: 'local-writer-unavailable', gate: 'recovery', writer: 'retired' });
  expect(await raw(page)).toBe(before);
  const other = await context.newPage();
  await open(other);
  expect(await other.evaluate(() => bigGainsStatePersistence.writerStatus())).toBe('owned');
  expect(await raw(other)).toBe(before);
});

test('failed Finish can retry exactly once without duplicating completed History', async ({ page }) => {
  await seed(page);
  const result = await page.evaluate(() => {
    const before = localStorage.getItem(ACCOUNT.storageKey), original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === ACCOUNT.storageKey) throw new DOMException('Interrupted', 'QuotaExceededError'); return original.call(this, key, value); };
    const failed = workoutSessionController.complete();
    const unchanged = localStorage.getItem(ACCOUNT.storageKey) === before;
    Storage.prototype.setItem = original;
    return { failed, unchanged, success: workoutSessionController.complete(), repeated: workoutSessionController.complete(), stored: JSON.parse(localStorage.getItem(ACCOUNT.storageKey)) };
  });
  expect(result.failed).toBe(false);
  expect(result.unchanged).toBe(true);
  expect(result.success).toBe(true);
  expect(result.repeated).toBe(false);
  expect(result.stored.workouts).toHaveLength(2);
  expect(result.stored.activeWorkout).toBeNull();
});

test('post-commit sync capture failure cannot restore completed session', async ({ page }) => {
  await seed(page);
  const result = await page.evaluate(() => {
    const original = queueMicrotask;
    window.queueMicrotask = () => { throw new Error('Synthetic capture setup failure'); };
    const success = workoutSessionController.complete();
    window.queueMicrotask = original;
    return { success, active: active?.id ?? null, stored: JSON.parse(localStorage.getItem(ACCOUNT.storageKey)) };
  });
  expect(result.success).toBe(true);
  expect(result.active).toBeNull();
  expect(result.stored.activeWorkout).toBeNull();
  expect(result.stored.workouts).toHaveLength(2);
  await page.reload();
  await page.waitForFunction(() => BigGainsBootGate.canRender());
  expect(await page.evaluate(() => active)).toBeNull();
});

test('unreadable queue cannot be replaced by a new operation', async ({ page }) => {
  await seed(page);
  const result = await page.evaluate(() => {
    const key = '__synthetic_queue', corrupt = '{pending-evidence';
    localStorage.setItem(key, corrupt);
    const queue = BigGainsCloud.createDurableQueue({ key });
    const operation = BigGainsCloud.createOperation({ owner: { accountId: 'synthetic', profileId: 'synthetic' }, entityType: 'workouts', entityId: 'synthetic-workout', mutation: 'upsert', payload: { id: 'synthetic-workout' }, version: 1 });
    let error;
    try { queue.enqueue(operation); } catch (failure) { error = failure.message; }
    return { error, stored: localStorage.getItem(key), corrupt, pending: queue.pending().length };
  });
  expect(result.error).toContain('original data is protected');
  expect(result.stored).toBe(result.corrupt);
  expect(result.pending).toBe(0);
});
