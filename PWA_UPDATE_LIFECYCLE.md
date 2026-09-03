# Safe installed-app updates — v106

Baseline: `63da05c8477054f91ee49b79fe74e66860966a9a` (Appearance v1).
Release: `v106-safe-pwa-updates`. Local schema stays v5.

## Diagnosis and evidence boundary

v103 (`e728f76`) and the Appearance baseline register the worker on `window.load`
only, with `updateViaCache: none`. They have no explicit `registration.update()`,
resume/focus/pageshow update path, waiting-worker listener, version handshake,
approval message, or restart UI. The worker precaches at install, waits normally,
then claims clients and removes previous owned caches on activation. Neither
version calls `skipWaiting()`.

The v103 core uses **network-first navigation with no-store**, falling back to
cached index.html if network navigation fails. It is not a cache-first HTML bug.
An already running/suspended client can stay on its old JavaScript while a newer
worker waits. A real same-origin online navigation can load the new shell; a
worker can activate naturally once its old clients are all gone.

There is a separate, reproducible origin-migration failure. On 2026-09-03 the
legacy worker URL `https://velazquick.github.io/big-gains/service-worker.js`
returned HTTP 301 to `https://app.getbiggains.com/service-worker.js`.
Worker-script updates reject redirects; new-origin code cannot patch an
old-origin installed worker. The two-origin fixture reproduces rejected updates,
old shell fallback, and retained local data. The user's exact installed origin
has NOT been observed, so this is a likely explanation, not claimed physical proof.
The canonical worker returns HTTP 200 with Pages `Cache-Control: max-age=600`;
registration bypasses the HTTP cache using `updateViaCache: none`.

## Lifecycle

- Register immediately when the module executes, including if load already fired.
- Explicitly check at startup, focus, pageshow, visible resume, and online.
  Concurrent checks coalesce; return-event bursts have a 15-second throttle.
  Advanced diagnostics offers an unthrottled **Check for app update**.
- Observe both existing waiting workers and installing-worker state changes.
- Offer **Update available / Restart Big Gains to use the latest version. /
  Update now / Later**. Never silently restart. Later suppresses repeats for that
  waiting worker until an explicit check or a fresh page lifetime.
- Update now rechecks safety, requests `SKIP_WAITING`, and authorizes only that
  worker's controllerchange. Recheck safety at the restart boundary and reload
  at most once. No approval survives a page reload or unsafe race.
- Without a waiting worker, offer restart only after an observed controller
  replacement, comparing deployment identity (including config-only changes).
  A new page with an older worker after failed installation is not a restart offer.
- The worker rejects forced activation when any other same-scope window exists,
  including a legacy or password-setup window. Close those windows and retry.
- Freeze new user interactions during the short approved restart, with bounded
  timeout recovery. Network/check/activation failure does not clear any data.

## Fail-closed safety

The restart guard reads existing runtime/persistence ports and never saves data.
It blocks for:

- noninteractive/degraded startup or an unavailable/throwing safety dependency;
- active workout or rest deadline in live state or any registered local profile;
- invalid/unreadable profile state;
- pending/busy/capturing/comparing/reconciling cloud sync;
- eligible same-entity conflict, remote conflict, blocked result, or parity drift;
- interrupted/in-flight managed recovery or an adoption journal;
- Program capture, busy/queued work, checking/conflict/blocked/error states;
- pending/in-flight/conflicting Appearance changes;
- controlled migration in progress;
- any open dialog, visible unsubmitted text input, or selected file awaiting restore;
- nonempty or malformed durable queue envelopes, including sibling namespaces.

Conservatism may defer an update even if a restart would be harmless. The user
can finish or close the relevant work and try again; there is no bypass button.
No schema, Auth, Supabase API, RLS, queue acknowledgment, or production-data
operation is introduced. New module status ports are read-only.

## Caching and support

Navigation and asset network-first/cache-fallback behavior is retained. Required
precache fetch/write errors still reject install. Never activate unconditionally
during install. Live pages retain their old caches during activation. A sole,
safe current client can request cleanup; the worker verifies the exact deployment,
no other clients, and no installing/waiting worker. Cleanup removes only older
owned cache names (creation order before its own), never newer installs, unrelated
caches, localStorage, or IndexedDB. A client-free activation can also retire older
owned caches. This avoids accumulating every accepted release indefinitely.

Advanced diagnostics separates app release, controlled worker release (or honest
legacy unknown), waiting release/state, and app origin/scope. No profile payload,
credential, cloud identity, or raw stack is added to diagnostics.

## Validation

`npm run test:pwa-update` exercises the lifecycle ports, approval guards,
controller-change race/exactly-once behavior, throttling, Later, and owned cleanup.
`tests/pwa-update.spec.js` uses real workers/HTTP servers for successive releases,
offline launch, keyboard activation, workout deferral, multiple clients, natural
close/reopen, and both legacy first-hop paths. Its historical fixture uses the
exact v103 worker core, original load-only registration, and reduced shell/
manifest, not the entire historical UI. Synthetic data only.

The same file runs in Apple-hosted WebKit CI alongside custom-domain/Auth/
recovery coverage. The protected `playwright` job depends on that WebKit job;
Pages remains downstream of green protected validation. Update-to-offline and
failed-install transitions each run ten independent repetitions, with no retries.
Linux comparison runs produced libsoup/GObject assertions and explicit internal
WebKit failures during offline fallback. Apple-hosted comparison retained every
offline/data assertion and passed all offline repetitions. The failed-install
fixture now awaits its update-check completion before reading diagnostics.
This changes the browser networking backend, not the application or offline
strategy. The exact internal engine defect is not claimed to be proven.
WebKit emulation is not an installed physical iOS test. Existing
full Chromium, startup, offline, timer, storage, cloud/Program, and Appearance
regression coverage remains required. Exact totals belong in the execution report.

## Physical stale-install proof (after verified deployment only)

1. Do not delete the Home Screen icon, clear storage, sign out, or use Safari as
   an update workaround. Preserve the v103 specimen.
2. When no workout/rest is active and private changes have finished syncing,
   fully close Big Gains from the iPhone app switcher. Reopen the same icon online
   and leave it foregrounded briefly. This is a real navigation opportunity, not
   merely background/foreground.
3. If offered Update available, tap Update now. If needed, after installation has
   had time to finish, close/reopen the same icon once more so no old client holds
   the worker waiting. No reinstall is involved.
4. Record Advanced diagnostics app version, worker version, app address, update
   state; verify Appearance's six accents and unchanged profile/training state.
5. If it remains v103, STOP. Report that result and whether the icon predates the
   custom-domain move. Determine its origin through device inspection before any
   migration. Repeated close/reopen cannot repair a redirected legacy worker URL.

For a confirmed legacy-origin install, closing this blocker requires a separately
approved way to serve a nonredirected same-origin compatibility worker or a
deliberate data-preserving origin transition. Do not change Pages/DNS or transfer
local data automatically. A new canonical-origin release cannot itself solve it.
Keep the RC blocker open until the user's stale install has been characterized
and real state preservation/update delivery has been proved.
