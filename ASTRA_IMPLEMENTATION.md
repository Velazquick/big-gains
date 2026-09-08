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
