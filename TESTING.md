# Browser testing

The Playwright harness serves the static PWA from `index.html` without rewriting it, so production scripts execute in their declared order.

## Install

```sh
npm ci
npx playwright install chromium
```

On Linux CI hosts, install Chromium and its system dependencies with `npx playwright install --with-deps chromium`.

## Run

```sh
npm test
npx playwright test --workers=1
```

The expected baseline is green with 16 passing tests and two tests reported as expected failures.

## localStorage fixtures

Reusable fixtures live in `tests/fixtures/local-storage.js`:

1. Blank Jorge state
2. Blank Alexa state
3. Active workout with exercises
4. Active workout with zero exercises
5. Completed workouts
6. Malformed but parseable state
7. Legacy state

## Known expected failures

- Parseable but structurally invalid persisted state is not normalized. The test accepts only the exact known defect or fully normalized collections; partial or different failures remain unexpected.
- Legacy migration preserves weights but discards legacy workouts. The test accepts only the exact known defect or a migration that preserves both; other outcomes remain unexpected.

Both tests use Playwright's expected-failure annotation. If either defect is fixed as expected, its test becomes an unexpected pass so the annotation must be removed.

## Cross-profile import behavior

The suite characterizes the current behavior: importing an Alexa backup while Jorge is active writes the imported workouts and weights into Jorge's storage, stamps the result as Jorge, and leaves Alexa's storage unchanged.

## Not covered

The harness runs Chromium only. It does not validate native PWA install prompts, vibration, browser background-timer throttling, or the full real-time 2:30 rest-timer expiry. It does cover rest-timer activation and persistence, service-worker installation, and an offline reload.
