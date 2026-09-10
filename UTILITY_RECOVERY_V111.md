# Exercise metrics and unfinished-session recovery

Starting main: `639ab4bed71240d5e089ad3eaafd30dedb604de2` (v110).

The exact-exercise Progress dialog now has a compact movement-name button. Its searchable list uses the existing History-derived `loggedExercises()` and catalog search primitives, scoped to the currently loaded profile. Canonical variants remain separate. Today still opens its exact movement. Selecting a movement rerenders the same dialog; Escape closes the selector and returns keyboard focus. Empty History offers no catalog-only choices.

## Timestamp audit and conservative fallback

`workout-session-controller.js` persists `startedAt` when a session begins. Sets persist only their completion boolean, with no completion timestamp. Set edits and completion toggle do not persist a last-training-activity time. `state-persistence.js` normalizes these existing fields. The rest timer deadline can be adjusted and is not end-time authority. `train-position.js` stores presentation bookmarks, without a training timestamp. Completed History receives `completedAt` and elapsed duration only during explicit completion.

Consequently **no historical backdating is offered**, including for imported sets with incidental timestamp fields. No end timestamp or inactivity duration is guessed. The current data model cannot satisfy “Finish at last completed set” honestly.

## Detection and actions

- An unfinished session prompts after **six elapsed hours since start, or a local calendar day rollover**. Six hours is a conservative session-age check, not a claim of measured inactivity. Invalid/future starts do not prompt. Even a short session across midnight prompts calmly without interrupting training.
- The card is checked on normal render, the existing workout clock tick, foreground return, and page show. It does not steal focus or open a modal. Detection is entirely local and works offline.
- **Resume workout** reuses the existing controller and Train bookmark restoration. A memory-only acknowledgement quiets the card for six hours in the current page. Reloading may ask again; acknowledgement is never training activity or completion evidence.
- **Finish now** appears only with a completed set and calls the existing completion pathway. History keeps the existing full elapsed duration from start to explicit finish. Existing Records/workload derivation and Program advancement run normally, solely because the user chose Finish.
- **Discard workout** reuses the existing two-tap Cancel confirmation and discard semantics. Resume and Discard never advance Program.
- Pending sync, reconciliation, conflict, migration, managed-profile recovery, or Program recovery blocks Finish/Discard. Guards are rechecked inside the existing controller at action time, including ordinary Train controls after Resume. The card stays visible during unresolved recovery to explain disabled actions. Resume remains available inside the existing authorized shell. No queue, recovery, or synchronization mechanism changes.
- **No automatic completion, completed-History rewrite, new activity timestamps, schema, Auth, unit/math, or production-data changes.** Synthetic local fixtures are the only QA data.

`tests/utility-recovery.spec.js` covers boundaries, actions, Program effects, offline and blocked states, exact movement navigation, empty states, profile isolation, and 375/390 px layout. Existing v109/v110 position and full protected browser suites remain required. Physical iPhone/VoiceOver and installed-PWA acceptance still require the real device.
