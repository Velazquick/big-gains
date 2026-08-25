# Big Gains RC-2 self-serve onboarding and recovery contract

- Status: **Normative product and implementation contract; documentation only**
- Contract version: **1**
- Repository baseline: `origin/main` at `b5ffd908952b875e79c24c9b36525a88b092a5d6`
- Runtime marker: `v95-mobile-startup-interactivity`
- Local profile schema: **5**
- Date: 2026-08-25
- RC plan items closed by a later conforming implementation: R1, R2, R3, and R6 in the [Release Candidate Plan](RELEASE_CANDIDATE_PLAN.md)

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **MAY**, and **OPTIONAL** are normative when capitalized.

## 0. Authority, boundary, and precedence

**RC2-0.1 — Purpose.** RC-2 defines how an ordinary independent user creates an account, completes a minimal first run, reaches a first meaningful workout, and recovers every RC-promised domain on another device without operator narration.

**RC2-0.2 — Documentation-only interval.** This interval changes Markdown only. It MUST NOT change runtime code, Supabase Auth settings, schema, migrations, RLS, production users or data, deployment, or release state.

**RC2-0.3 — Current versus target.** Section 1 records current fact. Sections 2–12 define target RC behavior, Section 13 is informative research, and Section 14 records gated implementation choices. Target clauses do not assert that the behavior ships today.

**RC2-0.4 — Existing-contract precedence.** Until a later reviewed implementation contract explicitly amends them, [Synchronization Semantics](SYNC_SEMANTICS.md), [Program Foundation v1](PROGRAM_FOUNDATION_V1.md), [Programming Engine v1](PROGRAMMING_ENGINE_V1.md), [Goals v1](GOALS_V1_SPEC.md), [Product IA v1](PRODUCT_IA_V1.md), and the account contracts remain authoritative. RC-2 MUST be implemented by extending those contracts, not bypassing them.

**RC2-0.5 — Preserved meanings.** Goal remains the destination, Program the route, Train execution, History performed fact, Progress interpretation, and Library reusable material. Onboarding MAY connect these concepts but MUST NOT merge their models or authority.

**RC2-0.6 — No architecture lesson.** User-facing onboarding MUST NOT require knowledge of account shapes, RLS, storage namespaces, schema versions, sync revisions, provenance, immutable versioning, rolling-cadence internals, authority modes, or application traces.

## 1. Proven current state

**RC2-1.1 — Access today.** Production supports invited independent users, not public self-serve signup. Public email signup is disabled in hosted Auth and checked-in `supabase/config.toml`; the app has no Create Account surface or `signUp` call; browser Magic Link uses `shouldCreateUser: false`.

**RC2-1.2 — Current provisioning.** An authenticated user with neither an owned account nor a managed membership can invoke the security-invoker `bootstrap_independent_account` RPC. It validates `auth.uid()` and creates one owned account plus one independent profile atomically. Managed membership is an administrative path and is not created by that RPC.

**RC2-1.3 — Current first run.** A newly invited independent user chooses a display name, receives cobalt / performance-dark / companion-off presentation, generic schedule and code-defined routines, and then enters the full app. There is no welcome, product introduction, guided first workout, Program, exact strength Goal, bodyweight history, or completed History.

**RC2-1.4 — Current cloud recovery.** The synchronized source set is completed workouts, custom routines, bodyweight entries, Goals/progression and other supported preferences, and active sessions/rest deadlines. Profile presentation is recovered through the verified profile row. Guarded reconstruction and adoption preserve ownership, monotonic revisions, completed-History authority, queue integrity, and local-first operation.

**RC2-1.5 — Current Program gap.** Canonical `state.programCapture` is local-only. It contains Program and Routine identities and immutable versions, active/draft state, sequence position, block/review configuration, and approved application traces. Workout and active-session shadows retain `programOrigin`, so a fresh device can currently recover Program-origin workouts without the graph those facts reference.

**RC2-1.6 — Current device split.** Safari and an installed iOS Home Screen PWA use separate Auth and local-storage containers. A link opened in Safari does not authenticate the installed PWA. Signing out currently removes Auth state while retaining and continuing to expose the local profile runtime.

**RC2-1.7 — Current special profile.** The exact independent client ID `independent-09034233fa064233b85018aec182764d` selects SZW’s special six-day configuration. It is compatibility behavior, not a generic onboarding mechanism.

## 2. Target end-to-end journey

**RC2-2.1 — Entry.** A clean production URL MUST show a neutral Big Gains welcome with **Create account** and **Sign in**. It MUST expose no managed identity, private profile name, or training data before identity and ownership are verified.

**RC2-2.2 — Ordinary new-user path.** The target path is: Create account → confirm email → verified password session → create independent profile → concise welcome → Train now → first workout → completion receipt → History/Progress confirmation.

**RC2-2.3 — No operator dependency.** The ordinary path MUST require no Dashboard action, invitation, secret URL, managed membership, phone call, or founder explanation.

**RC2-2.4 — Recoverable stages.** Auth creation, email confirmation, profile bootstrap, onboarding progress, workout creation, and completion MUST be separately retryable. Reloading or repeating a callback MUST resume the verified stage and MUST NOT create another account, profile, workout, or onboarding record.

**RC2-2.5 — Network boundary.** Signup, first identity verification, first profile bootstrap, and fresh-device cloud recovery require network access. After a device has an accepted cached identity/runtime, existing local-first offline capabilities remain available under [Synchronization Semantics](SYNC_SEMANTICS.md).

## 3. Public independent signup and Auth

### 3.1 Identity creation

**RC2-3.1 — Signup kind.** Public signup MUST create only a Supabase Auth email/password identity. It MUST NOT create an account row, profile row, `profile_memberships` row, managed access, training row, or local training state in the same step.

**RC2-3.2 — Minimum fields.** Signup asks only for email, password, and password confirmation. Display name belongs to authenticated profile bootstrap. Password confirmation is client validation and MUST NOT be stored or sent separately.

**RC2-3.3 — Password rule.** The UI and hosted Auth policy MUST enforce the same minimum of at least eight characters. The implementation MAY adopt a stronger provider-supported compromised-password or strength policy after threat review, but MUST state it before submission and MUST NOT invent inconsistent client-only rules.

**RC2-3.4 — Email confirmation.** Email confirmation is REQUIRED before profile bootstrap. A successful `signUp` with no confirmed session MUST show one neutral “Check your email” state, a resend action subject to cooldown/rate limits, the submitted address with an edit/restart action, and the Safari/Home Screen explanation in RC2-7.2.

**RC2-3.5 — Confirmation destination.** A signup confirmation link MUST use an exact allowlisted production redirect and return to the neutral main Auth resolver, not the password-reset form. The resolver MUST verify the returned user with a fresh server-backed identity check before reading account shape or offering bootstrap.

**RC2-3.6 — Post-confirm result.** A confirmed browser session with no account or membership proceeds to independent profile bootstrap. A confirmed session with an existing independent account resumes that account. A confirmed managed member/owner proceeds through the existing exact managed resolver and MUST NOT see independent bootstrap.

**RC2-3.7 — Duplicate privacy.** Signup MUST present the same accepted/check-email response whether an address is new, pending, or already registered whenever the provider accepts the request. It MUST NOT use response shape or error detail to confirm account existence. The state MAY offer **Sign in** and **Forgot password** as generic alternatives.

**RC2-3.8 — Genuine validation errors.** Invalid email syntax, mismatched passwords, password-policy failure, rate limit, offline state, and unavailable service MAY be stated because they do not establish whether an account exists. Raw provider errors, user IDs, and stack details MUST NOT be shown.

**RC2-3.9 — Email and abuse gate.** Production self-serve signup MUST NOT be enabled until a production transactional mail path (custom SMTP or a separately reviewed Supabase Send Email Hook) delivers confirmation and recovery mail to ordinary non-team addresses. The rollout MUST also record exact redirect allowlists, provider/domain configuration, signup and email rate limits, delivery/failure monitoring, and the CAPTCHA/abuse-control decision. Supabase’s built-in demonstration mailer is not an RC production path. CAPTCHA MAY be omitted only when the review records an equivalent bounded control and retry behavior.

### 3.2 Sign-in, Magic Link, and recovery

**RC2-3.10 — Primary sign-in.** Password remains the primary sign-in method in browsers and installed/Home Screen use. Existing passwords remain valid.

**RC2-3.11 — Magic Link.** Browser Magic Link MAY remain a secondary existing-user convenience with `shouldCreateUser: false`. It MUST be labeled as signing in only the browser that opens the link and MUST NOT be presented inside standalone mode as a way to authenticate that installed context.

**RC2-3.12 — Forgotten password.** Password-reset request remains generic and cooldown-protected: the same accepted response is shown regardless of account existence. The reset link MAY continue to use isolated `auth-setup.html`; after password update it MUST clear the temporary browser session and direct the user to password sign-in in the browser or installed app they intend to use.

**RC2-3.13 — Broken Auth link.** Expired, reused, malformed, prefetched, offline, or wrong-context confirmation/recovery links MUST land in a safe neutral state with actions to request another email and return to sign-in. They MUST NOT fall through to profile bootstrap or a partially authenticated shell.

**RC2-3.14 — Invite compatibility.** Existing invite and recovery links, accounts, passwords, and Magic Links remain supported. An invited independent identity without an application account uses the same profile bootstrap. An invited managed identity resolves only through its pre-existing administrative membership.

### 3.3 Auth-to-profile bootstrap

**RC2-3.15 — Separate bootstrap.** After fresh user and account-shape verification, the application MUST invoke the existing server-side atomic independent bootstrap or a behaviorally equivalent reviewed successor. Auth signup success alone MUST NOT imply application-profile success.

**RC2-3.16 — Idempotent interpretation.** Repeated bootstrap requests/callbacks MUST converge on exactly one owned independent account and one independent profile. A verified already-ready independent shape is success; a managed shape is routed to managed access; owner/member overlap, multiple accounts/profiles, or any other unexpected shape fails closed without mutation.

**RC2-3.17 — Public/managed separation.** No public field, Auth metadata value, URL parameter, client ID, profile name, or bootstrap argument may create or join a managed membership. Membership mutation remains administrative-only and RLS/server policy remains the authority.

**RC2-3.18 — Display name.** Profile bootstrap asks for one 1–60 character display name under the existing trim, whitespace, and control-character rules. Email local-part MAY be offered as editable convenience but MUST NOT be silently accepted as the profile name.

## 4. First-run welcome and profile setup

**RC2-4.1 — Welcome placement.** A newly bootstrapped profile MUST see a neutral, profile-scoped first-run surface before the ordinary personalized shell. It MUST confirm that the private profile is ready and answer: what Big Gains is, what can be done now, and what to do first.

**RC2-4.2 — Product explanation.** The concise explanation is: **Train** logs today’s work; **Plan** connects optional Goals and a Program; **Progress** and History show what happened; **Library** holds reusable exercises and routines. Goal is where the user is going; Program is an optional route.

**RC2-4.3 — Primary action.** **Train now** is the primary first-run action. **Explore the app** and optional **Set a Goal** / **Create a Program** actions MAY be secondary. Goal and Program setup MUST NOT gate Train, onboarding completion, or first success.

**RC2-4.4 — Minimal questions.** Beyond display name, RC onboarding MUST ask no required fitness-history, schedule, bodyweight, Goal, Program, equipment, experience, theme, accent, or companion questions.

**RC2-4.5 — Presentation defaults.** Generic independent profiles keep the current safe defaults: cobalt accent, performance-dark theme, companion off. Theme and accent are deferred to Settings/presentation work and are not onboarding questions.

**RC2-4.6 — Companion decision.** The companion remains off by default and is not offered during first run. A later profile-scoped Settings control MAY offer explicit opt-in; absence of that control does not block RC-2. Managed and existing independent presentation values remain unchanged.

**RC2-4.7 — Starter content.** Existing generic code-defined Push, Pull, Legs, Core, Full Body, and Conditioning routines MAY remain as clearly labeled starter options, not a personalized Program. RC-2 does not require replacement routines or generated plans.

**RC2-4.8 — Special identity ban.** Generic onboarding MUST NOT branch on a special profile/client ID. SZW compatibility remains intact under RC2-8.6, but it MUST NOT be copied as a template for future user setup.

### 4.1 Onboarding persistence

**RC2-4.9 — State contract.** Later implementation MUST define one profile-scoped, versioned onboarding preference with at least contract version, status (`in_progress`, `completed`, or `skipped`), last resumable stage, and completion/skip time. It MUST contain no email, Auth ID, analytics, questionnaire answers, or duplicate training data.

**RC2-4.10 — Cloud recovery.** Onboarding state is a meaningful preference and MUST use the ordinary synchronized preference semantics. It MAY use a new stable singleton inside the existing `preferences` semantic source table; this does not authorize storing Program data there.

**RC2-4.11 — Skip/resume.** Skip, resume, and complete are idempotent. Skip suppresses the full welcome but leaves contextual empty-state guidance until first success. A newer onboarding contract MAY show only newly required material and MUST NOT reset the profile or training state.

## 5. First success

**RC2-5.1 — Operational definition.** First success occurs when the new profile completes and locally persists one workout containing at least one valid completed working set, then sees a completion receipt and can open the same workout in History. Merely opening Train, starting a timer, or creating a Program is not first success.

**RC2-5.2 — Shortest valid path.** The canonical shortest path is: **Train now → Start blank → add one or more exercises from the shared Library picker → log valid working set values → complete the workout → view receipt → open History**.

**RC2-5.3 — Feasibility boundary.** The path MUST reuse the existing blank-workout, exercise-picker, active-session, set-validation, completion, History, and local-first persistence boundaries. It MAY add a direct **Start blank** entrance; it MUST NOT create a parallel workout model or onboarding-only save path.

**RC2-5.4 — Contextual guidance.** First use SHOULD actively guide the blank path with short, dismissible guidance. It MUST explain only what is needed at that moment: choose a movement, log a working set, the rest timer is optional, Finish saves locally, and the result appears in History/Progress.

**RC2-5.5 — Starter alternative.** The user MAY instead choose a code-defined starter routine and complete it through the ordinary Train path. Starter content MUST be called a starting point, not “your Program” or a personalized prescription.

**RC2-5.6 — Empty states.** Minimum actionable copy is:

| Destination | Meaning | Required action |
| --- | --- | --- |
| Train | Log a workout now; no Goal or Program required. | **Start blank** and **Choose a starter workout** |
| Plan | Goals are destinations; Programs are optional routes. | **Set a Goal** or **Create a Program**, both marked optional |
| Progress / History | Completed workouts become the evidence here. | **Start a workout** when empty |
| Library | Browse exercises and reusable routines. | **Browse exercises** or **Choose a routine** |

**RC2-5.7 — Skipped onboarding.** A user who skips welcome lands on Train with the same actionable empty state and can complete the identical first-success path. No hidden capability depends on onboarding status.

**RC2-5.8 — Local-first completion.** Accepted set/workout mutations persist locally before enqueue. Auth, email, or cloud failure MUST NOT undo a locally accepted first workout. Sync status MAY be pending, but the receipt MUST distinguish “saved on this device” from verified cloud parity.

## 6. RC fresh-device and reinstall promise

### 6.1 Promised domains

**RC2-6.1 — Promise trigger.** On a clean device, a verified independent user who signs in online MUST recover the latest cloud-verified version of every domain below. Big Gains MUST NOT describe the device as fully restored until reconstruction, local commit, catalog adoption, and semantic parity are verified.

**RC2-6.2 — Completed facts.** Restore every completed workout, exercise, set, performed value, workout/exercise note embedded in those records, stable workout identity, retrospective marker, and recorded `programOrigin` unchanged.

**RC2-6.3 — Reusable and body data.** Restore all user-created custom routines and bodyweight history under their existing stable identities and tombstone rules.

**RC2-6.4 — Goals.** Restore Goals, lifecycle, guidance authorization, attainment evidence, and progression state represented by the canonical Goals preference. Derived analytics and records are recomputed from restored facts.

**RC2-6.5 — Preferences and presentation.** Restore timer sound/vibration, per-exercise cues/rest preferences, onboarding completion, and other explicitly synchronized meaningful preferences. Restore display name and profile presentation (`pet_enabled`, accent, theme) from the verified profile mapping. Presentation MUST remain profile-scoped.

**RC2-6.6 — Active state.** Restore the exact active workout and rest deadline when the current active-session contract has a valid cloud winner. The active workout remains a frozen snapshot; recovery MUST NOT rematerialize it from a routine or Program.

**RC2-6.7 — Program domain.** If the profile has created a canonical Program, restore the complete canonical Program graph required for exact continuity: Routine identities and every retained immutable Routine version; Program identities and every retained immutable Program version; active/draft/archive status and pointers; exact Routine-version slot pins; Goal links; cadence, start, block/review and authority configuration; sequence position and completed cycles; predecessor/successor lineage; and effective-boundary metadata. The normative [Program portability synchronization v1 contract](PROGRAM_PORTABILITY_SYNC_V1.md) keeps application traces local-only because successor graph state, not PE observability, is required for continuity.

**RC2-6.8 — No inference.** Program recovery MUST use the synchronized Program domain as source. It MUST NOT infer or rebuild a Program, Routine version, sequence position, cycle, or lineage from workout names, weekdays, custom routines, Goals, or completed `programOrigin` facts.

**RC2-6.9 — History immutability.** Completed-workout `programOrigin` is historical fact. Recovery, Program migration, conflict resolution, activation, or successor creation MUST NOT rewrite, backfill, delete, or “repair” it to match the current Program graph.

**RC2-6.10 — Missing historical graph.** If an older Program-origin workout references a graph that was never made portable and no verified local/backup source exists, Big Gains MUST preserve the workout origin unchanged, report that Program detail is unavailable, and MUST NOT invent the graph. RC release migration MUST bring every accessible existing Program capture to verified parity before promising full portability for that profile.

### 6.2 Program portability architecture decision

**RC2-6.11 — First-class domain.** Program portability is a new first-class synchronized semantic domain. It MUST NOT be embedded wholesale in `preferences` JSON, hidden in custom routines, or reconstructed from workout provenance.

**RC2-6.12 — Semantic decomposition.** Program portability MUST represent, at minimum, immutable Routine-version entities, immutable Program-version entities, mutable Program identity/head metadata, active/draft/archive pointers, and mutable sequence state. The selected single-envelope transport MUST preserve each logical identity, immutable member fingerprint, component revision, and dependency explicitly. Application traces remain local-only observability under [PPS1-1.7](PROGRAM_PORTABILITY_SYNC_V1.md#1-proven-state-and-synchronized-domain).

**RC2-6.13 — Immutable lineage.** An immutable Routine or Program version is append-only after verified creation. A change creates a new stable version ID with predecessor linkage. Conflict or recovery logic MUST NOT update an immutable version in place or create a new ID for an already-known version.

**RC2-6.14 — Mutable conflict scope.** Mutable Program heads/pointers and sequence state require stable logical IDs, positive monotonic revisions, exact accepted bases, canonical fingerprints, tombstones where deletion is supported, guarded write/readback, and explicit same-entity conflict choice. A preference-level last-write-wins rule is forbidden.

**RC2-6.15 — Graph validation.** A recoverable Program candidate MUST prove profile/account ownership; unique IDs; valid predecessor links; exact Program-slot-to-Routine-version pins; valid active/draft pointers; a sequence bound to the exact active Program version; valid Goal references when present; and compatibility with any recovered active workout origin. Missing, duplicate, cross-profile, cyclic, or malformed dependencies block Program adoption.

**RC2-6.16 — Atomic recovery boundary.** The cloud representation MUST expose a profile-scoped graph manifest/generation, aggregate revision, transactional snapshot, or equivalent reviewed boundary that proves the complete dependency set belongs to one recoverable Program state. Fresh-device recovery MUST reconstruct and validate cloud-backed training state plus that Program graph as one candidate and commit it with the existing crash-consistent all-or-recoverable adoption journal pattern. It MUST NOT expose a profile whose catalog claims Program parity while its graph or required Routine versions are partial.

**RC2-6.17 — Local-first order.** Program create/edit/approve/activate and sequence advancement MUST persist inside the canonical local schema-v5 profile before durable enqueue and MUST remain usable offline. Application-trace mutations also persist locally but are excluded from the portable envelope under [PPS1-1.7](PROGRAM_PORTABILITY_SYNC_V1.md#1-proven-state-and-synchronized-domain). Program portability does not make cloud the live editing authority.

**RC2-6.18 — Active provenance.** An active Program-origin workout keeps the exact frozen Program/Routine provenance captured at materialization. A recovered or newly activated successor MUST NOT change that snapshot. Completion advances sequence exactly once under the existing compatible-successor rule.

**RC2-6.19 — Existing sync extension.** A later implementation MUST explicitly amend the source set and entity rules in [Synchronization Semantics](SYNC_SEMANTICS.md), the cloud adapter/recovery contracts, hosted schema/RLS, queue capture, migration, and tests. Local profile schema MAY remain version 5 because `programCapture` already lives there; no schema version change is authorized here.

**RC2-6.20 — Required dependent spec.** The normative [Program portability synchronization v1 contract](PROGRAM_PORTABILITY_SYNC_V1.md) fixes the single-envelope representation, stable client ID, canonical fingerprints, graph-completeness boundary, dependency order, revision/conflict rules, RLS requirements, local-to-cloud migration, queue/ACK behavior, recovery reconstruction, and existing-profile cutover. Runtime Program portability MUST conform to it and preserve every existing Program/Routine/version identity while transitioning from `big-gains.program-capture.v1` and `storageMode: local_only`.

### 6.3 Recovery safety

**RC2-6.21 — Scope and monotonicity.** Recovery remains Auth-verified, account/profile scoped, monotonic, non-destructive, and fresh-read based. A profile UUID, Program ID, or client-supplied identity alone grants no access.

**RC2-6.22 — Non-pristine target.** Fresh recovery MUST NOT silently overwrite or merge a non-pristine local namespace. It uses the existing guarded fast-forward/conflict model or stops with an actionable choice and preserves all local data and queue operations.

**RC2-6.23 — Partial/malformed cloud.** Ownership mismatch, missing required Program dependency, invalid schema, unsupported contract, incomplete queue disposition, or failed readback MUST stop before visible adoption. The user sees **Recovery stopped safely**, a concise reason category, Retry, and a support/export path. No blank profile is silently accepted as recovery.

**RC2-6.24 — Honest recency.** The promise covers data that reached verified cloud parity. Pending offline/device-only work remains safe on that device but cannot be claimed as restored elsewhere. Status and destructive local removal MUST make that boundary explicit.

## 7. Browser, installed app, and sign-out

**RC2-7.1 — Separate containers.** Safari/browser and installed iOS PWA separation is a product constraint, not an error. Copy MUST call them **browser** and **Home Screen app**; it MUST NOT imply that a browser session transfers into the installed app.

**RC2-7.2 — Signup confirmation copy.** When a signup started in the Home Screen app but its email opens in Safari, the confirmation result MUST say: the email is confirmed in this browser; to use the Home Screen app, open it and sign in once with the password just created. A visible **Open Big Gains** action MAY attempt the installed context but MUST retain manual instructions.

**RC2-7.3 — Invite/recovery copy.** Invite and recovery completion in Safari MUST give the same return instruction. Password setup MUST NOT claim that the installed app is signed in.

**RC2-7.4 — Offline context.** A new container requires network for first authentication and recovery. A previously accepted container MAY continue local-first offline under existing cached-identity safeguards. Offline state MUST NOT fabricate email confirmation, bootstrap, or cloud parity.

### 7.1 Sign-out and local data decision

**RC2-7.5 — RC privacy decision.** Retaining readable local training data is acceptable for RC only when the action is explicitly named **Sign out of cloud**, immediately states that training remains available on this device, and offers a separate **Remove this profile from this device** action. A plain unlabeled **Sign out** that appears to protect local data is not acceptable.

**RC2-7.6 — Cloud-only sign-out.** Sign out of cloud clears the Auth session for the current container and retains the current local-first runtime, state, queue, catalog, and recovery metadata. It MUST say that anyone using this browser/app can still see the local profile. This preserves SS-1.2 signed-out local use.

**RC2-7.7 — Local removal.** Remove this profile from this device is a separately confirmed destructive action scoped to the exact current runtime namespace. It removes local profile state, Auth state in that container, queue/catalog/recovery/onboarding metadata, and cached mapping needed to reopen it; it MUST NOT delete cloud rows or affect another Safari/PWA container.

**RC2-7.8 — Unsynced-change guard.** Local removal MUST first prove verified parity and an empty valid queue. If it cannot, it blocks by default and offers Retry sync and technical backup/export. A deliberate discard of unsynced local work requires a second consequence-specific confirmation; it MUST NOT be bundled into ordinary sign-out.

**RC2-7.9 — Security claim.** RC-2 does not claim encrypted browser storage or protection against a person with device/storage access. Copy MUST direct shared-device users to local removal. Strong local lock/encryption is future security scope unless a later threat review makes it an RC blocker.

## 8. Existing users and compatibility

**RC2-8.1 — Managed account.** Jorge/Alexa’s managed-owner account shape, exact profile IDs, storage compatibility keys, profile switcher, and per-profile data/presentation remain unchanged.

**RC2-8.2 — Managed members.** Existing managed memberships remain administrative, one-profile access. Public signup cannot request, create, convert to, or attach one.

**RC2-8.3 — Independent and invited users.** Existing independent users, invited identities, passwords, Magic Links, profile/account rows, presentation, and recovery markers continue to resolve. RC-2 MUST NOT require account recreation or identity migration merely to use self-serve UI.

**RC2-8.4 — Data invariants.** Schema-v5 local state, current RLS isolation, local-first workout logging, completed-History authority, durable queue/ACK/reconciliation rules, Goals and Programming authority, immutable versions, and per-profile presentation remain intact unless the Program portability spec explicitly extends them without weakening them.

**RC2-8.5 — No default migration.** New generic onboarding defaults apply only to newly bootstrapped generic independent profiles. They MUST NOT overwrite existing schedules, routines, Goals, Programs, bodyweight, presentation, onboarding-equivalent state, or History.

**RC2-8.6 — SZW transition.** The existing SZW client-ID behavior MUST remain supported through RC-2. A later implementation SHOULD replace identity coupling with explicit versioned profile configuration only through a separate migration that proves the same six-day schedule/routines before removing the hard-coded branch. No RC-2 cleanup may silently retire it.

## 9. Error and recovery language

**RC2-9.1 — Plain-language categories.** Ordinary surfaces use: **Check your email**, **Sign-in needed**, **Finish profile setup**, **Restoring this device**, **Saved on this device**, **In sync**, **Retry needed**, **Needs your choice**, and **Recovery stopped safely**. Internal error codes MAY appear only in Advanced/support detail.

**RC2-9.2 — No silent fallback.** Auth verification, account-shape, bootstrap, or recovery failure MUST NOT reveal the personalized shell, silently create local defaults, or treat a partial restore as a new empty account.

**RC2-9.3 — Data assurance.** Every failure state that preserves data MUST say so. Every action that can discard local-only data MUST state the exact scope and consequence before confirmation.

**RC2-9.4 — Accessibility.** Auth, first run, recovery, conflict, and destructive-confirmation flows MUST be keyboard and screen-reader operable, place focus on the new heading/error/action, announce asynchronous status without repeated noise, respect reduced motion, and remain usable at supported mobile text sizes.

## 10. Self-serve release acceptance matrix

All scenarios require automated coverage where the platform is simulatable plus the physical Safari/Home Screen checks named below. “Unchanged” means both user-visible behavior and the relevant identity/data invariants.

| ID | Scenario | Required result |
| --- | --- | --- |
| RC2-AT-01 | Completely new browser user submits email/password, confirms email, bootstraps, trains, completes | One Auth identity, one independent account/profile, welcome, first-success receipt, and the exact workout in History |
| RC2-AT-02 | Duplicate signup for pending or existing email | Same generic accepted/check-email state; no account-existence disclosure and no duplicate Auth/application profile |
| RC2-AT-03 | Password recovery, including expired/reused link | Generic request; isolated verified update; safe retry; password sign-in succeeds in intended container |
| RC2-AT-04 | Existing invited independent user | Existing password/setup and one-profile bootstrap/resolution remain valid |
| RC2-AT-05 | Existing Jorge/Alexa owner and managed member | Exact managed shapes, profiles, switcher/membership, and data remain unchanged |
| RC2-AT-06 | Public user attempts managed access through fields, metadata, URL, RPC, or profile ID | No membership/account attachment; administrative boundary and RLS deny access |
| RC2-AT-07 | New independent user queries/mutates another account/profile | No rows visible or mutable across the boundary |
| RC2-AT-08 | Skip/resume/reload/repeat onboarding callbacks | Versioned state resumes or remains skipped/completed; no duplicate profile and Train always remains reachable |
| RC2-AT-09 | Start blank with no Goal or Program | Exercise can be chosen, valid sets logged, workout completed, and History opened |
| RC2-AT-10 | Add Goal and/or Program later | Ordinary canonical setup works; prior workout remains unchanged and un-attributed to Program |
| RC2-AT-11 | Fresh-device independent sign-in after verified parity | Every RC2-6.2–RC2-6.7 domain restores and parity is proved before “In sync” |
| RC2-AT-12 | Fresh device with Program | Exact IDs, all required immutable versions, pins, lineage, active/draft state, block/review config, and sequence restore |
| RC2-AT-13 | Program-origin History before/after recovery | Byte-equivalent `programOrigin` facts; no backfill or rewrite |
| RC2-AT-14 | Active Program-origin workout and rest deadline recover/reconcile | Exact frozen workout provenance/state returns; completion advances compatible sequence once and only once |
| RC2-AT-15 | Signup/recovery starts in Home Screen app and email opens Safari | Browser success is clear; installed app still requests one password sign-in and then resolves correctly |
| RC2-AT-16 | Previously initialized device is offline | Existing local runtime starts/resumes/completes workouts; durable queue waits; no false cloud claim |
| RC2-AT-17 | Failed/malformed/partial recovery or broken Auth link | Safe blocking state, preserved local data/queue, Retry/support action, no partial or silent blank bootstrap |
| RC2-AT-18 | Repeated signup confirmation/bootstrap/auth callbacks | Exactly one application account/profile; ready shape treated idempotently |
| RC2-AT-19 | Presentation defaults and restore | Generic user is cobalt/dark/companion-off; values are profile-scoped and restore without affecting managed/SZW profiles |
| RC2-AT-20 | Existing SZW profile | Six-day configuration, routines, account isolation, training, sync, and recovery remain supported |
| RC2-AT-21 | Sign out of cloud | Auth clears only in that container; local data remains available with explicit disclosure and queue remains intact |
| RC2-AT-22 | Remove local profile with clean versus pending queue | Clean removal affects exact device namespace only; pending state blocks unless separately backed up/discard-confirmed |
| RC2-AT-23 | Program same-entity concurrent edits/sequence advancement | Monotonic guard blocks automatic choice; explicit resolution preserves immutable versions and unrelated advancement |
| RC2-AT-24 | Existing local-only Program cutover | Verified graph uploads once, readback matches exact IDs/fingerprints, and portability is promised only after parity |

## 11. Implementation sequence and release gates

**RC2-11.1 — Contract sequence.** Later work SHOULD be reviewed in this order: Auth threat/configuration plan; public signup and recovery UX; onboarding-state/first-success implementation; Program portability sync spec; hosted Program schema/RLS/migration; cloud adapter/queue/recovery implementation; existing-profile cutover; automated and physical acceptance matrix.

**RC2-11.2 — Configuration gate.** Runtime signup UI MAY merge behind a fail-closed capability, but public hosted signup MUST remain disabled until exact production redirects, confirmations, email delivery, rate/abuse controls, recovery templates, and rollback are verified on a non-production test identity/project path approved for the implementation interval.

**RC2-11.3 — Program gate.** Big Gains MUST NOT claim full new-device recovery or RC-2 completion until Program portability, existing-profile cutover, exact graph recovery, active-workout compatibility, and conflict tests pass.

**RC2-11.4 — Physical gate.** Chromium automation is insufficient for Safari/Home Screen storage separation. RC-2 requires physical iOS proof for signup confirmation, recovery, password sign-in, install/open instructions, offline relaunch, and local removal scope.

**RC2-11.5 — Deployment gate.** A conforming implementation still requires the protected-main / required `playwright` / exact-green-main Pages governance path. This contract authorizes no PR, merge, Supabase mutation, user creation, or deployment.

## 12. Scope and non-scope

**RC2-12.1 — Later implementation scope.** RC-2 implementation includes public independent signup, signup/recovery UX, intro and minimal profile setup, first-success guidance, versioned onboarding preference, device-context messaging, sign-out disclosure/local removal, Program portability and migration, complete fresh-device recovery, and minimal presentation/Settings work explicitly required above.

**RC2-12.2 — Non-scope.** RC-2 excludes social login/OAuth, subscriptions/payments, managed-family self-service, social/activity feed, Auto programming, Trajectory, new Programming Engine intelligence, Strength Knowledge expansion, broad visual redesign, AI-generated plans, Program generation, and custom-exercise infrastructure.

**RC2-12.3 — No telemetry authorization.** Onboarding status is product state, not analytics consent. RC-2 authorizes no remote funnel, behavioral telemetry, email marketing, or profile enrichment.

## 13. Supabase design notes (informative)

The target uses email confirmation because current Supabase behavior returns no session before confirmation and reduces direct duplicate-email disclosure when confirmation is enabled. Exact behavior and client version MUST be rechecked during implementation against [Supabase `signUp` documentation](https://supabase.com/docs/reference/javascript/auth-signup) and [password-based Auth guidance](https://supabase.com/docs/guides/auth/passwords).

Supabase’s built-in mailer is restricted to pre-authorized team addresses, rate-limited, best-effort, and not intended for production public Auth. RC therefore requires the production mail gate in RC2-3.9; see [Supabase custom SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp) and [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Production confirmation and recovery destinations must be exact allowlisted URLs; see [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls). The current isolated reset sequence remains consistent with [Supabase password recovery guidance](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

Email-link prefetching can consume one-time links. Template and retry design MUST consider the safe-link mitigations in [Supabase email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates) without exposing tokens or adding a second unreviewed Auth authority.

## 14. Open implementation decisions

**RC2-14.1 — Auth rollout choices.** The product decisions are fixed, but the implementation interval must record the chosen transactional mail provider/hook, sending domain, confirmation template/link form, rate limits, and CAPTCHA or equivalent abuse control. None may weaken the generic duplicate/recovery response or exact redirect rule.

**RC2-14.2 — Program physical model resolved.** [Program portability synchronization v1](PROGRAM_PORTABILITY_SYNC_V1.md) selects one first-class Program-domain envelope row per profile, whole-envelope guarded transport, internal immutable/head/sequence component revisions, dependency-ordered consumers, and explicit legacy cutover. Hosted table details remain an implementation decision constrained by that contract.

**RC2-14.3 — No open product-flow question.** Signup fields, required email verification, post-confirm route, first-run questions, first-success path, presentation/companion defaults, sign-out semantics, recovery promise, backward compatibility, and RC scope are decided by this contract.

## Appendix A — Repository evidence map (informative)

| Concern | Current evidence |
| --- | --- |
| Auth UI/API and browser/PWA behavior | `account-onboarding.js`, `supabase-client.js`, `auth-setup.html`, `auth-setup.js`, `supabase/config.toml` |
| Atomic independent bootstrap and managed separation | `supabase/migrations/20260807202641_phase4g_independent_account.sql`, `supabase/migrations/20260808171421_phase4h_managed_profile_access.sql`, `PHASE4G_INDEPENDENT_USER_CONTRACT.md`, `PHASE4H_MANAGED_PROFILE_ACCESS_CONTRACT.md` |
| Profile defaults/presentation/SZW | `account-context.js`, `profiles.js`, `routine-engine.js` |
| First-workout path | `session-selector-v26.js`, `workout-session-controller.js`, `exercise-picker.js`, `app.js` |
| Current cloud source and recovery set | `cloud-shadow.js`, `cloud-sync.js`, `managed-profile-recovery.js`, `SYNC_SEMANTICS.md` |
| Program graph and active provenance | `program-model.js`, `program-origin.js`, `state-persistence.js`, `PROGRAM_FOUNDATION_V1.md`, `PROGRAMMING_ENGINE_V1.md` |
| Product nouns and navigation | `PRODUCT_IA_V1.md`, `RELEASE_CANDIDATE_PLAN.md` |

## Appendix B — Documentation-unit validation

This unit is complete only when the diff is Markdown-only, all `RC2-*` clause and acceptance IDs are unique, all touched local Markdown links and anchors resolve, `git diff --check` passes, and the pushed branch SHA is verified. It MUST stop after the documentation commit is pushed; runtime implementation remains a separate interval.
