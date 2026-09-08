import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const V64_METADATA_SHA256 = '2c2e2c5dc69b5ce9b6c298763caaa77041f3e91d04f3497054fd5b62b7bf34a3';

const V64_CANONICAL_IDS = [
  'seated-machine-chest-press',
  'seated-iso-lateral-bench-press',
  'incline-iso-machine-press',
  'smith-machine-incline-press',
  'flat-smith-machine-bench-press',
  'barbell-bench-press',
  'decline-barbell-bench-press',
  'dumbbell-bench-press',
  'incline-dumbbell-press',
  'decline-dumbbell-press',
  'cable-chest-fly',
  'incline-cable-fly',
  'seated-pec-deck',
  'push-up',
  'dips',
  'assisted-dip',
  'iso-machine-shoulder-press',
  'dumbbell-shoulder-press',
  'barbell-overhead-press',
  'machine-shoulder-press',
  'arnold-press',
  'landmine-press',
  'dumbbell-lateral-raise',
  'cable-lateral-raise',
  'reverse-pec-deck',
  'rear-delt-cable-fly',
  'face-pull',
  'overhead-triceps-extension',
  'triceps-pushdown',
  'rope-pushdown',
  'skull-crusher',
  'close-grip-bench-press',
  'single-arm-cable-extension',
  'cable-triceps-kickback',
  'dumbbell-triceps-kickback',
  'lat-pulldown',
  'wide-grip-lat-pulldown',
  'neutral-grip-lat-pulldown',
  'iso-lateral-pulldown-machine',
  'assisted-pull-up',
  'pull-up',
  'seated-cable-row',
  'close-grip-seated-cable-row',
  'one-arm-cable-row',
  'chest-supported-row',
  't-bar-row',
  'chest-supported-t-bar-row',
  'barbell-row',
  'meadows-row',
  'one-arm-dumbbell-row',
  'iso-lateral-row',
  'straight-arm-pulldown',
  'machine-pullover',
  'rack-pull',
  'dumbbell-shrug',
  'barbell-shrug',
  'dumbbell-curl',
  'hammer-curl',
  'rope-hammer-curl',
  'incline-dumbbell-curl',
  'preacher-curl',
  'machine-preacher-curl',
  'spider-curl',
  'concentration-curl',
  'reverse-curl',
  'cable-curl',
  'bayesian-cable-curl',
  'ez-bar-curl',
  'back-squat',
  'front-squat',
  'hack-squat',
  'belt-squat',
  'pendulum-squat',
  'v-squat-machine',
  'leg-press',
  'single-leg-press',
  'smith-machine-squat',
  'goblet-squat',
  'bulgarian-split-squat',
  'walking-lunge',
  'reverse-lunge',
  'step-up',
  'leg-extension',
  'romanian-deadlift',
  'dumbbell-romanian-deadlift',
  'seated-leg-curl',
  'lying-leg-curl',
  'nordic-hamstring-curl',
  '45-degree-back-extension',
  'hip-thrust',
  'glute-bridge',
  'cable-pull-through',
  'cable-glute-kickback',
  'standing-calf-raise',
  'seated-calf-raise',
  'calf-press-on-leg-press',
  'hip-abductor',
  'hip-adductor',
  'cable-crunch',
  'hanging-knee-raise',
  'hanging-leg-raise',
  'ab-wheel-rollout',
  'plank',
  'side-plank',
  'pallof-press',
  'machine-crunch',
  'russian-twist',
  'dead-bug',
  'treadmill-run',
  'outdoor-run',
  'incline-walk',
  'stair-climber',
  'stationary-bike',
  'elliptical',
  'rowing-machine',
  'deadlift',
  'trap-bar-deadlift',
  'farmer-carry',
  'kettlebell-swing'
];

const EKF3_CANONICAL_IDS = [
  'cable-chest-press', 'dumbbell-chest-fly', 'dumbbell-pullover', 'dumbbell-floor-press',
  'dip-machine', 'machine-biceps-curl', 'machine-triceps-extension', 'dumbbell-front-raise',
  'machine-lateral-raise', 'smith-machine-overhead-press', 'plate-loaded-high-row',
  'plate-loaded-low-row', 'single-arm-lat-pulldown', 'inverted-row', 'smith-machine-bent-over-row',
  'standing-leg-curl', 'single-leg-leg-extension', 'single-leg-seated-leg-curl', 'glute-ham-raise',
  'good-morning', 'sumo-deadlift', 'smith-machine-romanian-deadlift', 'smith-machine-split-squat',
  'smith-machine-hip-thrust', 'glute-drive-machine', 'machine-glute-kickback',
  'smith-machine-calf-raise', 'cable-wood-chop', 'rotary-torso-machine', 'sled-push',
  'backward-sled-drag', 'air-bike', 'ski-erg', 'battle-rope-waves', 'dumbbell-wrist-curl',
  'dumbbell-reverse-wrist-curl'
];

const ALL_CANONICAL_IDS = [...V64_CANONICAL_IDS, ...EKF3_CANONICAL_IDS];

const JORGE_PUSH_IDS = V64_CANONICAL_IDS.slice(0, 24).concat(V64_CANONICAL_IDS.slice(27, 35));

const SEARCH_RESULTS = {
  DB: [
    'dumbbell-bench-press', 'incline-dumbbell-press', 'decline-dumbbell-press',
    'dumbbell-shoulder-press', 'arnold-press', 'dumbbell-lateral-raise',
    'dumbbell-triceps-kickback', 'one-arm-dumbbell-row', 'dumbbell-shrug', 'dumbbell-curl',
    'hammer-curl', 'incline-dumbbell-curl', 'concentration-curl', 'goblet-squat',
    'bulgarian-split-squat', 'walking-lunge', 'reverse-lunge', 'step-up',
    'dumbbell-romanian-deadlift', 'farmer-carry'
  ],
  'lat raise': ['dumbbell-lateral-raise', 'cable-lateral-raise'],
  'pec fly': ['seated-pec-deck'],
  'pull ups': ['pull-up'],
  RDL: ['romanian-deadlift'],
  'calf raise': ['standing-calf-raise', 'seated-calf-raise', 'calf-press-on-leg-press'],
  'Iso-Lateral Chest Press': ['seated-iso-lateral-bench-press'],
  'db incline': ['incline-dumbbell-press'],
  'Trap Bar': ['trap-bar-deadlift']
};

const SZW_CLIENT_ID = 'independent-09034233fa064233b85018aec182764d';

async function installSzwRuntime(page) {
  const authUserId = '65000000-0000-0000-0000-000000000001';
  const cloudAccountId = '65a00000-0000-0000-0000-000000000001';
  const cloudProfileId = '65b00000-0000-0000-0000-000000000001';
  const storageKey = `big-gains-cloud-${cloudAccountId}-${cloudProfileId}-v1`;
  await page.addInitScript(({ authUserId, cloudAccountId, cloudProfileId, clientId, storageKey }) => {
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent', authUserId, cloudAccountId, cloudProfileId,
          clientId, displayName: 'szw',
          presentation: { petEnabled: false, accent: 'merlot', theme: 'slate-dark' }
        }
      }
    }));
    localStorage.setItem(storageKey, JSON.stringify({
      version: 5,
      profileId: clientId,
      goals: { primary: 'Strength and consistency' },
      workouts: [],
      weights: [],
      prs: {},
      activeWorkout: null,
      restTimerEndsAt: null,
      customRoutines: {},
      exercisePreferences: {},
      timerPreferences: { sound: true, vibration: true }
    }));
  }, { authUserId, cloudAccountId, cloudProfileId, clientId: SZW_CLIENT_ID, storageKey });
}

test('the complete v64 canonical identity and metadata snapshot remains exact within EKF-3', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const catalog = window.BigGainsExerciseCatalog;
    const snapshot = catalog.exercises.slice(0, 119).map(({ id, name, day, muscle, equipment, aliases, family }) => ({
      id, name, day, muscle, equipment, aliases: [...aliases], family
    }));
    return {
      snapshot,
      compatibilitySame: catalog === window.bigGainsExerciseCatalog,
      count: catalog.exercises.length,
      families: Object.fromEntries(catalog.exercises.slice(0, 119).filter(exercise => exercise.family).map(exercise => [exercise.id, exercise.family])),
      frozen: {
        api: Object.isFrozen(catalog),
        exercises: Object.isFrozen(catalog.exercises),
        definitions: catalog.exercises.every(exercise => Object.isFrozen(exercise) && Object.isFrozen(exercise.aliases))
      }
    };
  });

  expect(result.snapshot.map(exercise => exercise.id)).toEqual(V64_CANONICAL_IDS);
  expect(result.count).toBe(155);
  expect(createHash('sha256').update(JSON.stringify(result.snapshot)).digest('hex')).toBe(V64_METADATA_SHA256);
  expect(result.compatibilitySame).toBe(true);
  expect(result.families).toEqual({
    'lat-pulldown': 'lat-pulldown',
    'wide-grip-lat-pulldown': 'lat-pulldown',
    'neutral-grip-lat-pulldown': 'lat-pulldown',
    'iso-lateral-pulldown-machine': 'lat-pulldown',
    'standing-calf-raise': 'calf-raise',
    'seated-calf-raise': 'calf-raise',
    'calf-press-on-leg-press': 'calf-raise'
  });
  expect(result.frozen).toEqual({ api: true, exercises: true, definitions: true });
});

test('every canonical name and alias resolves and searches to its existing owner', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const catalog = window.BigGainsExerciseCatalog;
    const failures = [];
    for (const exercise of catalog.exercises) {
      for (const term of [exercise.name, ...exercise.aliases]) {
        if (catalog.resolve(term)?.id !== exercise.id) failures.push({ kind: 'resolve', id: exercise.id, term });
        if (!catalog.matchesSearch(exercise, term)) failures.push({ kind: 'search', id: exercise.id, term });
      }
    }
    return {
      failures,
      normalized: [
        catalog.normalizeTerm(' DB & Cable '),
        catalog.normalizeTerm('  Seated Iso-Lateral   Chest Press  '),
        catalog.normalizeTerm(null)
      ],
      generatedIds: [
        catalog.idForName('Seated Iso-Lateral Bench Press'),
        catalog.idForName('45-Degree Back Extension'),
        catalog.idForName('  EZ-Bar Curl  ')
      ]
    };
  });

  expect(result.failures).toEqual([]);
  expect(result.normalized).toEqual(['dumbbell and cable', 'seated iso lateral chest press', '']);
  expect(result.generatedIds).toEqual(['seated-iso-lateral-bench-press', '45-degree-back-extension', 'ez-bar-curl']);
});

test('EKF-3 common commercial-gym language resolves without brand-specific canonical identities', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  const result = await page.evaluate(() => Object.fromEntries([
    'hammer strength high row', 'hip thrust machine', 'assault bike', 'single arm cable pulldown', 'lateral raise machine'
  ].map(term => [term, BigGainsExerciseCatalog.resolve(term)?.id || null])));
  expect(result).toEqual({
    'hammer strength high row': 'plate-loaded-high-row',
    'hip thrust machine': 'glute-drive-machine',
    'assault bike': 'air-bike',
    'single arm cable pulldown': 'single-arm-lat-pulldown',
    'lateral raise machine': 'machine-lateral-raise'
  });
});

test('EKF-1 exposes stable opaque identity beneath the unchanged catalog API', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const catalog = window.BigGainsExerciseCatalog;
    const identity = window.BigGainsExerciseIdentity;
    const canonicalId = identity.canonicalIdFor('barbell-bench-press');
    const retrospective = { id: 'retrospective-instance', definitionId: 'barbell-bench-press' };
    return {
      identityKeys: Object.keys(identity),
      identityFrozen: Object.isFrozen(identity),
      canonicalId,
      canonicalIsOpaque: /^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(canonicalId),
      legacyRoundTrip: identity.compatibilityForCanonicalId(canonicalId)?.id,
      catalogCanonicalLookup: catalog.getById(canonicalId)?.id,
      retrospectiveCanonicalId: identity.canonicalIdFor(retrospective),
      aliasCanonicalId: identity.resolveCanonicalId('Bench'),
      unknown: identity.canonicalIdFor('not-a-real-exercise')
    };
  });

  expect(result).toEqual({
    identityKeys: ['canonicalIdFor', 'compatibilityForCanonicalId', 'resolveCanonicalId'],
    identityFrozen: true,
    canonicalId: result.canonicalId,
    canonicalIsOpaque: true,
    legacyRoundTrip: 'barbell-bench-press',
    catalogCanonicalLookup: 'barbell-bench-press',
    retrospectiveCanonicalId: result.canonicalId,
    aliasCanonicalId: result.canonicalId,
    unknown: null
  });
});

test('catalog search preserves v64 normalization, matching, and ordering', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const results = await page.evaluate(terms => {
    const catalog = window.BigGainsExerciseCatalog;
    return Object.fromEntries(['', ...terms].map(term => [
      term,
      catalog.exercises.filter(exercise => catalog.matchesSearch(exercise, term)).map(exercise => exercise.id)
    ]));
  }, Object.keys(SEARCH_RESULTS));

  expect(results['']).toEqual(ALL_CANONICAL_IDS);
  expect(Object.fromEntries(Object.keys(SEARCH_RESULTS).map(term => [term, results[term].filter(id => V64_CANONICAL_IDS.includes(id))]))).toEqual(SEARCH_RESULTS);
});

test('Jorge stays day-filtered while Alexa retains the full managed library', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-10T12:00:00.000Z'));
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();

  const jorgeRows = await page.locator('#exerciseLibrary .exercise-card').evaluateAll(cards => cards.map(card => ({ id: card.querySelector('[data-add]').dataset.add, name: card.querySelector('h3').textContent })));
  const jorgeIds = jorgeRows.map(row => row.id);
  expect(new Set(jorgeIds.filter(id => V64_CANONICAL_IDS.includes(id)))).toEqual(new Set(JORGE_PUSH_IDS));
  expect(jorgeRows.map(row => row.name)).toEqual(jorgeRows.map(row => row.name).sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })));
  expect(jorgeIds).toEqual(expect.arrayContaining(['cable-chest-press', 'dip-machine', 'machine-lateral-raise']));

  await Promise.all([page.waitForNavigation(), page.locator('#profileSelect').selectOption('alexa')]);
  await page.locator('.bottom-nav [data-view="library"]').click();
  const alexaRows = await page.locator('#exerciseLibrary .exercise-card').evaluateAll(cards => cards.map(card => ({ id: card.querySelector('[data-add]').dataset.add, name: card.querySelector('h3').textContent })));
  expect(new Set(alexaRows.map(row => row.id))).toEqual(new Set(ALL_CANONICAL_IDS));
  expect(alexaRows.map(row => row.name)).toEqual(alexaRows.map(row => row.name).sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })));
});

test('SZW retains the full library and every six-day routine entry resolves canonically', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-10T12:00:00.000Z'));
  await installSzwRuntime(page);
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();

  const result = await page.evaluate(() => {
    const catalog = window.BigGainsExerciseCatalog;
    return {
      ids: [...document.querySelectorAll('#exerciseLibrary [data-add]')].map(button => button.dataset.add),
      names: [...document.querySelectorAll('#exerciseLibrary h3')].map(heading => heading.textContent),
      routineIds: Object.fromEntries(PROFILE.libraryRoutineTypes.map(type => [type, routineFor(type)])),
      unresolved: PROFILE.libraryRoutineTypes.flatMap(type => routineFor(type)).filter(id => !catalog.getById(id))
    };
  });

  expect(new Set(result.ids)).toEqual(new Set(ALL_CANONICAL_IDS));
  expect(result.names).toEqual(result.names.slice().sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })));
  expect(Object.keys(result.routineIds)).toEqual(['SzwPush1', 'SzwPull1', 'SzwLegs1', 'SzwPush2', 'SzwPull2', 'SzwLegs2']);
  expect(result.unresolved).toEqual([]);
});

test('retrospective instance IDs remain distinct while definitionId resolves canonical identity', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const catalog = window.BigGainsExerciseCatalog;
    const definitionFor = exercise => catalog.getById(exercise.definitionId || exercise.id);
    return [
      definitionFor({ id: 'barbell-bench-press' })?.id || null,
      definitionFor({ id: 'retrospective-instance', definitionId: 'barbell-bench-press' })?.id || null,
      definitionFor({ id: 'retrospective-instance', name: 'Barbell Bench Press' })?.id || null
    ];
  });

  expect(result).toEqual(['barbell-bench-press', 'barbell-bench-press', null]);
});

test('canonical identity determines bodyweight versus external-load logging without changing catalog metadata', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const modes = await page.evaluate(() => {
    const catalog = window.BigGainsExerciseCatalog;
    return {
      pullUp: catalog.loadModeFor('pull-up'),
      retrospectivePullUp: catalog.loadModeFor({ id: 'retrospective-instance', definitionId: 'pull-up', equipment: 'Machine' }),
      weightedDefinitionWins: catalog.loadModeFor({ id: 'barbell-row', equipment: 'Bodyweight' }),
      legacyBodyweightFallback: catalog.loadModeFor({ id: 'unknown-old-entry', equipment: 'Bodyweight' })
    };
  });

  expect(modes).toEqual({
    pullUp: 'bodyweight',
    retrospectivePullUp: 'bodyweight',
    weightedDefinitionWins: 'external',
    legacyBodyweightFallback: 'bodyweight'
  });
});
