# Strength Goal History correctness — v116

Investigated main: 34e67923bcc1ff1c5bdaa504b9ca56fe2bec725b. Production: v115-operator-reliability-v2 / config-dfadb48839db90f2. Hosted migration head: 20260915235536 operator_reliability_v2. Production inspection was read-only. No training records were changed. Examples below are synthetic.

## Proven divergence

Attainment reads exact-exercise completed working sets and rounded Epley v1: round(load * (1 + reps / 30)). A 225 × 5 set gives 263, but does not establish five completed sets. Both progression and attainment see the same evidence.

The old Goal page projected progressionState.current without resolving History. Train classified every changed load as USER_OVERRIDE_REVIEW, retaining an obsolete lower target even after an equivalent full higher exposure. Issuing another target reset issuedAt. With no subsequent completed exposure, any old record could cause STALE_EVIDENCE even alongside recent History.

## Narrow contract amendment

The September 17 user correctness instruction supersedes G1-7.10/G1-10.6 only for a higher equivalent completed prescription. The latest recent exact exposure must have exactly the prescribed completed working-set count, uniform positive load above the prior target, and every set at or above its issued rep target. Hold that demonstrated load without an extra increment. Do not take maximum sets, skip a latest partial/mixed session, combine variants, or alter History/Routine/Program facts. Other deviations retain review behavior with concrete explanations.

The 42-day boundary, identity/unit/measurement gates, three-exposure summary, routine/policy intersection, e1RM formula, same-load successful transition, and miss behavior are unchanged. Goal creation and enablement dates do not exclude baseline History. Pre-issued higher equivalent performance can correct an obsolete cursor; ordinary success still requires completion after issuance.

The Goal page resolves live through the same read-only adapter as Train using an unambiguous saved routine structure. If structures disagree or are missing, it withholds the path. Selected Program/current-workout construction remains authoritative in Train. Rendering never issues or saves decisions. With recent History but no new completion after a recent issued target, AWAITING_EXPOSURE retains it without advancing the issuance timestamp. Truly expired evidence still fails closed.

## Validation and release

Synthetic engine cases cover empty History, same-load success, pre/post-goal higher History, repeated exposures, incomplete/missed/mixed sets, warmups, variants, unchanged e1RM context, Program source, and immutable inputs. Browser regressions cover identity, Goal/Train parity, read-only rendering, completion and reload, History/Records preservation, and guarded cloud fast-forward with mocked transport.

No schema/Auth/RLS changes. Register the release string in the existing telemetry allowlist with scripts/register-strength-release.sql before deployment; this is operational metadata only. The protected Browser tests job remains mandatory and includes the Goals engine suite. Pages deploys through the existing gate.
