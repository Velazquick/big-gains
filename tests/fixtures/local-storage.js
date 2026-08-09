export const STORAGE_KEYS = Object.freeze({
  activeProfile: 'big-gains-active-profile',
  alexa: 'big-gains-alexa-v1',
  jorge: 'big-gains-v2',
  legacy: 'big-gains-v1'
});

const FIXED_NOW = '2026-08-05T12:00:00.000Z';
const FIXED_COMPLETED = '2026-08-04T18:30:00.000Z';

export function blankState(profileId) {
  return {
    version: 5,
    profileId,
    goals: profileId === 'alexa'
      ? {
          primary: 'Weight loss',
          secondary: ['Glute and leg growth', 'Back growth'],
          startingWeight: 225,
          targetDate: '2026-12-20'
        }
      : { primary: 'Strength and performance' },
    workouts: [],
    weights: [],
    prs: {},
    activeWorkout: null,
    restTimerEndsAt: null,
    customRoutines: {},
    timerPreferences: { sound: true, vibration: true }
  };
}

export function completedWorkout(overrides = {}) {
  return {
    id: 'completed-push-1',
    type: 'Push',
    startedAt: '2026-08-04T17:45:00.000Z',
    completedAt: FIXED_COMPLETED,
    durationSeconds: 2700,
    prs: 1,
    exercises: [
      {
        id: 'seated-machine-chest-press',
        name: 'Seated Machine Chest Press',
        muscle: 'Chest',
        equipment: 'Machine',
        note: 'Strong setup and smooth reps.',
        sets: [
          { id: 'completed-set-1', weight: 100, reps: 10, warmup: false, completed: true }
        ]
      }
    ],
    ...overrides
  };
}

export function activeWorkout(overrides = {}) {
  return {
    id: 'active-push-1',
    type: 'Push',
    startedAt: FIXED_NOW,
    exercises: [
      {
        id: 'seated-machine-chest-press',
        name: 'Seated Machine Chest Press',
        muscle: 'Chest',
        equipment: 'Machine',
        collapsed: true,
        sets: [
          { id: 'active-warmup-1', weight: 45, reps: 10, warmup: true, completed: false },
          { id: 'active-working-1', weight: 100, reps: 8, warmup: false, completed: false },
          { id: 'active-working-2', weight: 100, reps: 8, warmup: false, completed: false },
          { id: 'active-working-3', weight: 100, reps: 8, warmup: false, completed: false }
        ]
      }
    ],
    ...overrides
  };
}

const blankJorge = blankState('jorge');
const blankAlexa = blankState('alexa');
const activeWithExercises = activeWorkout();
const activeWithTwoExercises = activeWorkout({
  exercises: [
    ...activeWithExercises.exercises,
    {
      id: 'lat-pulldown',
      name: 'Lat Pulldown',
      muscle: 'Back',
      equipment: 'Cable',
      collapsed: true,
      sets: [
        { id: 'lat-warmup-1', weight: 50, reps: 10, warmup: true, completed: false },
        { id: 'lat-working-1', weight: 90, reps: 10, warmup: false, completed: false },
        { id: 'lat-working-2', weight: 90, reps: 10, warmup: false, completed: false },
        { id: 'lat-working-3', weight: 90, reps: 10, warmup: false, completed: false }
      ]
    }
  ]
});
const activeWithZeroExercises = activeWorkout({
  id: 'active-empty-pull-1',
  type: 'Pull',
  exercises: []
});
const completedJorge = {
  ...blankState('jorge'),
  workouts: [completedWorkout()],
  weights: [{ weight: 218.4, date: FIXED_COMPLETED }],
  prs: {
    'seated-machine-chest-press': {
      exercise: 'Seated Machine Chest Press',
      estimated1RM: 133,
      weight: 100,
      reps: 10,
      date: FIXED_COMPLETED
    }
  }
};

export const localStorageFixtures = Object.freeze({
  blankJorge: {
    activeProfile: 'jorge',
    values: { [STORAGE_KEYS.jorge]: blankJorge }
  },
  blankAlexa: {
    activeProfile: 'alexa',
    values: { [STORAGE_KEYS.alexa]: blankAlexa }
  },
  activeWorkoutWithExercises: {
    activeProfile: 'jorge',
    values: {
      [STORAGE_KEYS.jorge]: {
        ...blankState('jorge'),
        activeWorkout: activeWithExercises
      }
    }
  },
  activeWorkoutWithTwoExercises: {
    activeProfile: 'jorge',
    values: {
      [STORAGE_KEYS.jorge]: {
        ...blankState('jorge'),
        activeWorkout: activeWithTwoExercises
      }
    }
  },
  activeWorkoutWithZeroExercises: {
    activeProfile: 'jorge',
    values: {
      [STORAGE_KEYS.jorge]: {
        ...blankState('jorge'),
        activeWorkout: activeWithZeroExercises
      }
    }
  },
  completedWorkouts: {
    activeProfile: 'jorge',
    values: { [STORAGE_KEYS.jorge]: completedJorge }
  },
  completedAndActiveWorkouts: {
    activeProfile: 'jorge',
    values: {
      [STORAGE_KEYS.jorge]: {
        ...completedJorge,
        activeWorkout: activeWithExercises
      }
    }
  },
  malformedButParseableState: {
    activeProfile: 'jorge',
    values: {
      [STORAGE_KEYS.jorge]: {
        version: 5,
        profileId: 'jorge',
        workouts: { unexpected: 'object instead of an array' },
        weights: 'not-an-array',
        prs: { broken: null },
        activeWorkout: {
          id: 'invalid-active-workout',
          type: 'Unknown',
          startedAt: 'not-a-date',
          exercises: 'not-an-array'
        },
        customRoutines: {
          Push: 'not-an-array',
          Pull: ['lat-pulldown', null, 42, 'lat-pulldown']
        },
        goals: {
          primary: 42,
          secondary: 'not-an-array'
        },
        restTimerEndsAt: 'tomorrow'
      }
    }
  },
  legacyState: {
    activeProfile: 'jorge',
    values: {
      [STORAGE_KEYS.legacy]: {
        workouts: [
          {
            id: 'legacy-push-1',
            type: 'Push',
            completedAt: '2026-07-28T18:30:00.000Z',
            sets: [
              { exercise: 'Seated Machine Chest Press', weight: 90, reps: 10 }
            ]
          }
        ],
        weights: [
          { weight: 220, date: '2026-07-28T12:00:00.000Z' },
          { weight: -1, date: '2026-07-29T12:00:00.000Z' },
          { weight: 219, date: 'not-a-date' },
          { weight: 'unknown', date: '2026-07-30T12:00:00.000Z' }
        ]
      }
    }
  }
});

function fixtureNames(names) {
  return Array.isArray(names) ? names : [names];
}

export async function installLocalStorageFixture(page, names, options = {}) {
  const fixtures = fixtureNames(names).map(name => {
    const fixture = localStorageFixtures[name];
    if (!fixture) throw new Error(`Unknown localStorage fixture: ${name}`);
    return fixture;
  });

  const values = Object.assign({}, ...fixtures.map(fixture => fixture.values));
  const activeProfile = options.activeProfile
    || fixtures.at(-1)?.activeProfile
    || 'jorge';

  if (options.now) {
    await page.addInitScript(fixedNow => {
      const NativeDate = Date;
      const nativeStartedAt = NativeDate.now();
      const fixedStartedAt = NativeDate.parse(fixedNow);
      const currentTime = () => fixedStartedAt + (NativeDate.now() - nativeStartedAt);

      class TestDate extends NativeDate {
        constructor(...args) {
          super(...(args.length ? args : [currentTime()]));
        }

        static now() {
          return currentTime();
        }
      }

      globalThis.Date = TestDate;
    }, options.now);
  }

  await page.addInitScript(({ activeProfileKey, activeProfileId, seedKey, serializedValues }) => {
    if (localStorage.getItem(seedKey)) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(activeProfileKey, activeProfileId);
    for (const [key, value] of Object.entries(serializedValues)) {
      localStorage.setItem(key, value);
    }
    localStorage.setItem(seedKey, 'seeded');
  }, {
    activeProfileKey: STORAGE_KEYS.activeProfile,
    activeProfileId: activeProfile,
    seedKey: '__big_gains_playwright_fixture__',
    serializedValues: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)])
    )
  });
}

export async function readStoredJson(page, key) {
  return page.evaluate(storageKey => {
    const value = localStorage.getItem(storageKey);
    return value === null ? null : JSON.parse(value);
  }, key);
}
