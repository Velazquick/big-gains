# Big Gains custom-domain transition

Canonical production destination: **https://app.getbiggains.com/**. GitHub Pages remains the hosting backend, using the protected `playwright` → Pages workflow. Release `v104-custom-domain-app` changes URLs and release markers only; schema v5, RLS, account/bootstrap rules, signup confirmation, and Program portability v1 remain unchanged.

## Operator cutover and verification

1. Verify exact intended main, clean checkout, existing production smoke, and application-table counts/checksums.
2. Verify `getbiggains.com` ownership for GitHub account `Velazquick` using GitHub's exact account TXT challenge. Keep that TXT record.
3. In Namecheap BasicDNS, add CNAME `app` → `velazquick.github.io` (no repository suffix). Verify public DNS before setting Pages' custom domain. Preserve all `auth` records and root forwarding/parking.
4. Validate the generated deployment artifact at `/`, complete browser regression and legacy redirect tests, then merge the exact reviewed head through the protected PR process. Pages runs only after green main `playwright`.
5. Add exact hosted Auth redirects `https://app.getbiggains.com/` and `https://app.getbiggains.com/auth-setup.html`, retaining both legacy equivalents. Set Site URL to the new root only when HTTPS is ready. Keep confirmation required and anonymous signup off.
6. Set the repository's Pages custom domain to `app.getbiggains.com`; wait for valid certificate and enforce HTTPS. The workflow deployment source ignores a CNAME file, so repository URLs and this runbook are canonical; the Pages setting is the hosting control.
7. Verify exact final main/config markers, root assets, controlled reload/offline, auth email delivery/callbacks, fresh-origin recovery, isolation, and unchanged application data before announcing the URL.

## Legacy URL and installed apps

GitHub Pages may redirect network requests from `https://velazquick.github.io/big-gains/` to the custom domain. There is no application-authored forced redirect, storage clearing, or cross-origin transfer. An installed, fully cached legacy service worker can retain its original shell and local state using its existing fallback when redirected fetches cannot be used. The two-origin browser regression exercises a real HTTP 301, active-workout resume, offline reload, and storage separation. This does not promise indefinite legacy hosting or replace physical iOS proof.

Old Safari/Home Screen installations and the new domain are **distinct origins**. LocalStorage, IndexedDB, Auth sessions, caches, and unfinished local work do not automatically migrate. Keep the old installation until recovery is verified. Before moving, finish or safely retain unsynced work and use the existing technical backup/export if needed. Do not clear a pending queue. Local-only or unsynced state cannot be recovered from the cloud merely by changing URLs.

At the new origin, sign in to the existing account. Use the existing fresh-device recovery flow to restore cloud-backed training and preferences, and Program portability to adopt the published Program graph. Do not create another account/profile to recover existing data. Install the new PWA from the new domain after verifying recovery. An old cached app can still generate a legacy email redirect; those exact URLs remain allowed during the transition.

The transactional sender remains **Big Gains <no-reply@auth.getbiggains.com>** through Resend. `auth.getbiggains.com` is not an app host. The apex domain has no marketing-site work in this interval.

## Rollback

If HTTPS, callbacks, recovery, or installed-app safety fails, do not announce the new URL. Remove the Pages custom-domain setting to restore direct legacy hosting and revert canonical URL changes through another protected PR, retaining both origins in the Auth allow list during recovery. Keep account domain verification; remove a dangling app CNAME if the domain is no longer assigned. Never change schema, disable confirmation, clear user storage, or bypass `playwright` to complete a rollback.

## Evidence boundary

The protected `playwright` job also runs the focused mobile WebKit domain/Auth/recovery suite on Linux. Synthetic Auth/recovery routes disable workers only in WebKit so worker traffic cannot bypass HTTP mocks; real workers are exercised independently by the generated-root and legacy-transition tests. Chromium checks full browser offline mode. WebKit checks dropped server connections because its Windows offline toggle fails before worker dispatch even on the unchanged baseline. Neither emulation constitutes physical iOS proof.

The migration execution report records actual DNS/Pages/Auth state, final main/deployment, mail/callback evidence, test totals, application hashes, and unresolved gates. This runbook describes the intended configuration, not a substitute for live verification. Physical iOS Home Screen install/offline/auth/recovery proof must be recorded by a person with the device.
