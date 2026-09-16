# Preserved legacy-origin PWA: guarded manual migration

Status: **runbook ready; physical migration and removal permission NOT proven**.
Inspected baseline: `5ded2a64ec41ef222c56a7be2cd4cc813a81d689` (v106).
Historical source: `e728f768044ed3a242d54d6ec8c6fc87f4f4709c` (v103).
Local schema remains v5. This procedure changes neither production data nor
hosting configuration. A docs merge is not physical migration acceptance.

## 1. Origin evidence and limits

On 2026-09-03 the canonical manifest served `v106-safe-pwa-updates` with
`config-dfadb48839db90f2`. The canonical worker returned HTTP 200. The legacy
`https://velazquick.github.io/big-gains/service-worker.js` returned HTTP 301 to
`https://app.getbiggains.com/service-worker.js`.

Worker updates reject redirected worker scripts (the
[service-worker Update algorithm](https://www.w3.org/TR/service-workers/#update-algorithm)
sets redirect mode to error). Service workers and browser
storage are origin-bound; a custom-domain deployment cannot replace an installed
GitHub-origin worker or transfer its localStorage, IndexedDB, or Auth session.
This is a probable explanation for the preserved v103 icon, not confirmation of
that physical icon's origin. See [the update evidence](PWA_UPDATE_LIFECYCLE.md).

v103 Advanced diagnostics exposes App version, Profile ID and Unit preference,
but NOT App address, worker version, scope or update state. Do not tell a v103
user to find those v106-only fields. If device Web Inspector is already available,
read `location.origin`, `location.pathname`, the existing worker controller's
`scriptURL`, and `navigator.serviceWorker.getRegistrations()` scopes without
registering, updating or unregistering anything. Otherwise retain the explicit
label **probably legacy origin; physical origin unobserved** and proceed only
through the data gates below. Repeated restarts are not an origin migration.

No DNS/Pages changes, compatibility-worker hacks, or new release are required
by current evidence. A notice deployed only on the new domain cannot reach v103.

## 2. Gate A: source safety, before any install/recovery instruction

Keep the old icon, Auth session and storage intact. Do not sign out, uninstall,
clear site data/caches, import a backup, choose a conflict winner, publish a
Program, or clear/acknowledge a queue as part of diagnosis.

Inventory **every locally retained profile**, not just the visible profile. A
managed owner may have both Jorge and Alexa. An independent/member login must
not be expanded into another user's scope. Read Auth `getUser()` through the
existing verified-user boundary and match the hosted account UUID, profile UUID,
client ID, membership and runtime descriptors. A profile name alone is not proof.

All of these must be evidenced; an unknown item is a stop condition:

- No live or persisted active workout in any retained profile.
- No live or persisted rest deadline, including an unresolved expired deadline.
- No unsaved retrospective workout/editor, Program wizard, proposal or other
  meaningful draft; no in-flight technical restore or selected restore file.
- Cloud, Program and (on v106) Appearance are idle: no capture, flush, comparison,
  reconciliation, adoption or local-save operation in progress.
- All relevant durable queue envelopes, including sibling namespaces, are
  readable, expected version/shape, and have an empty `pending` array. Also check
  in-memory queues. v103's queue loader filters invalid entries: an in-memory
  count of zero is insufficient to exclude malformed durable operations.
- No conflict, drift, retry/error, quarantine, interrupted adoption journal,
  incomplete recovery marker or controlled migration. A valid completed recovery
  marker is not itself an error. Validate markers; never erase them.
- Existing cloud status is healthy and freshly backed by the independent
  readback in Gate B; Program must not be local-only, pending or conflicting.

The v106 update safety ports are useful corroboration, not a migration proof.
Several of those ports do not exist in v103; do not interpret undefined as safe.

### Safe evidence collection on the phone

If a workout, rest timer or unsaved editor is present, stop and report it. Do not
discard or finish it solely to satisfy this checklist.

When idle, record Settings → Support → Advanced diagnostics; the Cloud & backup
card with Cloud diagnostics expanded (pending count and Last checked); and the
Program continuity message. Capture every relevant profile without discarding
unsaved work. A screenshot is preliminary evidence, not an exact fingerprint.

Settings → Cloud & backup → Your data → Technical backup & restore →
**Download technical backup** serializes the in-memory current profile to a
local file. It does not save/import the profile or upload to the cloud. Preserve
the file privately and identify its profile from its contents; same-day filenames
can collide. This backup includes `programCapture` and unknown retained profile
fields, unlike the readable export, but NOT durable queues, Auth, accepted
catalogs, other profiles, or UI drafts. Do not publish it in GitHub or attach it
to a public PR. Do not use Restore technical backup.

**Check now is not a read-only audit.** In v103 and v106 it schedules
reconciliation, which can flush writes or adopt newer remote state. Likewise
`BigGainsCloudSync.compareShadow()` writes comparison/catalog bookkeeping and,
for an independent empty-cloud baseline, can capture operations. Program
`refresh()` can write accepted bookkeeping; Retry/Publish/Use cloud/Use device
are not source-audit operations. Opening/resuming an online app can also trigger
its existing background reconciliation. Do not promise that merely viewing an
online v103 app freezes it. For strict zero-mutation capture use already-held
backups or an already-idle offline source without toggling network/restarting it
as an improvised workaround. Record before/after identity/state and invalidate
the capture if background activity changes it.

If screenshots/backup cannot establish durable queues, catalog or journal state,
stop for read-only device inspection. Do not install a new diagnostic build on
the source or relax the gate because its UI lacks the evidence.

## 3. Gate B: exact server readback, not queue=0

Use the existing pure data APIs, not reconciliation orchestration. With verified
ownership, `BigGainsCloudShadow.createRepository({client, accountId}).readAll()`
reads the five source tables, tombstones and migration journals. Reconstruct with
`reconstructCloud({ ...remote, profiles: owner.profiles, accountId })`. Read source
profile snapshots with `readLocalProfiles()` or build `localRecords()` from the
unaltered private technical backups. Use `compare({localProfiles, cloud,
expectedCatalog})` and retain aggregate AND per-table checksums/counts/reasons.
No profile should be loaded through a migration-capable `load()` just to audit it.

Completeness matters: the current repository reader does not paginate. Confirm
server counts fit the returned result set; if truncated or uncertain, stop for
an explicitly paginated read-only retrieval. A maintained account-scoped
repeatable-read SQL SELECT can establish one server snapshot; it is not a manual
SQL edit. Never run mutation RPCs, INSERT/UPDATE/DELETE, DDL or service-role code
in the client. Privileged server readback is not proof of client RLS isolation.

| Domain | Required exact comparison |
| --- | --- |
| History | Every completed-workout stable ID and full semantic payload, including sets, dates, notes and completed `programOrigin`; `workouts` per-table checksum. |
| Routines | Full named custom-routine membership/order in `routines`; immutable versioned Routine definitions/pins separately in the Program envelope. Built-in catalogs are shipped code, not recovered rows. |
| Bodyweight | Every entry, timestamp, duplicate occurrence and canonical pound value in `bodyweight_entries`; display units are separate. |
| Goals/progression | Complete `preferences/goals`, including strength goals, attained evidence and saved progression state, not just visible goal names. |
| Preferences | Timer sound/vibration, per-exercise cue/rest/prescription preferences, onboarding state, and units. `kg` has a units row; pounds may be implicit or represented by a winning units tombstone. |
| Active session | Zero effective live `active_sessions` after winner reconstruction; local active workout and rest must also be absent. A raw retained session row may be defeated by a newer tombstone. |
| Deletions | Every winning tombstone, its version/time/fingerprint and matching local absence; no resurrection or missing cataloged winner. |
| Program | Whole `program_domains/program-domain` envelope, all retained members, lineage, pins, heads, active pointer, sequence and component revisions; see below. |
| Identity/presentation | Verified Auth → account → profile mapping, display name, theme, accent and accent_version from `profiles`; these are NOT covered by the five-table shadow checksum. |

`compare()` alone is not the entire deletion/catalog proof: explicitly inspect
the UNION of accepted catalog keys and reconstructed winner keys, including keys
that are absent from both live payload lists. Require equal table/client ID,
version, normalized timestamp, fingerprint and tombstone bit; match each live
local record and require absence for every deletion. Missing/newer/stale winners
or equal-version disagreements block migration; do not adopt a catalog to make
the audit pass. Validate the completed migration journal for a managed owner.

For Program, use `BigGainsProgramDomainRecovery.readRemote()` and
`validateRemoteRow()` with verified owner/scope. Use the pure envelope `build()`
on the local capture at the remote definitions/heads/sequence revisions and
lastTransition, then `fingerprints()`. Require the aggregate and all three
component SHA-256 fingerprints to match, validate the member manifest, and
compare the accepted aggregate version/time/identity. Resolve Goal references
against that profile's recovered Goals. `classify()` may corroborate convergence;
do not call `adopt()`, publish or retry on the source. The retained
`storageMode: local_only` label alone does not mean unpublished: semantic graph
parity, not that legacy label, establishes publication.

If there is no local Program and no remote envelope, record **absence only**,
not verified published-empty parity. If Program verification is required for that
profile, remain blocked; do not create an empty envelope during this read-only
interval. A meaningful local Program with no matching remote envelope is a hard
stop. Existing portability supports deliberate publication as a separate action.

Retain private timestamped evidence for old-local ↔ server, then new-local ↔ the
same server snapshot. Re-read the server at the end. If any canonical source
changes during the interval, invalidate the baseline and repeat the gates.
An SQL inventory hash, stored Program fingerprint or row count alone proves
neither full local parity nor that the stored fingerprint recomputes correctly.

## 4. Gate C: local-only loss audit

- UI navigation, selected calendar date, filters, expansions, session-exit
  markers, transient Analyzer/PE proposals and browser permission grants do not
  cross origins. Unaccepted meaningful drafts must be resolved before migration.
- `programCapture.applicationTraces` is deliberately excluded from portability
  fingerprints. Retained successor versions/lineage/notes are authoritative;
  traces remain in the technical backup. If the user needs those traces on the
  new device, STOP: cloud-only recovery does not provide them.
- `prs` and Performance Records are derived from canonical History/bodyweight
  and the exercise catalog. Compare the rederived results; do not promise to
  recover an unexplained/manual legacy PR not supported by those sources.
- Queue acknowledgements, accepted catalogs, reconciliation observability,
  recovery/adoption journals, runtime account cache, Auth tokens, cooldowns,
  cached shell/worker and installed-PWA storage are device-local. Operational
  journals/queues are gates, not expendable evidence to erase.
- The legacy optional GitHub publishing token/config and last-published markers
  in `big-gains-sync-gateway-v1` are local-only. Do not export credentials, call
  the publisher, or treat its bounded snapshot as the canonical cloud backup.
- Audit all unknown profile keys and legacy/sibling profile storage. Unknown,
  unsynced or meaningful local-only content is a STOP, not permission to discard.
- v103 predates Appearance v1. v106 cloud accent is in `profiles`, with a separate
  local pending cache, not the technical profile backup or shadow checksum.
  Legacy version-0 `ember` resolves to Volt; explicit version-1 Ember is orange.
  Document this presentation mapping and any already-saved newer cloud choice;
  never overwrite it merely to make v103 and v106 screenshots look identical.

Presence of user-meaningful local-only data requires reporting the exact gap and
agreeing on preservation before migration. A retained backup is not proof that
the new-origin app has recovered that data.

## 5. Gate D: physical new-origin procedure (ONLY after A–C pass)

1. Leave the old icon installed and do not use it for new edits during the proof.
2. In Safari open **https://app.getbiggains.com/**. Confirm the exact address,
   expected current release and existing-account sign-in/recovery state.
3. Follow [Apple's Safari installation flow](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios):
   Share (possibly under More) → Add to Home Screen.
   If offered Open as Web App, leave it enabled. Give the new icon a distinct
   name such as **Big Gains New**. Do not replace/delete the old icon.
4. Launch the NEW icon. Safari success is not proof of this separate container.
   Check Settings → Support → Advanced diagnostics: expected app release,
   worker version, and App address `https://app.getbiggains.com/`. v106 shows
   the page's base address; exact registration scope requires device inspection.
5. Sign in to the EXISTING account if needed. Do not Sign up/Create account,
   create a second profile, or repeat account bootstrap. Unexpected account
   shape, empty identity or existing meaningful target data is a stop condition.
6. Allow guarded fresh-device recovery over an exact blank startup artifact.
   Do not enter workouts, edit Goals/units or build a Program while it is pending.
7. Program recovery is separate. When the verified target has no local Program
   and offers **Program update available**, confirm the expected cloud graph,
   then choose **Use cloud Program**. Do not choose a winner in a conflict and
   do not Publish Program from an empty target. Existing recovery validates the
   graph and persisted readback without rewriting completed History.
8. Complete Gate E. Leave both icons intact if anything fails or is unavailable.

This step intentionally permits guarded recovery writes to the NEW device only;
it does not authorize cloud data changes, old-device imports or conflict choices.

## 6. Gate E: target parity and removal decision

Repeat Gate B against a fresh snapshot of the target, with both source and
server baselines unchanged. Require all of the following:

- Correct authenticated account/profile mapping; every retained local profile
  accounted for, no unauthorized profile/History/Program shown or mixed in.
- History IDs, content and count; Goals/progression; custom routines; bodyweight;
  timer/exercise/onboarding/unit preferences all exactly match the server.
- Profile name/theme/accent follow the verified hosted presentation mapping.
- Complete Program graph, member manifest, versions/pins/lineage, active pointer
  and sequence match the server aggregate and three component fingerprints.
- Performance Records rederive with correct source-workout/set attribution.
- Recovery completion markers and persisted local readback are valid, then
  survive an ordinary close/reopen of the NEW icon while idle.
- No active workout/rest, pending durable operation, capture, conflict, error,
  quarantine or unfinished recovery on the target. Cloud says In sync and
  Program says **This device matches the verified private Program copy**.
- All local-only exceptions are explicitly resolved; no unaccounted data remains.
- The old icon remained intact throughout. Recheck all its retained profiles
  before retiring the entire old-origin container, not just the current profile.

Only after the timestamped evidence record marks EVERY gate passed may support
say: **“Migration complete. You can remove the old Big Gains icon.”**
Removal is optional and manual by the user. Never automate it, clear origin
storage or imply that passing automated tests authorizes it. Until then say:
**“Migration not yet proven. Keep the old Big Gains icon.”**

## 7. Forward-update readiness, without a fabricated release

After target parity, confirm v106 app AND controlled worker, same custom-domain
registration, successful **Check for app update**, and no update-check error.
The v106 lifecycle registers immediately, checks startup/focus/pageshow/visible/
online, observes waiting workers, offers Update now/Later, and restarts only after
explicit approval with fail-closed safety and one reload. Other same-scope windows
block forced activation. This proves readiness, not a physical v106 → next build.

The existing real-worker synthetic fixtures cover successive releases, legacy
redirects, offline reload, unsafe workout deferral, multiple clients and failed
installation. Future physical acceptance needs a genuine next release: record
waiting/offered update, Later retaining data, approved idle restart, new app and
worker versions, unchanged canonical data and offline launch. Do not fabricate a
production marker release or start/modify a real workout for this drill.

## 8. Support wording

> Big Gains has moved to app.getbiggains.com. Keep your current Big Gains icon.
> We will first verify its saved data against your private cloud copy, check for
> local-only or pending work, and then help you install and verify the new app.
> Do not delete the old app, clear storage, restore over it, or choose a sync
> conflict option. We will explicitly tell you when migration has been proven.

Use this manually. Do not claim it was delivered into an unreachable v103 shell.

## 9. Validation and delivery

One topic branch, protected PR, exact reviewed head, green required `playwright`
(including its Apple WebKit prerequisite), no admin bypass. The repository
deploys every successful main push, including documentation-only changes; do not
trigger a separate deployment or alter the release/config marker for this doc.

Run `npm run test:pwa-update` and `npm test` through the existing cloud workflow.
It includes Program envelope/gateway/transport/recovery/cutover/runtime tests and
the full Chromium regression corpus. Its Apple-hosted WebKit job covers fresh
recovery, custom-domain/Auth and real-worker updates, plus ten independent runs
each of update-to-offline and failed-install transitions. Synthetic/local fixtures
only; no production credentials or user-data writes in tests. Specifically retain
fresh-device recovery, cloud queue/conflict, cross-device fast-forward, managed
profile access, boot isolation, startup, retrospective editor and Performance
Records coverage. Check Markdown links and `git diff --check` too.

Keep actual private phone/server snapshots OUT of the public repository. An
execution record should list source/release SHAs, HTTP observations, test-run/PR
links and each gate as passed/failed/not observed; do not substitute planned
checks for results. Stop this interval at migration proof/documentation or at a
device/evidence blocker. No telemetry, backup-system work or other RC work.
