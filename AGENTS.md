# Engineering rules

- Big Gains is a static, local-first PWA. Train and the installed shell must remain usable offline.
- Completed History is authoritative. Preserve performed facts, measurement semantics, and Program/Routine provenance; unavailable guidance stays unavailable.
- Preserve workout persistence, account/profile isolation, sync, backup, and recovery. Use existing ownership boundaries in [ARCHITECTURE.md](ARCHITECTURE.md); UI refinement does not justify schema, Auth, RLS, or protocol changes.
- `workout-session-controller.js` owns workout mutations and `timer-controller.js` owns rest lifecycle. Renderers delegate to them. Preserve `train-position.js`'s immediate restoration, dialog focus, editable measurements, and warmup/working-set separation.
- Prefer focused changes and existing appearance tokens over architectural rewrites or another broad CSS override layer. Respect light/dark themes, semantic status colors, and reduced motion.
- Start from freshly fetched `origin/main` on an isolated branch; preserve other agents' work and check dependencies before implementation.
- Use synthetic fixtures, never production user data. Run `npm run check:release` and focused tests first; correct attributable failures autonomously, then run the relevant suites in [TESTING.md](TESTING.md) and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Investigate unrelated failures enough to report attribution without broadening scope.
- Require independent review and protected CI on the final PR commit. Keep automated browser/WebKit evidence distinct from physical iPhone, installed-PWA, and VoiceOver acceptance.
- Follow verified release procedures: a merged SHA alone does not prove deployment. Verify the production marker and asset parity, allowing only the documented generated cloud-config substitution.
- Never merge to `main`, deploy, change hosted database state, or modify production records without explicit user authorization. An implementation/PR assignment alone does not authorize release.
