# Phase 4H managed-profile access contract

Phase 4H adds an explicit, administrative membership path from an authenticated user to one existing managed profile. It does not transfer account ownership, create a second Alexa profile, or make the cloud generally authoritative. The checked-in migration is infrastructure for later review and application; this build does not create Alexa's Auth user or production membership.

## Database model

`profile_memberships` stores `user_id`, `account_id`, `profile_id`, the fixed `managed-member` access kind, and timestamps. Its primary key is `(user_id, profile_id)`. The composite foreign key `(account_id, profile_id) -> profiles(account_id, id)` proves that a membership cannot name a profile from another account.

Two transaction-advisory-lock triggers keep owners and members disjoint even under concurrent writes: an account owner cannot receive a membership and a member cannot become the owner of an account. Membership identity and the profile's `account_id`, `id`, and `client_id` are immutable. None of these rules changes `accounts.owner_user_id`.

The browser role may select only its own membership. It has no membership insert, update, or delete privilege and there is no public join RPC. Provisioning therefore requires trusted administrative SQL or Dashboard access.

## RLS authorization

The security-definer predicates use only `auth.uid()` plus database relationships:

- `can_access_account(account_id)` is true for the account owner or a member with a membership in that account.
- `can_access_profile(account_id, profile_id)` is true for the account owner or an exact membership for that account/profile pair.

The account owner retains profile-scoped access to both managed profiles. A managed member can select the containing account only to resolve runtime metadata, and can select/update only the exact member profile. The member cannot insert or delete profiles, update the account, change ownership, or mutate memberships. All select/insert/update/delete policies on workouts, routines, bodyweight entries, preferences, active sessions, sync metadata, and tombstones require exact profile access. Anonymous grants remain revoked and forced RLS remains enabled.

`bootstrap_independent_account` takes a per-user transaction lock and rejects the caller when any managed membership exists. This prevents a managed member from racing membership onboarding against independent-account creation.

No policy contains an email address or a `client_id = 'alexa'` authorization shortcut. Alexa's managed client ID is validated only as an expected browser runtime shape after RLS has returned her authenticated membership.

## Browser runtime shapes

Account resolution has four explicit outcomes:

| Runtime | Profiles | Selector | Namespace |
| --- | ---: | --- | --- |
| `managed-owner` | existing Jorge + Alexa | shown | existing managed compatibility keys |
| `managed-member` | one verified existing managed profile | hidden | member Auth UUID + account UUID + profile UUID |
| `independent` | one independently owned profile | hidden | account UUID + profile UUID |
| `guest` | none | hidden | neutral guest key |

A managed-member resolution requires one membership, one matching account, one matching profile, a different account owner, the same Auth UUID throughout, and the expected managed presentation record. Both an owned account and a membership, multiple memberships, a mismatched account/profile pair, or an unexpected profile shape block before activation. A cached managed-member runtime cannot fall through to independent onboarding if its membership disappears.

## One-time empty-device recovery

Recovery is allowed only when all of these checks pass in the same flow:

1. The current Supabase session has the exact runtime Auth UUID.
2. A fresh account read returns the exact `managed-member` access kind, membership, account, profile, and presentation mapping.
3. The deterministic member namespace has no schema-v5 state and no queue, catalog, comparison, or recovery marker.
4. The durable outbound queue is empty.
5. A fresh read of every shadow table and tombstones succeeds.
6. Reconstruction finds no ownership issue, cross-profile row, malformed envelope, unsupported entity, duplicate singleton, or invalid deterministic entity ID.
7. The candidate passes the existing schema-v5 validator.
8. Re-serializing the candidate with the existing cloud-shadow canonical adapter produces exact semantic parity with the verified cloud winners.

Only then does recovery write the schema-v5 state, cloud catalog, parity comparison, and completion marker. The marker is written last. Application page lifecycle saves are suppressed during that adoption window. If any target key or meaningful local state already exists, recovery stops without overwrite or merge and shows an actionable review state; it never recommends clearing local storage.

This is not a recurring pull. After the completion marker, normal startup reads local schema v5. Offline use remains local-first and cloud failures cannot block logging.

## Reconstruction and baseline adoption

The recovery adapter covers completed workouts, custom routines, bodyweight entries, goals, timer preferences, exercise preferences, a valid active session and rest deadline, and tombstone winner semantics. Profile presentation comes from the verified profile row, so Alexa remains rose/wellness with her stored pet setting.

Personal records are intentionally not stored as a separate cloud entity; they are deterministically derived from the surviving completed-workout sets using the existing one-rep-max rule. Tombstoned entities are not fabricated into local arrays. Shell-only and derived calendar/progress values are also not cloud records. Recovery rejects any other cloud record instead of silently dropping it, so it cannot claim parity when a future schema-v5 field lacks a representation.

The adopted catalog copies the verified remote versions, timestamps, fingerprints, winner/tombstone state, and exact member Auth/account/profile mapping. It records `managed-member-fresh-recovery` when no migration journal is visible. The comparison is written as parity true and the queue is left absent/empty. Render-only workout focus and empty note preferences do not mutate state, so a reload does not create false outbound changes. The first real local edit increments from the adopted remote revision and uses the ordinary durable outbound path.

## Post-review production onboarding

After the migration is reviewed, deployed through the normal migration workflow, and RLS tests pass:

1. Confirm email signup and anonymous sign-in remain disabled in Supabase Auth settings.
2. Count and identify the existing managed account and existing Alexa profile; do not create or update either row.
3. In the Supabase Auth Dashboard, invite or create exactly the approved Alexa email. If it already exists, reuse that Auth user and inspect its state instead of creating another.
4. Record the visible Auth user UUID without exposing any secret or service-role key.
5. Through a trusted administrative operation, insert exactly one `managed-member` row for that Auth UUID and the existing Alexa `(account_id, profile_id)`. Let the composite foreign key and owner/member triggers reject any mismatch.
6. Recheck count-only that accounts, profiles, and all application-row counts are unchanged; only Auth plus one membership should be new.
7. On Alexa's genuinely fresh phone, open Big Gains, request the email link with `shouldCreateUser:false`, and open that link on the same device.
8. Confirm the brief restore state, the single rose/wellness Alexa runtime, no selector, zero pending queue, and semantic parity. Do not sign in as Jorge and do not clear or overwrite an initialized namespace.
