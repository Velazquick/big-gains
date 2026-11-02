# Transaction ownership and rollback safety

An adoption may replace or undo only the exact durable bytes it owns. Remote
Program identity, semantic parity, and document ownership are additional guards,
not substitutes for that comparison.

## Program adoption

`state-persistence.compareAndReplaceRawOwnedState(key, expected, replacement)` is
a synchronous port. It validates the local profile identity, checks exact current
bytes, performs the replacement through the existing write/remove ports, and
verifies durable readback. A comparison mismatch performs no write. There is no
read-await-write fallback.

`program-domain-recovery.adopt()` uses it both for the initial candidate and the
rollback. After asynchronous fingerprint verification it rechecks candidate
ownership. A newer normal save, including a History-only save with no Program
operation, causes rejection without replacement of the newer document. An
unchanged candidate can still roll back safely after verification or queue failure.

On unknown ownership or failed rollback, the result reports `rolledBack:false`
and `recoveryRequired:true`. The normal runtime retains transaction-specific
evidence through `retainRawOwnedStateRecovery()`, at the owned profile key plus
`-program-adoption-recovery-v1-<transactionId>`. It contains the before/candidate/
observed bytes and exact physical/semantic identity; it is local recovery data,
never telemetry, cloud output, or a schema-v5 field. Existing evidence is not
overwritten or automatically deleted. Storage refusal is reported separately
through `recoveryEvidenceRetained:false` and `evidenceError`; it never permits an
unsafe fallback rollback.

The cutover adapters propagate the new port and recovery outcome. `useCloud()`
rechecks the returned candidate and pending Program queue in its own continuation
before updating accepted Program state. Failure preserves the accepted base and
queued idempotency identities. A retained conflict needs explicit local recovery;
this change does not invent a merge or automatically adopt the newest data.

## Automatic adoption journal

`restoreAdoptionSnapshots()` preflights every profile, catalog, comparison and
queue, plus the exact retained journal. Every profile snapshot must match its
runtime descriptor. Current bytes must equal the transaction's candidate or its
already-restored before bytes. Any unknown document causes no restoration writes.

The adopter never writes the queue. Old version-1 intents used `candidate:null`
for that untouched key; recovery therefore requires the queue to equal its
recorded before bytes, and never writes it. New intents explicitly record those
same untouched bytes. The existing journal format remains readable.

Restoration proceeds synchronously with an ownership comparison per replacement,
stopping at the first failure. An interrupted rollback leaves the journal and a
known before/candidate mixture; reload can retry it without rewriting already
restored documents. Journal removal is conditional on the same owned intent and
verified final documents. Unknown/replaced intents are retained, not removed to
make startup appear successful. New adoption also refuses an existing intent.

The fast-forward result distinguishes completed rollback from retained recovery
instead of claiming that every failure restored all local writes.

## Integration and limits

Baseline: main `a61ddb8a44412dbe9b3714f68e47021269d493db`. Writer compatibility is
validated separately against PR #127
`74814b084119b8322a2f0d811e3253daa99be2f0`. The new profile port deliberately calls
the existing write/remove closures and `assertWriter()` when available, preserving
3A's occupied/retired writer, unreadable-state and expected-byte protections.
It neither obtains another document lock nor holds a network-duration lock.

Synchronous localStorage comparison is not an atomic transaction across separate
documents. Safe multi-document release depends on #127's account writer plus a
supported close/reopen procedure for older documents that do not honor it. This
branch is a dedicated correction from main, not a standalone release or a copy
of #127.

PR #128 `bf765593cfec8b2ac15119bb23d1a31401fbfa8d` is independent CI infrastructure.
When integrating, retain its Node runner and browser discovery exclusions;
`transaction-ownership.test.mjs` is discovered by that runner. Keep the focused
`test:transaction-ownership` command, without double-running it in the combined
`npm test` chain. Run all ownership and #127 integrity cases on the combined head.

Permanent tests assert persisted History, active sessions, exact queue bytes,
profile identity, retained intents, partial rollback/retry and owned rollback.
The former corrupt-durable-readback rollback expectation was replaced by two
stronger cases: transient reader mismatch with an unchanged owned candidate still
restores exact before bytes, while genuinely unknown persisted bytes are retained
with recovery evidence. No assertion now legitimizes overwriting unknown data.

F4 catalog-response revision regression, stale-session completion eligibility,
partial remote completion, Train design, and Training Companion are unchanged.
Do not remove recovery records or downgrade to the vulnerable code to clear a
blocker. No merge, deployment, hosted registration or migration is part of this PR.
