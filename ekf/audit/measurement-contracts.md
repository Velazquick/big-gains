# EKF Measurement Contract Audit

Generated deterministically from the curated EKF sources for release `ekf-3-curated-catalog-v1`. Stored workout values remain entered facts; this table describes runtime interpretation only (EKF-4.2, EKF-4.3, EKF-4.13).

- Exercises: **155**
- Explicit contracts: **155**
- Unknown/unresolved contracts: **0**

| Legacy ID | Exercise | Tracking | Load basis | Resistance | Reps | Laterality | Card inputs | e1RM | Muscle roles |
|---|---|---|---|---|---|---|---|---|---|
| `seated-machine-chest-press` | Seated Machine Chest Press | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Chest (primary) |
| `seated-iso-lateral-bench-press` | Seated Iso-Lateral Bench Press | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Weight per side + Reps | no | Chest (primary) |
| `incline-iso-machine-press` | Incline Iso Machine Press | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Weight per side + Reps | no | Chest (primary) |
| `smith-machine-incline-press` | Smith Machine Incline Press | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Total weight + Reps | no | Chest (primary) |
| `flat-smith-machine-bench-press` | Flat Smith Machine Bench Press | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Total weight + Reps | no | Chest (primary) |
| `barbell-bench-press` | Barbell Bench Press | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Chest (primary) |
| `decline-barbell-bench-press` | Decline Barbell Bench Press | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Chest (primary) |
| `dumbbell-bench-press` | Dumbbell Bench Press | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Chest (primary) |
| `incline-dumbbell-press` | Incline Dumbbell Press | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Chest (primary) |
| `decline-dumbbell-press` | Decline Dumbbell Press | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Chest (primary) |
| `cable-chest-fly` | Cable Chest Fly | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Stack weight per side + Reps | no | Chest (primary) |
| `incline-cable-fly` | Incline Cable Fly | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Stack weight per side + Reps | no | Chest (primary) |
| `seated-pec-deck` | Seated Pec Deck | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Chest (primary) |
| `push-up` | Push-Up | `reps_only` | `not_applicable` | `bodyweight_only` | `bilateral_cycle` | `bilateral` | Reps | no | Chest (primary) |
| `dips` | Dips | `load_reps` | `total` | `bodyweight_plus_external` | `bilateral_cycle` | `bilateral` | Added weight + Reps | yes (`effective_system_load`) | Chest (primary), Triceps (secondary) |
| `assisted-dip` | Assisted Dip | `assistance_reps` | `total` | `assistance` | `bilateral_cycle` | `bilateral` | Assistance + Reps | no | Chest (primary), Triceps (secondary) |
| `iso-machine-shoulder-press` | Iso Machine Shoulder Press | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Weight per side + Reps | no | Shoulders (primary) |
| `dumbbell-shoulder-press` | Dumbbell Shoulder Press | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Shoulders (primary) |
| `barbell-overhead-press` | Barbell Overhead Press | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Shoulders (primary) |
| `machine-shoulder-press` | Machine Shoulder Press | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Shoulders (primary) |
| `arnold-press` | Arnold Press | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Shoulders (primary) |
| `landmine-press` | Landmine Press | `load_reps` | `total` | `external` | `reps_per_side` | `unilateral` | Total weight + Reps per side | no | Shoulders (primary) |
| `dumbbell-lateral-raise` | Dumbbell Lateral Raise | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Shoulders (primary) |
| `cable-lateral-raise` | Cable Lateral Raise | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Stack weight + Reps per side | no | Shoulders (primary) |
| `reverse-pec-deck` | Reverse Pec Deck | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Rear Delts (primary) |
| `rear-delt-cable-fly` | Rear Delt Cable Fly | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Stack weight per side + Reps | no | Rear Delts (primary) |
| `face-pull` | Face Pull | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Rear Delts (primary) |
| `overhead-triceps-extension` | Overhead Triceps Extension | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Triceps (primary) |
| `triceps-pushdown` | Triceps Pushdown | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Triceps (primary) |
| `rope-pushdown` | Rope Pushdown | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Triceps (primary) |
| `skull-crusher` | Skull Crusher | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Triceps (primary) |
| `close-grip-bench-press` | Close-Grip Bench Press | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Triceps (primary) |
| `single-arm-cable-extension` | Single-Arm Cable Extension | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Stack weight + Reps per side | no | Triceps (primary) |
| `cable-triceps-kickback` | Cable Triceps Kickback | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Stack weight + Reps per side | no | Triceps (primary) |
| `dumbbell-triceps-kickback` | Dumbbell Triceps Kickback | `load_reps` | `per_hand` | `external` | `reps_per_side` | `unilateral` | Weight per dumbbell + Reps per side | yes (`entered_load`) | Triceps (primary) |
| `lat-pulldown` | Lat Pulldown | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Back (primary) |
| `wide-grip-lat-pulldown` | Wide-Grip Lat Pulldown | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Back (primary) |
| `neutral-grip-lat-pulldown` | Neutral-Grip Lat Pulldown | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Back (primary) |
| `iso-lateral-pulldown-machine` | Iso-Lateral Pulldown Machine | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Weight per side + Reps | no | Back (primary) |
| `assisted-pull-up` | Assisted Pull-Up | `assistance_reps` | `total` | `assistance` | `bilateral_cycle` | `bilateral` | Assistance + Reps | no | Back (primary) |
| `pull-up` | Pull-Up | `load_reps` | `total` | `bodyweight_plus_external` | `bilateral_cycle` | `bilateral` | Added weight + Reps | yes (`effective_system_load`) | Back (primary) |
| `seated-cable-row` | Seated Cable Row | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Back (primary) |
| `close-grip-seated-cable-row` | Close-Grip Seated Cable Row | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Back (primary) |
| `one-arm-cable-row` | One-Arm Cable Row | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Stack weight + Reps per side | no | Back (primary) |
| `chest-supported-row` | Chest-Supported Row | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Back (primary) |
| `t-bar-row` | T-Bar Row | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Back (primary) |
| `chest-supported-t-bar-row` | Chest-Supported T-Bar Row | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Back (primary) |
| `barbell-row` | Barbell Row | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Back (primary) |
| `meadows-row` | Meadows Row | `load_reps` | `total` | `external` | `reps_per_side` | `unilateral` | Total weight + Reps per side | no | Back (primary) |
| `one-arm-dumbbell-row` | One-Arm Dumbbell Row | `load_reps` | `per_hand` | `external` | `reps_per_side` | `unilateral` | Weight per dumbbell + Reps per side | yes (`entered_load`) | Back (primary) |
| `iso-lateral-row` | Iso-Lateral Row | `load_reps` | `per_side` | `machine_indicated` | `reps_per_side` | `unilateral` | Weight per side + Reps per side | no | Back (primary) |
| `straight-arm-pulldown` | Straight-Arm Pulldown | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Back (primary) |
| `machine-pullover` | Machine Pullover | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Back (primary) |
| `rack-pull` | Rack Pull | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Back (primary) |
| `dumbbell-shrug` | Dumbbell Shrug | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Traps (primary) |
| `barbell-shrug` | Barbell Shrug | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Traps (primary) |
| `dumbbell-curl` | Dumbbell Curl | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Biceps (primary) |
| `hammer-curl` | Hammer Curl | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Biceps (primary) |
| `rope-hammer-curl` | Rope Hammer Curl | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Biceps (primary) |
| `incline-dumbbell-curl` | Incline Dumbbell Curl | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Biceps (primary) |
| `preacher-curl` | Preacher Curl | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Biceps (primary) |
| `machine-preacher-curl` | Machine Preacher Curl | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Biceps (primary) |
| `spider-curl` | Spider Curl | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Biceps (primary) |
| `concentration-curl` | Concentration Curl | `load_reps` | `per_hand` | `external` | `reps_per_side` | `unilateral` | Weight per dumbbell + Reps per side | yes (`entered_load`) | Biceps (primary) |
| `reverse-curl` | Reverse Curl | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Biceps (primary) |
| `cable-curl` | Cable Curl | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Biceps (primary) |
| `bayesian-cable-curl` | Bayesian Cable Curl | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Stack weight + Reps per side | no | Biceps (primary) |
| `ez-bar-curl` | EZ-Bar Curl | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Biceps (primary) |
| `back-squat` | Back Squat | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Quads (primary), Glutes (secondary) |
| `front-squat` | Front Squat | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Quads (primary) |
| `hack-squat` | Hack Squat | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Quads (primary), Glutes (secondary) |
| `belt-squat` | Belt Squat | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Quads (primary), Glutes (secondary) |
| `pendulum-squat` | Pendulum Squat | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Quads (primary), Glutes (secondary) |
| `v-squat-machine` | V-Squat Machine | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Quads (primary), Glutes (secondary) |
| `leg-press` | Leg Press | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Quads (primary), Glutes (secondary) |
| `single-leg-press` | Single-Leg Press | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Machine weight + Reps per side | no | Quads (primary), Glutes (secondary) |
| `smith-machine-squat` | Smith Machine Squat | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Total weight + Reps | no | Quads (primary), Glutes (secondary) |
| `goblet-squat` | Goblet Squat | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Quads (primary), Glutes (secondary) |
| `bulgarian-split-squat` | Bulgarian Split Squat | `load_reps` | `per_hand` | `external` | `reps_per_side` | `unilateral` | Weight per dumbbell + Reps per side | no | Quads (primary), Glutes (secondary) |
| `walking-lunge` | Walking Lunge | `load_reps` | `per_hand` | `external` | `alternating_total` | `alternating` | Weight per dumbbell + Alternating reps total | no | Quads (primary), Glutes (secondary) |
| `reverse-lunge` | Reverse Lunge | `load_reps` | `per_hand` | `external` | `reps_per_side` | `unilateral` | Weight per dumbbell + Reps per side | no | Quads (primary), Glutes (secondary) |
| `step-up` | Step-Up | `load_reps` | `per_hand` | `external` | `reps_per_side` | `unilateral` | Weight per dumbbell + Reps per side | no | Quads (primary), Glutes (secondary) |
| `leg-extension` | Leg Extension | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Quads (primary) |
| `romanian-deadlift` | Romanian Deadlift | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Hamstrings (primary), Glutes (secondary) |
| `dumbbell-romanian-deadlift` | Dumbbell Romanian Deadlift | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Hamstrings (primary), Glutes (secondary) |
| `seated-leg-curl` | Seated Leg Curl | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Hamstrings (primary) |
| `lying-leg-curl` | Lying Leg Curl | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Hamstrings (primary) |
| `nordic-hamstring-curl` | Nordic Hamstring Curl | `reps_only` | `not_applicable` | `bodyweight_only` | `bilateral_cycle` | `bilateral` | Reps | no | Hamstrings (primary) |
| `45-degree-back-extension` | 45-Degree Back Extension | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Added weight + Reps | no | Hamstrings (primary), Glutes (secondary) |
| `hip-thrust` | Hip Thrust | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Glutes (primary) |
| `glute-bridge` | Glute Bridge | `reps_only` | `not_applicable` | `bodyweight_only` | `bilateral_cycle` | `bilateral` | Reps | no | Glutes (primary) |
| `cable-pull-through` | Cable Pull-Through | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Glutes (primary) |
| `cable-glute-kickback` | Cable Glute Kickback | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Stack weight + Reps per side | no | Glutes (primary) |
| `standing-calf-raise` | Standing Calf Raise | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Calves (primary) |
| `seated-calf-raise` | Seated Calf Raise | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Calves (primary) |
| `calf-press-on-leg-press` | Calf Press on Leg Press | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Calves (primary) |
| `hip-abductor` | Hip Abductor | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Glutes (primary) |
| `hip-adductor` | Hip Adductor | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Adductors (primary) |
| `cable-crunch` | Cable Crunch | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Core (primary) |
| `hanging-knee-raise` | Hanging Knee Raise | `reps_only` | `not_applicable` | `bodyweight_only` | `bilateral_cycle` | `bilateral` | Reps | no | Core (primary) |
| `hanging-leg-raise` | Hanging Leg Raise | `reps_only` | `not_applicable` | `bodyweight_only` | `bilateral_cycle` | `bilateral` | Reps | no | Core (primary) |
| `ab-wheel-rollout` | Ab Wheel Rollout | `reps_only` | `not_applicable` | `bodyweight_only` | `bilateral_cycle` | `bilateral` | Reps | no | Core (primary) |
| `plank` | Plank | `duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Duration | no | Core (primary) |
| `side-plank` | Side Plank | `duration` | `not_applicable` | `not_applicable` | `not_applicable` | `unilateral` | Duration per side | no | Core (primary) |
| `pallof-press` | Pallof Press | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Stack weight + Reps per side | no | Core (primary) |
| `machine-crunch` | Machine Crunch | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Core (primary) |
| `russian-twist` | Russian Twist | `reps_only` | `not_applicable` | `bodyweight_only` | `alternating_total` | `alternating` | Alternating reps total | no | Core (primary) |
| `dead-bug` | Dead Bug | `reps_only` | `not_applicable` | `bodyweight_only` | `alternating_total` | `alternating` | Alternating reps total | no | Core (primary) |
| `treadmill-run` | Treadmill Run | `distance_duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Distance + Duration | no | Cardio (primary) |
| `outdoor-run` | Outdoor Run | `distance_duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Distance + Duration | no | Cardio (primary) |
| `incline-walk` | Incline Walk | `distance_duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Distance + Duration | no | Cardio (primary) |
| `stair-climber` | Stair Climber | `duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Duration | no | Cardio (primary) |
| `stationary-bike` | Stationary Bike | `distance_duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Distance + Duration | no | Cardio (primary) |
| `elliptical` | Elliptical | `distance_duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Distance + Duration | no | Cardio (primary) |
| `rowing-machine` | Rowing Machine | `distance_duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Distance + Duration | no | Cardio (primary) |
| `deadlift` | Deadlift | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Full Body (primary) |
| `trap-bar-deadlift` | Trap Bar Deadlift | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Full Body (primary) |
| `farmer-carry` | Farmer Carry | `load_distance` | `per_hand` | `external` | `not_applicable` | `asymmetric` | Weight per hand + Distance | no | Full Body (primary) |
| `kettlebell-swing` | Kettlebell Swing | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | no | Full Body (primary) |
| `cable-chest-press` | Cable Chest Press | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Stack weight + Reps | no | Chest (primary), Shoulders (secondary), Triceps (secondary) |
| `dumbbell-chest-fly` | Dumbbell Chest Fly | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | no | Chest (primary) |
| `dumbbell-pullover` | Dumbbell Pullover | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Dumbbell weight + Reps | no | Back (primary), Chest (secondary) |
| `dumbbell-floor-press` | Dumbbell Floor Press | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | yes (`entered_load`) | Triceps (primary), Chest (secondary), Shoulders (secondary) |
| `dip-machine` | Dip Machine | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Triceps (primary), Chest (secondary), Shoulders (secondary) |
| `machine-biceps-curl` | Machine Biceps Curl | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Biceps (primary) |
| `machine-triceps-extension` | Machine Triceps Extension | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Triceps (primary) |
| `dumbbell-front-raise` | Dumbbell Front Raise | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | no | Shoulders (primary) |
| `machine-lateral-raise` | Machine Lateral Raise | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Machine weight + Reps | no | Shoulders (primary) |
| `smith-machine-overhead-press` | Smith Machine Overhead Press | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Smith machine weight + Reps | no | Shoulders (primary), Triceps (secondary) |
| `plate-loaded-high-row` | Plate-Loaded High Row | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Weight per side + Reps | no | Back (primary), Biceps (secondary) |
| `plate-loaded-low-row` | Plate-Loaded Low Row | `load_reps` | `per_side` | `machine_indicated` | `bilateral_cycle` | `independent_bilateral` | Weight per side + Reps | no | Back (primary), Biceps (secondary) |
| `single-arm-lat-pulldown` | Single-Arm Lat Pulldown | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Stack weight + Reps per side | no | Back (primary), Biceps (secondary) |
| `inverted-row` | Inverted Row | `reps_only` | `not_applicable` | `bodyweight_only` | `bilateral_cycle` | `bilateral` | Reps | no | Back (primary), Biceps (secondary) |
| `smith-machine-bent-over-row` | Smith Machine Bent-Over Row | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Smith machine weight + Reps | no | Back (primary), Biceps (secondary) |
| `standing-leg-curl` | Standing Leg Curl | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Machine weight + Reps per side | no | Hamstrings (primary) |
| `single-leg-leg-extension` | Single-Leg Leg Extension | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Machine weight + Reps per side | no | Quads (primary) |
| `single-leg-seated-leg-curl` | Single-Leg Seated Leg Curl | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Machine weight + Reps per side | no | Hamstrings (primary) |
| `glute-ham-raise` | Glute-Ham Raise | `reps_only` | `not_applicable` | `bodyweight_only` | `bilateral_cycle` | `bilateral` | Reps | no | Hamstrings (primary), Glutes (secondary), Calves (secondary) |
| `good-morning` | Good Morning | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | no | Hamstrings (primary), Glutes (secondary) |
| `sumo-deadlift` | Sumo Deadlift | `load_reps` | `total` | `external` | `bilateral_cycle` | `bilateral` | Total weight + Reps | yes (`combined_external_load`) | Hamstrings (primary), Glutes (primary), Quads (secondary), Back (secondary) |
| `smith-machine-romanian-deadlift` | Smith Machine Romanian Deadlift | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Smith machine weight + Reps | no | Hamstrings (primary), Glutes (secondary) |
| `smith-machine-split-squat` | Smith Machine Split Squat | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Smith machine weight + Reps per side | no | Quads (primary), Glutes (secondary), Hamstrings (secondary) |
| `smith-machine-hip-thrust` | Smith Machine Hip Thrust | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Smith machine weight + Reps | no | Glutes (primary), Hamstrings (secondary) |
| `glute-drive-machine` | Glute Drive Machine | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Machine weight + Reps | no | Glutes (primary), Hamstrings (secondary) |
| `machine-glute-kickback` | Machine Glute Kickback | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Machine weight + Reps per side | no | Glutes (primary), Hamstrings (secondary) |
| `smith-machine-calf-raise` | Smith Machine Calf Raise | `load_reps` | `total` | `machine_indicated` | `bilateral_cycle` | `bilateral` | Smith machine weight + Reps | no | Calves (primary) |
| `cable-wood-chop` | Cable Wood Chop | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `asymmetric` | Stack weight + Reps per side | no | Core (primary), Shoulders (secondary) |
| `rotary-torso-machine` | Rotary Torso Machine | `load_reps` | `total` | `machine_indicated` | `reps_per_side` | `unilateral` | Machine weight + Reps per side | no | Core (primary) |
| `sled-push` | Sled Push | `load_distance` | `total` | `machine_indicated` | `not_applicable` | `not_applicable` | Sled load + Distance | no | Full Body (primary) |
| `backward-sled-drag` | Backward Sled Drag | `load_distance` | `total` | `machine_indicated` | `not_applicable` | `not_applicable` | Sled load + Distance | no | Quads (primary), Glutes (secondary), Hamstrings (secondary) |
| `air-bike` | Air Bike | `distance_duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Distance + Duration | no | Cardio (primary) |
| `ski-erg` | Ski Erg | `distance_duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Distance + Duration | no | Cardio (primary) |
| `battle-rope-waves` | Battle Rope Waves | `duration` | `not_applicable` | `not_applicable` | `not_applicable` | `not_applicable` | Duration | no | Full Body (primary) |
| `dumbbell-wrist-curl` | Dumbbell Wrist Curl | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | no | Forearms (primary) |
| `dumbbell-reverse-wrist-curl` | Dumbbell Reverse Wrist Curl | `load_reps` | `per_hand` | `external` | `bilateral_cycle` | `independent_bilateral` | Weight per dumbbell + Reps | no | Forearms (primary) |
