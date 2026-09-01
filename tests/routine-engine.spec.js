import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, completedWorkout, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const EXPECTED_SHARED = {
  Push: ['seated-machine-chest-press', 'incline-iso-machine-press', 'iso-machine-shoulder-press', 'seated-pec-deck', 'triceps-pushdown', 'overhead-triceps-extension'],
  Pull: ['lat-pulldown', 'seated-cable-row', 'chest-supported-row', 'reverse-pec-deck', 'dumbbell-curl', 'hammer-curl'],
  Legs: ['leg-press', 'leg-extension', 'seated-leg-curl', 'romanian-deadlift', 'standing-calf-raise', 'cable-crunch', 'hanging-knee-raise'],
  Core: ['cable-crunch', 'hanging-knee-raise', 'hanging-leg-raise', 'ab-wheel-rollout', 'plank', 'side-plank', 'pallof-press', 'machine-crunch', 'russian-twist', 'dead-bug'],
  Cardio: ['treadmill-run'],
  FullBody: ['seated-machine-chest-press', 'dumbbell-shoulder-press', 'lat-pulldown', 'triceps-pushdown', 'dumbbell-lateral-raise', 'hack-squat', 'leg-extension', 'standing-calf-raise'],
  Other: [],
  PilatesPull: ['lat-pulldown', 'seated-cable-row', 'chest-supported-row', 'face-pull', 'dumbbell-curl'],
  LegsLowImpact: ['hip-thrust', 'romanian-deadlift', 'bulgarian-split-squat', 'leg-press', 'seated-leg-curl', 'hip-abductor'],
  PilatesCardioAccessory: ['incline-walk', 'dumbbell-lateral-raise', 'face-pull', 'cable-pull-through', 'pallof-press'],
  Optional: ['incline-walk', 'glute-bridge', 'face-pull', 'dead-bug']
};

const SZW_ID = 'independent-09034233fa064233b85018aec182764d';
const SZW_STORAGE = 'big-gains-cloud-94a00000-0000-0000-0000-000000000001-94b00000-0000-0000-0000-000000000001-v1';

async function installSzw(page) {
  await page.addInitScript(({ profileId, storageKey }) => {
    const authUserId = '94000000-0000-0000-0000-000000000001';
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent', authUserId,
          cloudAccountId: '94a00000-0000-0000-0000-000000000001',
          cloudProfileId: '94b00000-0000-0000-0000-000000000001',
          clientId: profileId, profileConfigRef: profileId, displayName: 'szw',
          presentation: { petEnabled: false, accent: 'merlot', theme: 'slate-dark' }
        }
      }
    }));
    localStorage.setItem(storageKey, JSON.stringify({
      version: 5, profileId, goals: { primary: 'Strength and consistency' }, workouts: [], weights: [], prs: {},
      activeWorkout: null, restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: true, vibration: true }
    }));
  }, { profileId: SZW_ID, storageKey: SZW_STORAGE });
}

test('RoutineEngine exposes a frozen pure API and owns the shared profile defaults', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => ({
    factoryKeys: Object.keys(BigGainsRoutineEngine),
    engineKeys: Object.keys(workoutRoutineEngine),
    factoryFrozen: Object.isFrozen(BigGainsRoutineEngine),
    engineFrozen: Object.isFrozen(workoutRoutineEngine),
    compatibilitySame: BigGainsRoutineEngine === bigGainsRoutineEngine,
    defaultsFrozen: Object.isFrozen(workoutRoutineEngine.defaultRoutines),
    routines: Object.fromEntries(Object.keys(workoutRoutineEngine.defaultRoutines).map(type => [type, workoutRoutineEngine.getRoutine(type)]))
  }));

  expect(result).toEqual({
    factoryKeys: ['create'],
    engineKeys: ['defaultRoutines', 'libraryRoutineTypes', 'getDraft', 'getEntries', 'getLabel', 'getPrescription', 'getRoutine', 'getVariant', 'hasRoutine', 'resolveVariantSelection'],
    factoryFrozen: true,
    engineFrozen: true,
    compatibilitySame: true,
    defaultsFrozen: true,
    routines: EXPECTED_SHARED
  });

  const source = await (await request.get('/routine-engine.js')).text();
  const appSource = await (await request.get('/app.js')).text();
  expect(source).toContain("Object.defineProperty(scope, 'BigGainsRoutineEngine'");
  expect(source).not.toMatch(/\b(?:document|localStorage|sessionStorage|Supabase)\b/);
  expect(source).not.toContain('restTimerEndsAt');
  expect(appSource).not.toContain('SHARED_DEFAULT_ROUTINES');
});

test('Jorge and Alexa resolve the same frozen routine identities and ordering as before extraction', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);

  const result = await page.evaluate(() => {
    const create = profile => BigGainsRoutineEngine.create({
      profile,
      exerciseCatalog: BigGainsExerciseCatalog,
      getState: () => ({ customRoutines: {} })
    });
    const jorge = create(PROFILE_CONFIG.jorge);
    const alexa = create(PROFILE_CONFIG.alexa);
    const read = engine => Object.fromEntries(Object.keys(engine.defaultRoutines).map(type => [type, engine.getRoutine(type)]));
    return {
      jorge: read(jorge),
      alexa: read(alexa),
      jorgePushLabel: jorge.getLabel('Push'),
      alexaPlan: Object.fromEntries(Object.values(PROFILE_CONFIG.alexa.weekPlan).filter(type => type !== 'Rest').map(type => [type, alexa.getRoutine(type)]))
    };
  });

  expect(result.jorge).toEqual(EXPECTED_SHARED);
  expect(result.alexa).toEqual(EXPECTED_SHARED);
  expect(result.jorgePushLabel).toBe('Jorge Push');
  expect(result.alexaPlan).toEqual({
    PilatesPull: EXPECTED_SHARED.PilatesPull,
    LegsLowImpact: EXPECTED_SHARED.LegsLowImpact,
    PilatesCardioAccessory: EXPECTED_SHARED.PilatesCardioAccessory,
    Optional: EXPECTED_SHARED.Optional,
    FullBody: EXPECTED_SHARED.FullBody
  });
});

test('legacy and structured overrides share one read contract without read-time mutation', async ({ page }) => {
  const customRoutines = {
    Push: ['dumbbell-bench-press', 'seated-pec-deck'],
    Pull: [
      { exerciseId: 'lat-pulldown', workingSets: 5, targetReps: '6–8' },
      { exerciseId: 'seated-cable-row', workingSets: 4, targetReps: 'Failure' }
    ]
  };
  await installLocalStorageFixture(page, 'blankJorge');
  await page.addInitScript(({ key, custom }) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.customRoutines = custom;
    localStorage.setItem(key, JSON.stringify(saved));
  }, { key: STORAGE_KEYS.jorge, custom: customRoutines });
  await openApp(page);

  const beforeStorage = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.jorge);
  const result = await page.evaluate(() => {
    const before = JSON.stringify(state.customRoutines);
    const legacy = workoutRoutineEngine.getRoutine('Push');
    const legacyDraft = workoutRoutineEngine.getDraft('Push');
    const structured = workoutRoutineEngine.getRoutine('Pull');
    const prescription = workoutRoutineEngine.getPrescription('Pull', 'lat-pulldown');
    const structuredDraft = workoutRoutineEngine.getDraft('Pull');
    return { before, after: JSON.stringify(state.customRoutines), legacy, legacyDraft, structured, prescription, structuredDraft };
  });
  const afterStorage = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.jorge);

  expect(result).toEqual({
    before: JSON.stringify(customRoutines),
    after: JSON.stringify(customRoutines),
    legacy: ['dumbbell-bench-press', 'seated-pec-deck'],
    legacyDraft: [
      { exerciseId: 'dumbbell-bench-press', workingSets: 3, targetReps: '' },
      { exerciseId: 'seated-pec-deck', workingSets: 3, targetReps: '' }
    ],
    structured: ['lat-pulldown', 'seated-cable-row'],
    prescription: { workingSets: 5, targetReps: '6–8' },
    structuredDraft: customRoutines.Pull
  });
  expect(afterStorage).toBe(beforeStorage);
});

test('the live state port observes same-profile replacement and keeps prior state untouched', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const original = state;
    const originalSnapshot = JSON.stringify(original);
    state = {
      ...state,
      customRoutines: { Push: [{ exerciseId: 'barbell-bench-press', workingSets: 4, targetReps: '5' }] }
    };
    const replacementRead = {
      routine: workoutRoutineEngine.getRoutine('Push'),
      prescription: workoutRoutineEngine.getPrescription('Push', 'barbell-bench-press'),
      draft: workoutRoutineEngine.getDraft('Push')
    };
    return { replacementRead, originalUnchanged: JSON.stringify(original) === originalSnapshot };
  });

  expect(result).toEqual({
    replacementRead: {
      routine: ['barbell-bench-press'],
      prescription: { workingSets: 4, targetReps: '5' },
      draft: [{ exerciseId: 'barbell-bench-press', workingSets: 4, targetReps: '5' }]
    },
    originalUnchanged: true
  });
});

test('reset returns to the profile default without touching active or completed workouts', async ({ page }) => {
  const active = activeWorkout();
  const completed = completedWorkout();
  await installLocalStorageFixture(page, 'blankJorge');
  await page.addInitScript(({ key, activeSession, history }) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.activeWorkout = activeSession;
    saved.workouts = [history];
    saved.customRoutines = { Push: ['barbell-bench-press'] };
    localStorage.setItem(key, JSON.stringify(saved));
  }, { key: STORAGE_KEYS.jorge, activeSession: active, history: completed });
  await openApp(page);
  const before = await page.evaluate(() => ({
    activeWorkout: JSON.parse(JSON.stringify(state.activeWorkout)),
    workouts: JSON.parse(JSON.stringify(state.workouts))
  }));
  await page.evaluate(() => {
    selectedDay = 'Push';
    openRoutineEditor();
  });
  const reset = page.locator('#resetRoutine');
  await reset.click();
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.customRoutines.Push).toEqual(['barbell-bench-press']);
  await expect(reset).toHaveAccessibleName('Confirm: Restore the original Jorge Push routine?');
  await reset.click();

  stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.customRoutines.Push).toBeUndefined();
  expect(stored.activeWorkout).toEqual(before.activeWorkout);
  expect(stored.workouts).toEqual(before.workouts);
  expect(await page.evaluate(() => workoutRoutineEngine.getRoutine('Push'))).toEqual(EXPECTED_SHARED.Push);
});

test('SZW variant selection changes only the interpreted Legs 2 entry and preserves prescriptions', async ({ page }) => {
  await installSzw(page);
  await openApp(page);

  const before = await page.evaluate(() => JSON.stringify(state.customRoutines));
  const result = await page.evaluate(() => {
    const defaultRoutine = workoutRoutineEngine.getRoutine('SzwLegs2');
    const variant = workoutRoutineEngine.getVariant('SzwLegs2');
    selectRoutineVariant('SzwLegs2', 'single-leg-press');
    return {
      defaultRoutine,
      variant,
      selectedRoutine: workoutRoutineEngine.getRoutine('SzwLegs2'),
      selectedPrescription: workoutRoutineEngine.getPrescription('SzwLegs2', 'single-leg-press'),
      customRoutines: JSON.stringify(state.customRoutines)
    };
  });

  expect(result.defaultRoutine).toEqual(['front-squat', 'hack-squat', 'leg-extension', 'standing-calf-raise']);
  expect(result.variant).toEqual({
    choices: [
      { id: 'hack-squat', name: 'Hack Squat' },
      { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat' },
      { id: 'single-leg-press', name: 'Single-Leg Press' }
    ],
    selectedId: 'hack-squat'
  });
  expect(result.selectedRoutine).toEqual(['front-squat', 'single-leg-press', 'leg-extension', 'standing-calf-raise']);
  expect(result.selectedPrescription).toEqual({ workingSets: 3, targetReps: '10–12' });
  expect(result.customRoutines).toBe(before);
});
