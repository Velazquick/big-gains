# Operator v1 — baseline and data classification

Recorded before implementation, 2026-09-14.

## Audit scope

The initial audit verified a clean repository checkout, exact upstream revision,
production release/configuration, hosted migration ledger, schema and authority
functions, deployment gates and concurrent work. Detailed hosted operational
metadata is kept in the owner's private delivery evidence rather than this
public document. This document records the data classification and design
decisions made before implementation.

Account owners and managed-profile members are distinct identities. Membership
never grants account ownership. Existing product RLS remains the authority for
profile access; Operator requires its own server-side identity allowlist.

## A. Already derivable

Auth users provide registration and email confirmation timestamps. Accounts/profiles provide identity, creation, ownership and managed membership. These populations are different: a managed profile is not another signup, and an Auth user can have no provisioned profile.

Completed History rows provide workout counts and first/second/latest completion dates. Queries must exclude winning tombstones using the existing version, then timestamp, then tombstone-wins-ties ordering. Completion timestamps can be retrospective or imported; they do not prove when someone used the app or signed up. Time to first workout is only defined when that completion is on/after registration.

Active-session rows expose unfinished sessions after the same tombstone resolution. The accepted stale rule is six elapsed hours OR a different local calendar day, excluding invalid/future starts and completed sessions. The database does not know the device timezone. It can report sessions at least six hours old, explicitly labeled as such; exact local-day stale prompts require client observations.

Program envelopes can expose active Program presence and explicit empty state without returning their graph. Completed workout Program provenance can distinguish known Program completions. Missing legacy provenance does not establish Freeform use. Presentation settings exist but are unnecessary for v1 operations.

Sync metadata does not establish current device health. Recovery, pending queues, same-entity conflicts and Program recovery state are device-local. Never interpret an old sync marker as proof of a current problem or a clean bill of health.

## B. New telemetry required

Authenticated app opens/returns, observed running release, coarse platform/browser/display mode, error categories, actual recovery/conflict UI observations, Swap use and explicit Freeform/Program start observations. No historical backfill of these events. Coverage begins with deployment; offline/unavailable events may be absent. The existing analytics.js computes private training analytics locally; it is not a product telemetry service. No existing first-party product-event table or third-party analytics provider was found.

Signup attempts, invitation delivery and PWA installation will not be inferred. Registered/confirmed counts come from Auth. PWA display mode is observable; installation itself is not reliably observable.

## C. Intentionally not collected

No weights, repetitions, bodyweight, notes, exercise names, workout/set contents, arbitrary UI text, raw errors/stacks, URLs/query strings/fragments, passwords/tokens, email in events, replay, fingerprinting or advertising IDs. No private History browser or support impersonation.

## Implementation decisions

Use an explicit database-managed allowlist keyed to Auth UUID; never profile metadata or an email comparison. Guard every privileged query before reading aggregates. Keep operational tables private and revoke normal table access. Public RPC wrappers are invokers over narrowly scoped private guarded functions. Existing product RLS is unchanged.

Telemetry is best-effort and authenticated, with bounded enum fields, server time and server-derived account/Auth identity; validate the selected profile against existing ownership/membership. Drop unavailable/offline events, use no durable retry queue, impose client deduplication and server limits. Errors use fixed categories only, discarding all arbitrary messages and objects before transport.

Use a dedicated static `/operator/` entry point supported by Pages; it loads no consumer training runtime. The consumer does not wait for operator authorization or metrics. Operator failures expose no partial data.

Before hosted changes: prove additive migration and unchanged RLS against disposable PostgreSQL, inspect exact migration and grants, capture pre-change evidence, then use the normal migration API and verify the ledger/advisors. Real production training records must never be changed for QA.
