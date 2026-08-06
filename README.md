# big-gains

Big Gains is a static, local-first strength-training PWA with isolated Jorge and Alexa profiles, JSON backup and restore, optional outbound workout snapshots, and a tested offline app shell.

Timer completion always uses the visual and accessible READY cue as its primary feedback. A short repository-owned chime is a best-effort enhancement after the persistent audio element is armed by a trusted workout interaction; installed iOS PWAs may still suppress audio because of device or WebKit policy.

Finishing a workout saves it first, clears the live session once, and then shows a focused, session-only completion summary with duration, completed exercises and working sets, working-set volume, and PR count. Done returns to Today; Review workout reuses the existing history detail.

Expanded exercise cards use an accessible chevron that can keep even the focused exercise manually collapsed until the user reopens it or automatic completion advances focus. “+ Add set” appends one working set seeded from the latest valid working-set values. The Calendar groups completed history by the browser's local calendar date and opens the same workout detail used by Progress; its month and date selection are session-only.

Past and current Calendar dates can also open a focused retrospective editor. It preloads the selected profile's planned weekday routine (or a blank workout on rest days), remains independent from any live workout, and saves an ordinary completed workout with the optional `entryMethod: "retrospective"` marker. Completed working sets flow through Calendar, History, Progress, volume, workout counts, backups, and optional PR evaluation without a second database or history path.

## Project documentation

- [Architecture](ARCHITECTURE.md) — production load order, module boundaries, state and workout lifecycles, profile isolation, backup and sync behavior, offline assets, and CI
- [Release checklist](RELEASE_CHECKLIST.md) — the required checks for production, storage, backup, and service-worker changes
- [Browser testing](TESTING.md) — local commands, fixtures, coverage, and known limits

The stabilized browser-test baseline is 91 passing tests in Chromium with no expected failures.

## Storage compatibility

Current profile state and backups use schema version 5. When Jorge has no current state, valid weight entries from an existing undocumented `big-gains-v1` payload are normalized into the current Jorge profile. The original legacy key/value is left untouched.

Legacy workout records are not imported into schema version 5 because their historical shape was never defined as a supported schema. Those records are retained only inside the untouched `big-gains-v1` payload.
# Phase 4A: account-ready, still local-first

Big Gains now separates local account identity/data ownership from training-profile presentation. Jorge and Alexa look and behave exactly as before and keep their original on-device data keys. There is no login, backend, cloud database, account creation, or friend-facing account in this phase.

See `PHASE4_ACCOUNT_ROADMAP.md` for the decisions and sequence after this foundation.
