# Appearance v1

Settings → Appearance → Accent color offers **Volt, Cobalt, Merlot, Rose, Violet, and Ember**. Native radios provide named choices, arrow-key navigation, checked state, visible checkmarks, focus rings, and 54px minimum targets. Selection saves locally and previews immediately; there is no Save button. Appearance changes no training behavior, profile access, theme, or companion setting. Performance/Soft styles remain parked.

## Versioned profile contract

`public.profiles.accent` and `accent_version` are the sole cloud authority. Version 0 preserves all legacy rendering: the old `ember` token means lime Volt, Rose preserves Alexa's existing surfaces, Cobalt remains the generic independent default, and SZW retains the existing deep Merlot override. Existing rows keep their accent and receive version 0 through an additive column default; there is no accent backfill. Version 1 is an explicit choice with exactly `volt | cobalt | merlot | rose | violet | ember`.

The schema-v5 workout document and its preference shadow are unchanged. `profile-appearance.js` caches the accepted row representation and a durable pending operation under an Auth/account/profile-scoped key. This is an offline cache and outbox, not another cloud preference authority. No pending operation is created merely to materialize a default. Local-only choices remain device-local until made within a verified cloud runtime.

Writes verify session, user, current ownership/membership, and exact account/profile/client mapping. The PATCH modifies only accent/version and filters by the accepted accent/version pair. Its returned row must match exactly. A stale write cannot overwrite a new remote choice. A pending offline conflict exposes Keep this color / Use synced color; newer clicks during an in-flight write remain queued. Network failures retain the operation through reload. Refresh occurs on Settings entry, focus, visibility, reconnection, and a visible-page 30-second check. Sign-out or changed ownership blocks writes.

Independent/member runtime identity matching no longer treats accent as a reason to re-bootstrap while Appearance owns accent updates. Theme and pet comparisons remain intact. Managed-owner accent reads use the same verified profile row as other runtimes. Fresh-device accent recovery is independent of workout recovery and never writes workout data.

## Curated tokens

| Accent | Dark primary | Dark emphasis | Dark ink/chart | On primary | Light primary | Light ink | Light on primary |
|---|---|---|---|---|---|---|---|
| Volt | #d8ff3e | #e7ff8c | #d8ff3e | #111111 | #d8ff3e | #4d6100 | #111111 |
| Cobalt | #62a8ff | #a0ccff | #62a8ff | #111111 | #175fbd | #175fbd | #ffffff |
| Merlot | #801616 | #c65575 | #e58ba4 | #ffffff | #801616 | #9d264c | #ffffff |
| Rose | #c85f98 | #f4badb | #f09bc8 | #111111 | #a9477e | #a9477e | #ffffff |
| Violet | #a78bfa | #d2c2ff | #bba6ff | #111111 | #6d36c4 | #6d36c4 | #ffffff |
| Ember | #ff783e | #ffba8e | #ff986a | #111111 | #a83d12 | #a83d12 | #ffffff |

Ink RGB produces subtle background at 10%, border at 50%, soft border at 30%, glow at 13%, wash at 18%, and strong wash at 22%. `--accent` is readable ink, `--accent-primary` is filled controls, `--accent-bright` is emphasis, `--on-accent` is control text, and `--accent-chart` is the highlight derivative. Light emphasis equals light primary. Existing per-surface tint opacities remain where already deliberately designed.

Literal decorative RGBA colors retain their original fallback unless version 1 supplies `--accent-rgb`. The opt-in CSS layer separates text from filled-control contrast. Existing dark/light surfaces, companion artwork, functional danger/warning/sync colors, and data-family encodings remain independent. SZW's identity-specific accent becomes a legacy default rather than an override on explicit selection. The existing focused Train layout now uses a presentation attribute instead of the `ember` accent selector, so color cannot change its layout.

## Validation and release

`appearance-v1.spec.js` covers defaults, invalid input, immediate selection, reload/offline, managed isolation, keyboard/checked state, local persistence failure, all six palettes on dark/light mobile surfaces, CTA/ink contrast, and navigation/active Train. `appearance-sync.spec.js` uses synthetic HTTP fixtures for actual guarded profile updates, fresh-context recovery, retry, conflicts, rapid selection, wrong-profile rejection, and independent namespaces. Existing profile/recovery/browser regressions remain required.

The protected `playwright` job rehearses the real additive migration against disposable PostgreSQL rows and checks preservation, valid/invalid values, stale-write prevention, and isolation. Hosted deployment must apply this migration before the new frontend; old app versions continue accepting version-0 rows. Old cached app versions cannot fully render newly chosen version-1 colors until their app shell updates. No production user's color is changed by automated validation.

The entire app-shell revision is `v105-appearance-v1`; new assets are required and precached. Pages remains downstream of green protected CI. Release evidence and exact test totals belong in the execution report.

The authorized migration was applied as `20260903024032_appearance_v1_accent_contract`. Read-only checksums and counts across 11 application tables matched before/after (excluding only the new column); all four existing profiles remain version 0. The repository migration timestamp matches hosted history. Program's fixed dark dialogs use an additional dark-ink derivative, so accent text stays readable even when the surrounding profile uses light surfaces; semantic Program warning/error colors remain separate.
