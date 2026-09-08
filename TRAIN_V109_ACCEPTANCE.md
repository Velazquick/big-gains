# v109 Train physical-acceptance correction

Baseline: production/main `498bf2910ac12ee4414421e592601d31968cb880`, release `v108-astra-training-first-config-dfadb48839db90f2`.

## Reproduction and limits

The user reported the failures on physical iPhone/PWA. This environment cannot independently perform native app switching on that device or write production training data for QA. Before application edits, instrumentation commit `6ca7594636e8c70ac6e20a4adf73b79c6df924f9` ran unchanged v108 application code with synthetic records, recording scroll calls, lifecycle events, bookmark contents and target geometry. This is a production-code lifecycle replay, not claimed native-device telemetry.

Baseline evidence is attached to Actions run `34220795637`, artifact `10053873895`, in the Playwright report's `foreground-trace` and `entry-trace` attachments. The dedicated Chromium/WebKit instrumentation run `34220795743` also executed both scenarios; its first artifact configuration omitted the HTML report, corrected for subsequent runs.

## Restoration root causes

1. Capture and persistence succeeded: `lat-pulldown` / `lat-working-1` survived with `eligible:true`. Foreground scheduled a request, but the production `big-gains-boot-concealed` listener cancelled it. The subsequent authorization did not request restoration because the cold-document check had already run. In the recorded replay there was no restore scroll; the input remained at y=910 on an 844px viewport.
2. The real identity boundary sets the app shell to `display:none`. That removes its scroll height during Auth re-verification. A pending request must survive this readiness transition without using unavailable identity or hidden geometry. Auth's behavior itself is unchanged.
3. Fresh entry had no initial bookmark, and the existing view and panel paths independently issued scroll-to-top and smooth `activePanel.scrollIntoView` calls. The baseline trace ended with the first set at y=-110 and an empty bookmark list. Those calls did not anchor an exercise/set and could finish after layout changed.

## Bounded correction

- Train entry and session rendering delegate their scroll to the stable-ID presentation owner. Explicit entry seeds the existing rendered/current exercise and first incomplete set only when no valid workout bookmark exists.
- A pending same-scope request survives concealment and waits for verified, interactive, visible layout. Context is revalidated before scrolling; changed account/profile/workout cannot inherit the old target. No authorization gate is bypassed.
- Concealment before, during or after an initial foreground restore is covered; the later shell-height collapse still gets its one useful restoration. Ordinary later renders do not repeat it. Navigation and user interaction cancel pending requests; completion continues to replace the bookmark through the existing callback.
- Header interaction preserves the last meaningful set in that exercise. Removed/reordered IDs retain the existing successor/predecessor resolution. No numeric scroll position is persisted, no training cursor is written, and no input is focused.
- The sticky heading's safe-area inset is included in the usable viewport calculation.

## Separate visual change

Inactive cards alone become compact, neutral rows: less padding, flatter corners, one quiet divider, smaller state text, no accent rail, and neutral selected-unit controls. Exercise title, state, working-set progress, last/best context, measurement qualifier and unit remain. Full-row expansion retains the existing handler and state semantics. The expanded active card, working controls, timers and completion behavior are not redesigned. The legacy 42px inactive expand target is corrected to 44px.

## Acceptance and release

The regression suite runs real rendered app entry and BootGate conceal/authorize transitions at 390x844 in Chromium and iPhone WebKit, with four inactive summaries surrounding one active card. Existing Train, units, removal, completion, profile isolation and PWA suites remain required, followed by the full protected corpus. Release/config references are updated only for normal safe PWA delivery; no Auth, Program, sync, analytics, navigation destination, Library, Today or startup feature changes are included.

After the protected deployment, repeat on the user's iPhone/PWA: new session to first set; existing session Resume to last edited set; app switch and lock/unlock return, including with a rest timer and numeric keyboard; deliberate navigation; completion advancement; deleted/reordered target fallback; mixed lb/kg controls; and inactive-card scanning. Record device/iOS and release. Do not clear device storage or mutate real production records merely for automated QA. Native-device acceptance is not inferred from CI.
