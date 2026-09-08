import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const authUserId = '85000000-0000-0000-0000-000000000001';
const cloudAccountId = '85a00000-0000-0000-0000-000000000001';
const cloudProfileId = '85b00000-0000-0000-0000-000000000001';
const clientId = 'independent-szw';
const namespace = `cloud-${cloudAccountId}-${cloudProfileId}`;
const storageKey = `big-gains-${namespace}-v1`;

const expectedMappings = {
  Bench: 'Barbell Bench Press',
  'DB Shoulder Press': 'Dumbbell Shoulder Press',
  'DB Incline Press': 'Incline Dumbbell Press',
  'DB Lat Raise': 'Dumbbell Lateral Raise',
  'Cable Tricep Kickback': 'Cable Triceps Kickback',
  'Iso Shoulder Press': 'Iso Machine Shoulder Press',
  'DB Bench': 'Dumbbell Bench Press',
  Dips: 'Dips',
  'Cable Lat Raise': 'Cable Lateral Raise',
  'Pec Fly Machine': 'Seated Pec Deck',
  'Overhead Tricep Extension': 'Overhead Triceps Extension',
  Deadlift: 'Deadlift',
  'Iso Lat Pull Machine': 'Iso-Lateral Pulldown Machine',
  'Cable Row': 'Seated Cable Row',
  'Face Pulls': 'Face Pull',
  'Hammer Curls': 'Hammer Curl',
  'DB Shrugs': 'Dumbbell Shrug',
  'EZ Bar Curl': 'EZ-Bar Curl',
  'Barbell Row': 'Barbell Row',
  'Pull ups': 'Pull-Up',
  'One Arm Row Machine': 'Iso-Lateral Row',
  'Cable Curl': 'Cable Curl',
  'Barbell Shrug': 'Barbell Shrug',
  'DB Curl': 'Dumbbell Curl',
  Squat: 'Back Squat',
  RDL: 'Romanian Deadlift',
  'Leg Press': 'Leg Press',
  'Calf Raise on Leg Press Machine': 'Calf Press on Leg Press',
  'Leg Curl': 'Seated Leg Curl',
  'Front Barbell Squat': 'Front Squat',
  'Hack Squat': 'Hack Squat',
  'Bulgarian Split Squat': 'Bulgarian Split Squat',
  'Single Leg Press': 'Single-Leg Press',
  'Leg Extension': 'Leg Extension',
  'Standing Calf Raise': 'Standing Calf Raise'
};

const newExercises = [
  'Cable Triceps Kickback',
  'Iso-Lateral Pulldown Machine',
  'Dumbbell Shrug',
  'Barbell Shrug',
  'Calf Press on Leg Press',
  'Single-Leg Press'
];

const stableExistingIds = {
  'Barbell Bench Press': 'barbell-bench-press',
  'Dumbbell Shoulder Press': 'dumbbell-shoulder-press',
  'Incline Dumbbell Press': 'incline-dumbbell-press',
  'Dumbbell Lateral Raise': 'dumbbell-lateral-raise',
  'Iso Machine Shoulder Press': 'iso-machine-shoulder-press',
  'Dumbbell Bench Press': 'dumbbell-bench-press',
  Dips: 'dips',
  'Cable Lateral Raise': 'cable-lateral-raise',
  'Seated Pec Deck': 'seated-pec-deck',
  'Overhead Triceps Extension': 'overhead-triceps-extension',
  Deadlift: 'deadlift',
  'Seated Cable Row': 'seated-cable-row',
  'Face Pull': 'face-pull',
  'Hammer Curl': 'hammer-curl',
  'EZ-Bar Curl': 'ez-bar-curl',
  'Barbell Row': 'barbell-row',
  'Pull-Up': 'pull-up',
  'Iso-Lateral Row': 'iso-lateral-row',
  'Cable Curl': 'cable-curl',
  'Dumbbell Curl': 'dumbbell-curl',
  'Back Squat': 'back-squat',
  'Romanian Deadlift': 'romanian-deadlift',
  'Leg Press': 'leg-press',
  'Seated Leg Curl': 'seated-leg-curl',
  'Front Squat': 'front-squat',
  'Hack Squat': 'hack-squat',
  'Bulgarian Split Squat': 'bulgarian-split-squat',
  'Leg Extension': 'leg-extension',
  'Standing Calf Raise': 'standing-calf-raise'
};

function blankSzwState() {
  return {
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
  };
}

async function installSzwRuntime(page) {
  await page.addInitScript(({ authUserId, cloudAccountId, cloudProfileId, clientId, storageKey, state }) => {
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent', authUserId, cloudAccountId, cloudProfileId, clientId,
          displayName: 'szw',
          presentation: { petEnabled: false, accent: 'merlot', theme: 'slate-dark' }
        }
      }
    }));
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, { authUserId, cloudAccountId, cloudProfileId, clientId, storageKey, state: blankSzwState() });
}

test('every SZW term resolves and searches to one intended canonical movement', async ({ page }) => {
  await installSzwRuntime(page);
  await openApp(page);

  const result = await page.evaluate(terms => {
    const resolved = {};
    const searches = {};
    const input = document.getElementById('exerciseSearch');
    for (const term of terms) {
      resolved[term] = window.bigGainsExerciseCatalog.resolve(term)?.name || null;
      input.value = term;
      renderLibrary();
      searches[term] = [...document.querySelectorAll('#exerciseLibrary .exercise-card h3')].map(element => element.textContent);
    }
    const shorthandSearches = {};
    for (const term of ['DB', 'lat raise', 'pec fly']) {
      input.value = term;
      renderLibrary();
      shorthandSearches[term] = [...document.querySelectorAll('#exerciseLibrary .exercise-card h3')].map(element => element.textContent);
    }
    return { resolved, searches, shorthandSearches };
  }, Object.keys(expectedMappings));

  expect(result.resolved).toEqual(expectedMappings);
  for (const [term, canonical] of Object.entries(expectedMappings)) {
    expect(result.searches[term], `${term} should find ${canonical}`).toContain(canonical);
  }
  expect(result.shorthandSearches.DB).toEqual(expect.arrayContaining([
    'Dumbbell Bench Press', 'One-Arm Dumbbell Row', 'Dumbbell Romanian Deadlift'
  ]));
  expect(result.shorthandSearches['lat raise']).toEqual(expect.arrayContaining([
    'Dumbbell Lateral Raise', 'Cable Lateral Raise'
  ]));
  expect(result.shorthandSearches['pec fly']).toContain('Seated Pec Deck');
});

test('catalog additions are genuinely new, canonical identities remain unique, and existing IDs stay stable', async ({ page }) => {
  await installSzwRuntime(page);
  await openApp(page);

  const catalog = await page.evaluate(() => {
    const exercises = window.bigGainsExerciseCatalog.exercises;
    const termOwners = new Map();
    for (const exercise of exercises) {
      for (const term of [exercise.name, ...exercise.aliases]) {
        const normalized = window.bigGainsExerciseCatalog.normalizeTerm(term);
        if (!termOwners.has(normalized)) termOwners.set(normalized, new Set());
        termOwners.get(normalized).add(exercise.id);
      }
    }
    return {
      ids: exercises.map(exercise => exercise.id),
      names: exercises.map(exercise => exercise.name),
      byName: Object.fromEntries(exercises.map(exercise => [exercise.name, exercise.id])),
      additions: exercises.filter(exercise => [
        'cable-triceps-kickback', 'iso-lateral-pulldown-machine', 'dumbbell-shrug',
        'barbell-shrug', 'calf-press-on-leg-press', 'single-leg-press'
      ].includes(exercise.id)).map(exercise => exercise.name).sort(),
      collisions: [...termOwners.entries()].filter(([, owners]) => owners.size > 1).map(([term, owners]) => [term, [...owners]])
    };
  });

  expect(new Set(catalog.ids).size).toBe(catalog.ids.length);
  expect(new Set(catalog.names.map(name => name.toLowerCase())).size).toBe(catalog.names.length);
  expect(catalog.collisions).toEqual([]);
  expect(catalog.additions).toEqual([...newExercises].sort());
  expect(Object.fromEntries(Object.keys(stableExistingIds).map(name => [name, catalog.byName[name]]))).toEqual(stableExistingIds);
});

test('SZW renders merlot on slate with the pet off and no routine or schema-v5 mutation', async ({ page }) => {
  await installSzwRuntime(page);
  await openApp(page);

  await expect(page.locator('html')).toHaveAttribute('data-account-mode', 'independent');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'merlot');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate-dark');
  await expect(page.locator('html')).toHaveAttribute('data-pet-enabled', 'false');
  await expect(page.locator('#greeting')).toContainText('szw');
  await expect(page.locator('#trainingPetCard')).toBeHidden();

  const result = await page.evaluate(({ storageKey, newExercises, authUserId, cloudAccountId, cloudProfileId, clientId }) => {
    const styles = getComputedStyle(document.documentElement);
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return {
      tokens: {
        accent: styles.getPropertyValue('--accent').trim(),
        accentStrong: styles.getPropertyValue('--accent2').trim(),
        background: styles.getPropertyValue('--bg').trim(),
        panel: styles.getPropertyValue('--panel').trim(),
        muted: styles.getPropertyValue('--muted').trim(),
        line: styles.getPropertyValue('--line').trim()
      },
      allowlist: bigGainsAccounts.presentationAllowlist,
      fallbacks: bigGainsAccounts.presentationFor({ petEnabled: false, accent: 'unknown', theme: 'unknown' }),
      runtimeMatching: (() => {
        const owner = presentation => ({
          account: { id: cloudAccountId, owner_user_id: authUserId },
          profiles: { [clientId]: {
            id: cloudProfileId, client_id: clientId, display_name: 'szw',
            pet_enabled: presentation.petEnabled, accent: presentation.accent, theme: presentation.theme
          } }
        });
        const currentOwner = owner({ petEnabled: false, accent: 'merlot', theme: 'slate-dark' });
        const staleOwner = owner({ petEnabled: false, accent: 'cobalt', theme: 'performance-dark' });
        return {
          currentOwnerMatches: bigGainsAccounts.matchesCloudOwner(currentOwner, authUserId),
          staleOwnerMatches: bigGainsAccounts.matchesCloudOwner(staleOwner, authUserId),
          currentPresentationMatches: bigGainsAccounts.matchesCloudPresentation(currentOwner),
          stalePresentationMatches: bigGainsAccounts.matchesCloudPresentation(staleOwner)
        };
      })(),
      stored,
      seededNewExercises: Object.values(DEFAULT_ROUTINES).flatMap(routine => routine.exercises).filter(name => newExercises.includes(name))
    };
  }, { storageKey, newExercises, authUserId, cloudAccountId, cloudProfileId, clientId });

  expect(result.tokens).toEqual({
    accent: '#bf607b', accentStrong: '#923149', background: '#080a0d',
    panel: '#11151a', muted: '#929ba8', line: '#2a313b'
  });
  expect(result.allowlist).toEqual({
    accents: ['volt', 'cobalt', 'merlot', 'rose', 'violet', 'ember'],
    themes: ['performance-dark', 'wellness-light', 'slate-dark']
  });
  expect(result.fallbacks).toEqual({ petEnabled: false, accent: 'cobalt', theme: 'performance-dark' });
  expect(result.runtimeMatching).toEqual({
    currentOwnerMatches: true,
    staleOwnerMatches: true,
    currentPresentationMatches: true,
    stalePresentationMatches: false
  });
  expect(result.stored).toEqual(blankSzwState());
  expect(result.seededNewExercises).toEqual([]);
});

test('Jorge keeps his deployed presentation and day-filtered library behavior', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  await expect(page.locator('html')).toHaveAttribute('data-accent', 'ember');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'performance-dark');
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="Push"]').click();
  await page.locator('#viewLibrary details summary').click();
  await page.locator('#exerciseSearch').fill('Single Leg Press');
  await expect(page.locator('#exerciseLibrary')).toContainText('No matching exercises');
  await page.locator('#dayTabs [data-day="Legs"]').click();
  await page.locator('#exerciseSearch').fill('Single Leg Press');
  await expect(page.locator('#exerciseLibrary h3')).toHaveText('Single-Leg Press');
});

test('Alexa keeps her deployed presentation and all-exercise library behavior', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankAlexa');
  await openApp(page);

  await expect(page.locator('html')).toHaveAttribute('data-accent', 'rose');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'wellness-light');
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#viewLibrary details summary').click();
  await page.locator('#exerciseSearch').fill('Single Leg Press');
  await expect(page.locator('#exerciseLibrary h3')).toHaveText('Single-Leg Press');
});

test('presentation migration extends only render-token constraints and RLS tests reject presentation authorization', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260808114122_szw_presentation_tokens.sql', import.meta.url), 'utf8');
  const rlsTest = await readFile(new URL('../supabase/tests/database/phase4g_independent_account_rls.test.sql', import.meta.url), 'utf8');

  expect(migration).toContain("accent in ('ember', 'rose', 'cobalt', 'merlot')");
  expect(migration).toContain("theme in ('performance-dark', 'wellness-light', 'slate-dark')");
  expect(migration).not.toMatch(/\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\./i);
  expect(migration).not.toMatch(/\b(?:create|alter|drop)\s+policy\b/i);
  expect(migration).not.toMatch(/auth\.uid|owner_user_id|account_id/i);
  expect(rlsTest).toContain('presentation columns are absent from every public RLS policy');
  expect(rlsTest).toContain("accent = 'merlot', theme = 'slate-dark'");
});
