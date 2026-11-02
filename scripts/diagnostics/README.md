# Bounded browser failure diagnostics

These synthetic experiments investigate PR #130's historical browser failures.
They contain no Big Gains application, account, training data or deployment step.
They do not replace protected tests, change retries, or qualify a release.

The additive branch/path-filtered workflow freezes Node 22 and compares exact
Playwright 1.62.1 with supported 1.64.1 in separate native runners. It retains
toolchain lockfiles, browser revisions, source SHA, native launch logs, process
snapshots and every cell's result. A reproduced mechanism remains a failed job.

## WebKit: first registration versus document destruction

Ten paired cells use a fresh context and loopback origin. The interrupted arm
holds the first imported core response, performs native location.reload(), then
releases that response after the replacement document's DOMContentLoaded. The
control releases the response and observes registration resolution before the
same reload. Both require native ready and control within the same 8-second
diagnostic bound; this is not a change to application/test deadlines. The
synthetic sources are hashed. Cleanup is attempted independently and errors are
retained; incomplete execution fails.

Prediction: an interrupted arm stuck installing with ready=false, while the
control activates, demonstrates a native first-registration/navigation lifecycle
mechanism without the app. It does not prove the precise internal interleaving
of historical failures, whose imported HTTP responses finished just before
navigation. An active/ready worker lacking control is a separate signature.
Current WebKit must eliminate the original mechanism before an upgrade is
considered a correction; passing reruns alone cannot establish that.

## Chromium: context destruction and successor creation

Sixteen cycles without a worker and sixteen with a minimal real worker create
two isolated contexts, close them, then create an isolated mobile successor.
Every native operation has a finite diagnostic bound. Stop on the first
mechanism or cleanup failure, preserve primary and cleanup errors, and never
retry a failed cell. DEBUG=pw:browser records the actual launched binary;
defaultExecutablePath is only Playwright's full-browser default path.

Prediction: the historical native SIGSEGV without application code establishes
a browser/toolchain defect independently reachable from the app. All-pass cells
leave application/history/native scheduling interactions unresolved. Three
historical failures share signal/address/leading frames; only two share the
entire stack. The third occurs early with a different predecessor, so neither
the specific Auth test nor long suite lifetime is a necessary trigger.

Run from a package with pinned Playwright, or set BG_REPRO_PACKAGE to its
absolute package.json. BG_REPRO_OUTPUT selects a disposable JSON artifact.
Changing fixture history, recycling browsers to hide failures, or suppressing
these nonzero results is not an accepted infrastructure remedy.
