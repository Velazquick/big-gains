# Astra Training First implementation

## Starting evidence / Slice 0

- Clean detached checkout of canonical `origin/main`: `7f5cababa04e06e010406dc0ff8037cbe006b269`.
- Production: `https://app.getbiggains.com/`, release `v107-active-exercise-units`, deployment `v107-active-exercise-units-config-dfadb48839db90f2`.
- Starting protected push workflow: https://github.com/Velazquick/big-gains/actions/runs/34085425296 (success).
- A normal reload of the existing securely authenticated review session successfully opened the signed-in UI. The earlier `JWT issued at future` error did not recur. Its original clock/provider cause is unproven; no token inspection, clock change, credential change, auth bypass or hosted change was used.
- Read-only production navigation inspected Today, Plan, Train preview, Progress, History List, Library, exercise picker and Settings/Appearance. All six accents are present. No exercise was selected and no routine or Program was loaded/adopted.
- This browser has no active workout or locally adopted Program; Plan exposes an available cloud Program for explicit adoption. Preserve that action and its status. Do not present the absence of a local Program as proof that no cloud Program exists.
- Production routine labels, eligibility and measurement metadata vary by profile. Mockup names/counts are illustrative, not an alternative prescription. Preserve the current catalog, eligibility and owner-specific callbacks.
- The supported review-browser surface has no viewport-resize or native iPhone lifecycle capability. Actual authenticated 375/390 px and installed-PWA background/foreground proof remain open. Do not fabricate a live session merely to obtain them.

## Reset-path characterization

`v2-shell.showView` defaults to `scrollTo(top:0)`. Explicit Return enters that path. `renderActiveSession(true)` and the delayed session-selector Resume path scroll the active panel to its start. Ordinary visibility handlers reconcile state/rendering but provide no stable exercise/set viewport anchor. These are identified paths, not proof of the exact reported iPhone OS transition. Synthetic browser evidence records scroll requests, retained-page foreground and document reload separately.

## Execution judgment and gates

Current source, successful signed-in read-only inspection and the reported physical issue support isolated presentation and ID-bookmark work without production mutation. Slice 0 is reconciled for that work with the above limits; it is not a claim that physical/mobile validation is closed. Physical iPhone proof of keyboard, foreground return, OS recreation and PWA lifecycle remains a merge gate. Preserve frozen controllers, data contracts and protected CI; do not merge on automation alone when that physical proof is outstanding.

## Slice 1 — visual foundation (under validation)

Shared spacing/surface/control/status roles now sit in `astra-ui.css`, loaded after existing feature styles. Inactive/completed exercises and sets retain full opacity and saturation; hierarchy uses surfaces, a focus border and labeled semantic state. Numeric text is at least 16 px, with meaningful controls at least 44 px. The focused Train presentation applies independent of profile identity; profile capabilities, routine selection and Appearance state remain unchanged. Existing dark/light and all-six-accent tests remain in the protected corpus.

The legacy browser assertion requiring Alexa/independent users to lack the Train preview is intentionally updated: approved shared ergonomics now show the preview for every profile. It still checks each profile's accent/theme and independent pet capability. No domain assertion is removed. All 383 Node tests pass at the foundation tree. Local Chromium 151.0.7922.34 downloaded from Google's official distribution but could not launch because this runtime denies its socket; browser gates run in CI.

Focused CI run 34184615358 passed 47/49 browser checks and caught legacy state-selector specificity retaining 0.62 inactive opacity at both widths. The shared base rule now matches the existing state attribute so its later semantic surface/opacity roles win. The original full-opacity assertions remain unchanged.

## Slice 2 — ID return position (under validation)

The bookmark module reads only after existing identity/runtime authorization. It uses a separate account/profile namespace key plus workout/exercise/set IDs and captured neighbor order. Foreground restoration is once-only, skips surviving dialogs, checks the visual viewport/sticky header/timer, and never calls input.focus or a domain focus/toggle command. A deliberately collapsed target restores its header; it does not override a user's collapse choice. Intentional navigation invalidates pending automatic restoration; explicit Resume may request the anchor. Existing completion advancement updates the bookmark after the domain controller chooses its next exercise. Clear on completion/discard and reject a different workout or owner. Storage failure affects position only.

The synthetic retained-page check at 375/390 preserved the field's viewport position and issued no recorded scroll calls. Reload changed its position; neither result proves the physical iPhone foreground report. Physical foreground, OS recreation and keyboard evidence remains required.

## Slice 3 — workout interaction layer (under validation)

The trailing Warmup + is independently named for its exercise, restricted to existing supported load/reps and assistance/reps models, and adds a fresh stable ID with warmup:true. It copies the most recent warmup's canonical entered values, otherwise blank fields; it never queries History or calculates a prescription. Working-set addition is separately labeled. Existing controller validation, deliberate removal and timer callbacks remain authoritative.

Rows retain direct numeric inputs, completion and removal; a 44 px ± disclosure exposes adjustment buttons. The disclosure is keyed by workout/exercise/set IDs. Reorder/remove-exercise and exercise Progress move under Exercise options. Opening a completed exercise collapses the other presentation cards without selecting a new domain focus. Inactive cards retain full contrast and visible exercise unit controls with a quieter selected treatment. Existing browser tests use the new disclosures while preserving their data assertions.

The first workout-focused run passed 89/91 checks. It caught missing per-field unit labels (restored in the next commit) and an omitted indicated-workload summary. The existing formatted workload summary is retained with its unit/measurement qualification; no analytics math or assertions were weakened.

## Slice 4 — direct picker and inventory (under validation)

Train's existing Add Exercise action now opens the existing picker over Train. It captures the originating owner/workout, preserves canonical eligibility/exclusions and returns to that workout's bookmark after selection/cancel. An old picker cannot add into a replacement workout. The picker continues to own its dialog/Back/focus lifecycle; routine editing retains its separate draft callbacks.

Library search/filters and flat inventory rows are immediately visible. Sticky Exercises/Saved routines jump actions keep routine browsing direct without inventing another mutation owner. Saved routine load/replace and edit actions remain unchanged. Shared row markup keeps muscle, equipment and measurement context; theme/accent tokens replace picker-specific palette literals. The protected picker tests retain all canonical identity and eligibility assertions.

### Slice 5 — approved IA and contextual Today

More owns Library and Settings, including direct navigation to existing backup/export and Support sections. Existing Library/Settings/History/Calendar aliases remain supported. Train navigation never starts a session. History has a prominent Progress entry using the existing List/Calendar controller.

Today reads the current Program context and routine catalog through small read-only presentation facades. Priority is active Resume, authoritative next Program, valid selected routine, then blank workout. The primary card is moved first in DOM as well as visually; secondary actions remain available. The existing explicit cloud Program adoption path is untouched. Today omits the Program version suffix; Program detail retains it. Shared shells no longer rename Library to Garden or alter training copy based on profile identity; the existing garden and profile capabilities remain available.

Slice 4 focused validation: 127/128 passed initially; the remaining assertion expected the obsolete Library navigation from Train. It now asserts direct picker visibility, unchanged Train route, and the same workout ID. No data assertion was relaxed. The prior full return-position run passed 584/585, with the sole failure being the harness script-order fixture; the new module is now included in that exact-order fixture.

### Slice 6 — cold startup presentation

The existing boot shell now uses resolved Appearance tokens and a restrained instrument treatment. The asset loader selects one of three non-telemetry brand lines per cold document, excluding the last local choice when storage is available. There is no delay, network request, new readiness signal, or PWA lifecycle owner. Real status/retry copy remains authoritative. Decorative copy retires permanently on interactive or recovery state; retained-document foreground does not recreate it. Generic message memory contains no account or training data and never participates in export/sync.

### Required physical evidence before merge

Automation cannot establish the original physical iPhone reset path or VoiceOver/keyboard ergonomics. On the exact reviewed candidate, use a non-production QA profile/session on an actual iPhone (375–390 pt): edit a late set, background through another app and lock/unlock, return while rest is running and after expiry; verify useful position once, no keyboard reopening, no duplicate completion/timer events, and no repeat startup. Repeat after deliberate navigation, exercise deletion/reorder, and mixed lb/kg edits. Confirm 44 pt targets and repeated numeric entry/adjustment reachability with the software keyboard. Confirm cold installed-PWA startup and safe waiting update behavior. Record device/iOS, candidate SHA, steps, and results. This remains a merge/deployment gate specified by the user, not an optional follow-up.

Candidate release marker: `v108-astra-training-first`. The checked-in cloud configuration stamp remains unchanged; deployment must continue generating its existing protected configuration-specific stamp. No hosted configuration change is requested.

Final local pure Node corpus: 393 passed, zero failures. Additional focused CI and protected browser results are recorded on PR #108; earlier slice totals are not substitutes for green checks on the exact final head. The supplementary macOS WebKit job adds active interaction coverage without changing the protected workflow.

Final rendered review found two visual-only legacy interactions: the pre-v1 Appearance path does not provide filled-action tokens, and the Library action group wrapped two controls despite the row layout. New `--ui-action-*` roles use the existing Appearance resolver/palette without changing preference versions or writes; the Library group now stays inline. Today Goals is quieter and the selected session title is more prominent. The next 394-test local Node run is green; a new viewport-boundary test and browser completion-advancement test cover the highest-risk bookmark precedence.

Independent-user reconciliation: the existing RoutineEngine supplies default library routines even for a newly provisioned independent account. Availability is not a deliberate routine selection. Today now distinguishes an explicit session choice or saved custom routine from that catalog fallback; the new independent-user default is blank workout, while all existing routines and their start behavior remain available. This is presentation priority only. Managed profiles retain their existing selected-plan default. A focused test covers the transition from blank priority to a deliberately selected routine without starting a session.

WebKit validation limitation: waiting for page control did not resolve driver-level `context.setOffline()` internal navigation errors in two newly added WebKit executions of existing Chromium tests. All 39 other WebKit cases passed, including startup readiness/recovery after capture synchronization. These same two tests now use a real per-test server transport outage on WebKit, matching the protected PWA corpus's existing strategy; Chromium still uses driver offline mode. No retries, cache warming, skipped cases, relaxed data assertions, or app lifecycle changes were introduced. This models network loss, not physical iPhone airplane-mode behavior; device evidence remains required.

Full-corpus structural fixture reconciliation: measurement qualifiers are asserted in the exercise header and accessible input labels; Library inventory is immediately visible; the session API includes the warmup-only method. The Goal edit/reload case now selects Working Sets explicitly and follows the edited stable set ID. Its previous `:not(:first-child)` selector selected the second working set after section separation, explaining the observed 190-versus-185 mismatch without a progression-engine change.
