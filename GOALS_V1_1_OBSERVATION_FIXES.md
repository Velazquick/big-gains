# Goals v1.1 observation fixes

Goals v1.1 is a contained explainability and compatibility layer over the released Goals v1 policy. It does not introduce long-horizon strength planning, transfer ratios, personalized e1RM, RIR/RPE, periodization, or a new storage or cloud schema.

## Exact evidence identity

Train evidence resolves each historical row through the existing trusted EKF identity boundary. Supported opaque canonical IDs, legacy IDs, and retrospective `definitionId` values may resolve to the same exact canonical exercise. A name or alias is considered only when the row has no persisted identity field, and only through the catalog's unambiguous resolver. An unsupported persisted identity does not fall back to a matching display name.

Related pressing exercises may be identified as supporting UI context from existing EKF metadata, but they never satisfy exact-exercise evidence. No load transfer ratio is inferred. Missing, stale, structurally ineligible, and related-only histories receive distinct diagnostic copy.

## Past-goal deletion

Completed and archived goals expose a confirmed permanent-delete action. Deletion removes only the selected profile-bound goal from the existing schema-v5 `goals.strengthGoals` collection and therefore from the existing `preferences/goals` serialization. Workouts, completed history, routines, active sessions, exercise definitions, account/profile data, and other profiles are not edited.

## Trajectory and deadline outlook

The Goals hub can project two or three conditional successful transitions from the current issued recommendation. The pure projection helper uses the same successful double-progression transition as the next-exposure resolver: build reps within the authoritative range, then advance one valid load increment and reset to the lower rep bound. The projection has no calendar dates and changes when actual performance differs.

Deadline outlook is explanation only. `No deadline` is used without a target date. `Unclear` is used when exact current strength context, a valid load step, or safely inferred saved-routine frequency is unavailable. With those inputs, `On pace` or `Aggressive` compares the minimum successful conditional exposures implied by the deterministic cycle with the scheduled exposures available before the date. This is transparent schedule math, not a physiological probability.

Neither trajectory nor deadline outlook can change today's recommendation, load, reps, set count, routine, or active-session snapshot.
