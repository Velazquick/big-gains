# Browser and Node test readiness contracts

Browser specs are `*.spec.js`. Node contracts are `*.test.mjs` and run through
`npm run test:unit`, which propagates the real Node process exit status. The
`operator-db.test.mjs` contract requires disposable PostgreSQL and remains an
explicit protected workflow step. Browser discovery must never execute Node
tests incidentally. Keep this split when adding coverage.

| Observation | Required boundary |
|---|---|
| Static document structure | Direct navigation and the specific document assertion. This does not establish interactive startup. |
| Ordinary UI or application APIs | `openApp`, `reloadApp` or `waitForAppRuntime`: initialized composition, authorized boot and interactive runtime. Optionally require an exact profile ID. |
| Intentional blocked startup | Explicit `{ expected: 'recovery', reason: 'the-expected-reason' }`, followed by the test's error, namespace and retained-byte assertions. Unexpected recovery cannot satisfy a normal UI test. |
| Transient restoration progress | Hold only the synthetic record transport, observe the real restoring panel while boot is concealed and original bytes are intact, release in finally, then await interactive startup and assert exact stored records, identities, queues, marker and parity. |
| Profile navigation | `switchProfile`: perform the real select action and await the new interactive document with the expected profile identity. |
| Completed synchronous local save | Read and compare the actual owned storage key after the action returns; do not infer durability from a toast or hidden dialog. |
| Real service-worker control | `waitForControlledAppShell`: observe a real controller before disabling transport. Worker-update tests additionally observe their specific activated worker/release. Never send skipWaiting merely to make a natural-activation case pass. |
| Writer-lock ownership or release | Lock-aware integrity tests must observe the actual same-name acquisition/release and reassert denied-document state before reload. Closing a page alone is not a release acknowledgment. Main has no writer-lock API; do not manufacture one in the harness. |

Use `clickCentered` for a real click after an instant centered scroll, without
forced pointer dispatch. History opening also asserts the visible dialog's exact
workout ID. Exercise swapping with entered data asserts the actual `Sure?` and
`is-confirming` state before the second real click; it never retries a failed
click or opens a dialog through an application API. Existing durable facts,
provenance, stale-callback and confirmation assertions remain mandatory.

Keep fresh browser contexts and worker isolation. Seed storage once per synthetic
context, retain the seed marker across reloads, and combine dependent initialization
in one script. Playwright does not guarantee the ordering of multiple init scripts.
Do not clear storage in a recovery path to make validation pass. Canonical normal
fixtures include supported normalized fields; raw older or malformed fixtures
belong in explicit compatibility/refusal tests with exact retention assertions.

Route-held startup tests block service workers so their transport gate is actually
observed. Dedicated offline/PWA suites retain real service workers and real server
outages. These are different test boundaries, not interchangeable acceptance.

Route-mocked cloud contract contexts block workers explicitly. Managed recovery
uses a real loopback HTTP mock instead: worker-forwarded requests must still hit
the synthetic handler. Handler assertions fail fixture teardown, and teardown
closes owned sockets and awaits pending handlers. The progress observer always
releases its held responses, including when the expected GET is absent.

Offline tests keep real workers. Chromium retains driver-level offline coverage;
WebKit uses the existing real app-server outage fixture to exercise cached shell
fallback without its driver-level offline navigation error. Neither boundary is
physical-device acceptance. Do not add a reconciliation-idle gate to an
adversarial overlap test merely to hide a catalog/version race.

Reliability measurement uses bounded repetitions with `retries: 0`, matching
browser builds, worker counts, order and fixture inputs. A subsequent pass never
erases a failure. Preserve each outcome, exact source head and PR merge-tree SHA.
