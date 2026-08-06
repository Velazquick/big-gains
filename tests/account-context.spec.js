import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test('maps the deployed identities to their existing keys without writing during resolution', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'alexa' });
  await openApp(page);

  const result = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    const writes = [];
    Storage.prototype.setItem = function (key, value) {
      writes.push({ key, value });
      return original.call(this, key, value);
    };
    try {
      const jorge = bigGainsAccounts.registry.resolve('local-jorge');
      const alexa = bigGainsAccounts.registry.resolve('alexa');
      const active = bigGainsAccounts.registry.loadActive();
      return { jorge, alexa, active, writes };
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  expect(result.jorge).toMatchObject({ accountId: 'local-jorge', profileId: 'jorge', storageKey: STORAGE_KEYS.jorge, profileConfigRef: 'jorge' });
  expect(result.alexa).toMatchObject({ accountId: 'local-alexa', profileId: 'alexa', storageKey: STORAGE_KEYS.alexa, profileConfigRef: 'alexa' });
  expect(result.active.accountId).toBe('local-alexa');
  expect(result.writes).toEqual([]);
});

test('a synthetic third account uses persistence, backups, timers, active workouts, calendar state, and selection generically', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);

  const result = await page.evaluate(() => {
    const jorgeBefore = localStorage.getItem('big-gains-v2');
    const alexaBefore = localStorage.getItem('big-gains-alexa-v1');
    const third = {
      accountId: 'test-riley-account', profileId: 'riley', displayName: 'Riley',
      storageNamespace: 'riley-test', storageKey: 'big-gains-test-riley-v1', profileConfigRef: 'riley'
    };
    const registry = bigGainsAccounts.createRegistry([
      ...bigGainsAccounts.registry.accounts,
      third
    ], { defaultAccountId: 'local-jorge' });
    const account = registry.resolve('test-riley-account');
    const profile = {
      id: 'riley', name: 'Riley', goals: { primary: 'General fitness' },
      weekPlan: { 0: 'Rest', 1: 'Push' },
      capabilities: { allExercises: false, restFallbackWorkout: 'Push', wellnessPresentation: false }
    };
    const profiles = { ...PROFILE_CONFIG, riley: profile };
    let sequence = 0;
    const api = bigGainsStatePersistence.create({
      account, profile, profileConfig: profiles, validWorkoutTypes: ['Push'],
      createId: () => `synthetic-${++sequence}`, slug: value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    });
    const blank = api.load();
    const noWriteLoad = localStorage.getItem(third.storageKey) === null;
    blank.timerPreferences = { sound: false, vibration: true };
    blank.activeWorkout = { id: 'riley-active', type: 'Push', startedAt: '2026-08-06T12:00:00.000Z', exercises: [] };
    blank.customRoutines = { Push: ['test-movement'] };
    api.save(blank);
    const loaded = api.load();
    const exported = JSON.parse(api.prepareExport(loaded).json);
    const accepted = api.validateImport(exported);
    const rejected = api.validateImport({ ...blankStateForTest('jorge'), workouts: [], weights: [] });
    sessionStorage.setItem(registry.sessionKey(account, 'calendar-date'), '2026-08-06');
    registry.saveActive(account.accountId);
    return {
      accountId: api.accountId,
      profileId: api.profileId,
      storageKey: api.storageKey,
      noWriteLoad,
      loaded,
      exported,
      accepted: accepted.ok,
      rejected: { ok: rejected.ok, reason: rejected.reason },
      calendarKey: registry.sessionKey(account, 'calendar-date'),
      calendarValue: sessionStorage.getItem(registry.sessionKey(account, 'calendar-date')),
      selected: localStorage.getItem(bigGainsAccounts.activeSelectionKey)
      , jorgeUnchanged: localStorage.getItem('big-gains-v2') === jorgeBefore
      , alexaUnchanged: localStorage.getItem('big-gains-alexa-v1') === alexaBefore
    };

    function blankStateForTest(profileId) {
      return { version: 5, profileId, goals: {}, workouts: [], weights: [], prs: {}, activeWorkout: null, restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: true, vibration: true } };
    }
  });

  expect(result).toMatchObject({
    accountId: 'test-riley-account', profileId: 'riley', storageKey: 'big-gains-test-riley-v1', noWriteLoad: true,
    accepted: true, rejected: { ok: false, reason: 'profile-mismatch' },
    calendarKey: 'big-gains-calendar-date-riley-test', calendarValue: '2026-08-06', selected: 'riley',
    jorgeUnchanged: true, alexaUnchanged: true
  });
  expect(result.loaded).toMatchObject({
    version: 5, profileId: 'riley', timerPreferences: { sound: false, vibration: true },
    activeWorkout: { id: 'riley-active', type: 'Push' }, customRoutines: { Push: ['test-movement'] }
  });
  expect(result.exported).toEqual(result.loaded);
});

test('active account selection survives reload while preserving the compatibility value', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
  await Promise.all([page.waitForNavigation(), page.locator('#profileSelect').selectOption('alexa')]);
  await expect(page.locator('#profileSelect')).toHaveValue('alexa');
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.activeProfile)).toBe('alexa');
  await page.reload();
  await expect(page.locator('#profileSelect')).toHaveValue('alexa');
});
