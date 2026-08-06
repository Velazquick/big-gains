# Phase 4 account roadmap

Phase 4A makes local ownership explicit without changing the product surface or moving data. The next work should proceed in this order:

1. Select an authentication provider based on privacy, platform support, account recovery, operational cost, and exportability.
2. Define private per-user cloud records and authorization rules. GitHub remains source control and optional snapshot backup, not the user database.
3. Specify local-first sync and conflict rules for workouts, routines, notes, preferences, active sessions, and deletions before implementing transport.
4. Design an explicit, reversible linking/migration flow for existing Jorge and Alexa local data, with previews and recovery paths.
5. Add friend onboarding only after identity, authorization, migration, and sync behavior are proven.

Unresolved product decision: Alexa may become a separate login or may initially remain a managed profile under Jorge's account. Phase 4A does not assume either answer; the account descriptor and profile configuration are separate so the later decision does not require a workout-schema fork.
