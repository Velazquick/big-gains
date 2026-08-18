// GENERATED FILE - DO NOT EDIT.
// Sources: ekf/curated/exercises.json, families.json, references.json
// Generator: scripts/generate-exercise-catalog.mjs
// EKF-1 compatibility projection: EKF-2.2, EKF-2.3, EKF-2.6, EKF-2.7, EKF-11.1.
((scope) => {
  'use strict';

  const RELEASE_ID = "ekf-1-big-gains-compatibility-v1";
  const RECORDS = [
  {
    "canonicalId": "a91d27f9-e4e9-4498-ad48-f0e7db8e8a85",
    "legacyIds": [
      "seated-machine-chest-press"
    ],
    "id": "seated-machine-chest-press",
    "name": "Seated Machine Chest Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "d4f7cf94-db5d-43b9-9944-dca188011e72",
    "legacyIds": [
      "seated-iso-lateral-bench-press"
    ],
    "id": "seated-iso-lateral-bench-press",
    "name": "Seated Iso-Lateral Bench Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Machine",
    "aliases": [
      "Iso-Lateral Bench Press",
      "Seated Iso Lateral Bench Press",
      "Iso-Lateral Chest Press",
      "Seated Iso-Lateral Chest Press"
    ],
    "family": null
  },
  {
    "canonicalId": "e716514a-8bb7-4836-bc5c-673d257169da",
    "legacyIds": [
      "incline-iso-machine-press"
    ],
    "id": "incline-iso-machine-press",
    "name": "Incline Iso Machine Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "46d1003f-98b0-43aa-a13f-7861c326cc66",
    "legacyIds": [
      "smith-machine-incline-press"
    ],
    "id": "smith-machine-incline-press",
    "name": "Smith Machine Incline Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Smith Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "e6815fb8-ab2c-41ee-b8dc-1141af5fee8b",
    "legacyIds": [
      "flat-smith-machine-bench-press"
    ],
    "id": "flat-smith-machine-bench-press",
    "name": "Flat Smith Machine Bench Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Smith Machine",
    "aliases": [
      "Smith Machine Bench Press",
      "Smith Bench"
    ],
    "family": null
  },
  {
    "canonicalId": "fe9b24dd-e6db-41d3-9395-596830a0a37a",
    "legacyIds": [
      "barbell-bench-press"
    ],
    "id": "barbell-bench-press",
    "name": "Barbell Bench Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Barbell",
    "aliases": [
      "Bench",
      "Barbell Bench"
    ],
    "family": null
  },
  {
    "canonicalId": "c88a0b76-3cc6-405b-afe9-b4ce5f45e0b5",
    "legacyIds": [
      "decline-barbell-bench-press"
    ],
    "id": "decline-barbell-bench-press",
    "name": "Decline Barbell Bench Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Barbell",
    "aliases": [
      "Decline Bench Press",
      "Decline Bench"
    ],
    "family": null
  },
  {
    "canonicalId": "64a28c27-909f-4f0a-adfa-7a294dcea60c",
    "legacyIds": [
      "dumbbell-bench-press"
    ],
    "id": "dumbbell-bench-press",
    "name": "Dumbbell Bench Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Bench"
    ],
    "family": null
  },
  {
    "canonicalId": "3ee9949f-fabe-4387-8bb9-d14f775e02cf",
    "legacyIds": [
      "incline-dumbbell-press"
    ],
    "id": "incline-dumbbell-press",
    "name": "Incline Dumbbell Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Incline Press",
      "Incline DB Press"
    ],
    "family": null
  },
  {
    "canonicalId": "dce44595-28a0-4250-ada3-4b8fa7fee916",
    "legacyIds": [
      "decline-dumbbell-press"
    ],
    "id": "decline-dumbbell-press",
    "name": "Decline Dumbbell Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Dumbbell",
    "aliases": [
      "Decline DB Press"
    ],
    "family": null
  },
  {
    "canonicalId": "d175ba6c-0604-4c3f-99cc-fe6ce885a236",
    "legacyIds": [
      "cable-chest-fly"
    ],
    "id": "cable-chest-fly",
    "name": "Cable Chest Fly",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "70f2c251-e665-4b86-b44e-75693b62102f",
    "legacyIds": [
      "incline-cable-fly"
    ],
    "id": "incline-cable-fly",
    "name": "Incline Cable Fly",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Cable",
    "aliases": [
      "Incline Cable Chest Fly"
    ],
    "family": null
  },
  {
    "canonicalId": "91e20edc-0f3c-4fcb-b769-cf2011594c45",
    "legacyIds": [
      "seated-pec-deck"
    ],
    "id": "seated-pec-deck",
    "name": "Seated Pec Deck",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Machine",
    "aliases": [
      "Pec Fly Machine",
      "Pec Deck",
      "Machine Pec Fly"
    ],
    "family": null
  },
  {
    "canonicalId": "18e13fdf-2b56-4855-bbd6-aa5a9f45a2e6",
    "legacyIds": [
      "push-up"
    ],
    "id": "push-up",
    "name": "Push-Up",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "2dd15ca3-4558-4bd7-820a-129c3547a854",
    "legacyIds": [
      "dips"
    ],
    "id": "dips",
    "name": "Dips",
    "day": "Push",
    "muscle": "Chest / Triceps",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "734aad4e-da45-4b94-b29b-cbb7a40c7f89",
    "legacyIds": [
      "assisted-dip"
    ],
    "id": "assisted-dip",
    "name": "Assisted Dip",
    "day": "Push",
    "muscle": "Chest / Triceps",
    "equipment": "Machine",
    "aliases": [
      "Assisted Dips"
    ],
    "family": null
  },
  {
    "canonicalId": "79b87909-774d-4221-9a13-d507076310ee",
    "legacyIds": [
      "iso-machine-shoulder-press"
    ],
    "id": "iso-machine-shoulder-press",
    "name": "Iso Machine Shoulder Press",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Machine",
    "aliases": [
      "Iso Shoulder Press"
    ],
    "family": null
  },
  {
    "canonicalId": "377b4c23-b7c6-476f-8c75-c555dc1185ef",
    "legacyIds": [
      "dumbbell-shoulder-press"
    ],
    "id": "dumbbell-shoulder-press",
    "name": "Dumbbell Shoulder Press",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Shoulder Press"
    ],
    "family": null
  },
  {
    "canonicalId": "766bfd3e-b8c4-4b8e-aba6-1af3e1431aec",
    "legacyIds": [
      "barbell-overhead-press"
    ],
    "id": "barbell-overhead-press",
    "name": "Barbell Overhead Press",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Barbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "9ec58c9e-130d-4b67-a725-a2839b9b214c",
    "legacyIds": [
      "machine-shoulder-press"
    ],
    "id": "machine-shoulder-press",
    "name": "Machine Shoulder Press",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "173a117b-9bcc-4d1f-b598-df2e07c803e6",
    "legacyIds": [
      "arnold-press"
    ],
    "id": "arnold-press",
    "name": "Arnold Press",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Dumbbell",
    "aliases": [
      "Arnold Shoulder Press"
    ],
    "family": null
  },
  {
    "canonicalId": "f548f685-023f-43e3-a277-cae2cbd1905d",
    "legacyIds": [
      "landmine-press"
    ],
    "id": "landmine-press",
    "name": "Landmine Press",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Barbell",
    "aliases": [
      "Single-Arm Landmine Press"
    ],
    "family": null
  },
  {
    "canonicalId": "ca7c7370-08f4-4ed8-afbe-a2dbea2c0ad9",
    "legacyIds": [
      "dumbbell-lateral-raise"
    ],
    "id": "dumbbell-lateral-raise",
    "name": "Dumbbell Lateral Raise",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Lat Raise",
      "DB Lateral Raise"
    ],
    "family": null
  },
  {
    "canonicalId": "c0fd7882-3c9b-4546-8ec5-5da8d64bb3aa",
    "legacyIds": [
      "cable-lateral-raise"
    ],
    "id": "cable-lateral-raise",
    "name": "Cable Lateral Raise",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Cable",
    "aliases": [
      "Cable Lat Raise"
    ],
    "family": null
  },
  {
    "canonicalId": "e75530df-c1e4-487a-a952-f15f6f980cc5",
    "legacyIds": [
      "reverse-pec-deck"
    ],
    "id": "reverse-pec-deck",
    "name": "Reverse Pec Deck",
    "day": "Pull",
    "muscle": "Rear Delts",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "071f203f-55ac-4c44-9bf2-c3f98f02cc81",
    "legacyIds": [
      "rear-delt-cable-fly"
    ],
    "id": "rear-delt-cable-fly",
    "name": "Rear Delt Cable Fly",
    "day": "Pull",
    "muscle": "Rear Delts",
    "equipment": "Cable",
    "aliases": [
      "Cable Rear Delt Fly"
    ],
    "family": null
  },
  {
    "canonicalId": "7bbbd74b-f955-48b7-a987-e7946a737f51",
    "legacyIds": [
      "face-pull"
    ],
    "id": "face-pull",
    "name": "Face Pull",
    "day": "Pull",
    "muscle": "Rear Delts",
    "equipment": "Cable",
    "aliases": [
      "Face Pulls"
    ],
    "family": null
  },
  {
    "canonicalId": "5468f6b8-c921-4159-a9cc-bb8228e2e45c",
    "legacyIds": [
      "overhead-triceps-extension"
    ],
    "id": "overhead-triceps-extension",
    "name": "Overhead Triceps Extension",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "Cable",
    "aliases": [
      "Overhead Tricep Extension"
    ],
    "family": null
  },
  {
    "canonicalId": "b5c59616-d4b2-4d93-bd9e-1f0e52e537c6",
    "legacyIds": [
      "triceps-pushdown"
    ],
    "id": "triceps-pushdown",
    "name": "Triceps Pushdown",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "5e43ab5e-a78d-4fff-8213-d1a37458d219",
    "legacyIds": [
      "rope-pushdown"
    ],
    "id": "rope-pushdown",
    "name": "Rope Pushdown",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "2ed5f449-e01f-4726-a607-08d03d6be512",
    "legacyIds": [
      "skull-crusher"
    ],
    "id": "skull-crusher",
    "name": "Skull Crusher",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "EZ Bar",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "1f051f8b-9592-4577-a245-db85ca472c76",
    "legacyIds": [
      "close-grip-bench-press"
    ],
    "id": "close-grip-bench-press",
    "name": "Close-Grip Bench Press",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "Barbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "0c142a86-6c32-4a9a-b56f-c6a09d97ada9",
    "legacyIds": [
      "single-arm-cable-extension"
    ],
    "id": "single-arm-cable-extension",
    "name": "Single-Arm Cable Extension",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "1a80259b-e27d-4538-9ceb-e3becfe23d88",
    "legacyIds": [
      "cable-triceps-kickback"
    ],
    "id": "cable-triceps-kickback",
    "name": "Cable Triceps Kickback",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "Cable",
    "aliases": [
      "Cable Tricep Kickback"
    ],
    "family": null
  },
  {
    "canonicalId": "eb963de3-f97a-4d26-9f4e-45abe9f79033",
    "legacyIds": [
      "dumbbell-triceps-kickback"
    ],
    "id": "dumbbell-triceps-kickback",
    "name": "Dumbbell Triceps Kickback",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Tricep Kickback",
      "Dumbbell Tricep Kickback"
    ],
    "family": null
  },
  {
    "canonicalId": "a1c6ea43-5c0f-4c82-ab3e-c984fcb16306",
    "legacyIds": [
      "lat-pulldown"
    ],
    "id": "lat-pulldown",
    "name": "Lat Pulldown",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Cable",
    "aliases": [],
    "family": "lat-pulldown"
  },
  {
    "canonicalId": "bf2be05e-38df-4440-b486-7c310dbca831",
    "legacyIds": [
      "wide-grip-lat-pulldown"
    ],
    "id": "wide-grip-lat-pulldown",
    "name": "Wide-Grip Lat Pulldown",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Cable",
    "aliases": [
      "Wide Grip Pulldown"
    ],
    "family": "lat-pulldown"
  },
  {
    "canonicalId": "967549cb-31a8-480b-8eb0-29e9d5826130",
    "legacyIds": [
      "neutral-grip-lat-pulldown"
    ],
    "id": "neutral-grip-lat-pulldown",
    "name": "Neutral-Grip Lat Pulldown",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Cable",
    "aliases": [
      "Neutral Grip Pulldown"
    ],
    "family": "lat-pulldown"
  },
  {
    "canonicalId": "3ebe997b-197c-4dfa-b0ac-9f5c678e076c",
    "legacyIds": [
      "iso-lateral-pulldown-machine"
    ],
    "id": "iso-lateral-pulldown-machine",
    "name": "Iso-Lateral Pulldown Machine",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [
      "Iso Lat Pull Machine",
      "Iso Lat Pulldown Machine"
    ],
    "family": "lat-pulldown"
  },
  {
    "canonicalId": "7794f0cd-2ccd-4dd5-a880-e1a5b60af7b2",
    "legacyIds": [
      "assisted-pull-up"
    ],
    "id": "assisted-pull-up",
    "name": "Assisted Pull-Up",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "7e036c58-2533-41bc-a323-6900b2869e3b",
    "legacyIds": [
      "pull-up"
    ],
    "id": "pull-up",
    "name": "Pull-Up",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Bodyweight",
    "aliases": [
      "Pull ups",
      "Pullup",
      "Pullups"
    ],
    "family": null
  },
  {
    "canonicalId": "93735b4f-ef72-42b8-a7fa-fd6f8a452391",
    "legacyIds": [
      "seated-cable-row"
    ],
    "id": "seated-cable-row",
    "name": "Seated Cable Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Cable",
    "aliases": [
      "Cable Row"
    ],
    "family": null
  },
  {
    "canonicalId": "f07f5f3d-25ad-4bd8-b143-199e8e0e82be",
    "legacyIds": [
      "close-grip-seated-cable-row"
    ],
    "id": "close-grip-seated-cable-row",
    "name": "Close-Grip Seated Cable Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Cable",
    "aliases": [
      "Close Grip Cable Row"
    ],
    "family": null
  },
  {
    "canonicalId": "ea973e61-6d86-422f-bed6-c5c50fbdd08f",
    "legacyIds": [
      "one-arm-cable-row"
    ],
    "id": "one-arm-cable-row",
    "name": "One-Arm Cable Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Cable",
    "aliases": [
      "Single-Arm Cable Row",
      "Single Arm Cable Row"
    ],
    "family": null
  },
  {
    "canonicalId": "cfa65978-e97e-423a-8ed5-86dac483a849",
    "legacyIds": [
      "chest-supported-row"
    ],
    "id": "chest-supported-row",
    "name": "Chest-Supported Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "3bd894ae-6ae2-4cfe-b467-c68fbc60c203",
    "legacyIds": [
      "t-bar-row"
    ],
    "id": "t-bar-row",
    "name": "T-Bar Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "172a5cf2-78b9-4ac0-b8db-9014387b59cc",
    "legacyIds": [
      "chest-supported-t-bar-row"
    ],
    "id": "chest-supported-t-bar-row",
    "name": "Chest-Supported T-Bar Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [
      "Chest Supported T Bar Row"
    ],
    "family": null
  },
  {
    "canonicalId": "e5185176-05a3-4704-97fd-accb0ae5c3e7",
    "legacyIds": [
      "barbell-row"
    ],
    "id": "barbell-row",
    "name": "Barbell Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Barbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "dc063581-f739-43c9-8ba7-a84bbfb0d000",
    "legacyIds": [
      "meadows-row"
    ],
    "id": "meadows-row",
    "name": "Meadows Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Barbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "70f53c09-e92d-4052-96b4-fa50b68cbcc8",
    "legacyIds": [
      "one-arm-dumbbell-row"
    ],
    "id": "one-arm-dumbbell-row",
    "name": "One-Arm Dumbbell Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Dumbbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "d4e61d83-34ac-46d9-aaf9-a1df27d645e3",
    "legacyIds": [
      "iso-lateral-row"
    ],
    "id": "iso-lateral-row",
    "name": "Iso-Lateral Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [
      "One Arm Row Machine",
      "One-Arm Row Machine",
      "Iso Row Machine"
    ],
    "family": null
  },
  {
    "canonicalId": "a45e32da-1125-40bb-9a68-a0033ec58c7c",
    "legacyIds": [
      "straight-arm-pulldown"
    ],
    "id": "straight-arm-pulldown",
    "name": "Straight-Arm Pulldown",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "b0fffa0f-f436-4f85-8421-fd6ce711b0a8",
    "legacyIds": [
      "machine-pullover"
    ],
    "id": "machine-pullover",
    "name": "Machine Pullover",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "a97cc1b8-1d6e-4064-843d-954a7336c2f2",
    "legacyIds": [
      "rack-pull"
    ],
    "id": "rack-pull",
    "name": "Rack Pull",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Barbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "b140a2c7-4e29-428a-8cf9-86dee4342af1",
    "legacyIds": [
      "dumbbell-shrug"
    ],
    "id": "dumbbell-shrug",
    "name": "Dumbbell Shrug",
    "day": "Pull",
    "muscle": "Traps",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Shrug",
      "DB Shrugs"
    ],
    "family": null
  },
  {
    "canonicalId": "ad237cb2-0797-412f-aa38-5701b2e71173",
    "legacyIds": [
      "barbell-shrug"
    ],
    "id": "barbell-shrug",
    "name": "Barbell Shrug",
    "day": "Pull",
    "muscle": "Traps",
    "equipment": "Barbell",
    "aliases": [
      "Barbell Shrugs"
    ],
    "family": null
  },
  {
    "canonicalId": "215a0231-5dd9-4ada-b3d8-bcb3338378f1",
    "legacyIds": [
      "dumbbell-curl"
    ],
    "id": "dumbbell-curl",
    "name": "Dumbbell Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Curl",
      "DB Curls"
    ],
    "family": null
  },
  {
    "canonicalId": "4fb9a0d5-2b36-449f-9031-af83687cd4ee",
    "legacyIds": [
      "hammer-curl"
    ],
    "id": "hammer-curl",
    "name": "Hammer Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Dumbbell",
    "aliases": [
      "Hammer Curls"
    ],
    "family": null
  },
  {
    "canonicalId": "352cccc6-3014-4a17-b762-5a32dc9c04b7",
    "legacyIds": [
      "rope-hammer-curl"
    ],
    "id": "rope-hammer-curl",
    "name": "Rope Hammer Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Cable",
    "aliases": [
      "Rope Hammer Curls"
    ],
    "family": null
  },
  {
    "canonicalId": "36b211e8-550a-4a26-b82a-433a2ecf69f5",
    "legacyIds": [
      "incline-dumbbell-curl"
    ],
    "id": "incline-dumbbell-curl",
    "name": "Incline Dumbbell Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Dumbbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "351e261c-2b4a-4412-b91e-c71538a538aa",
    "legacyIds": [
      "preacher-curl"
    ],
    "id": "preacher-curl",
    "name": "Preacher Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "EZ Bar",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "bcd4bc3b-bed6-49ae-a8c7-a7f870c05718",
    "legacyIds": [
      "machine-preacher-curl"
    ],
    "id": "machine-preacher-curl",
    "name": "Machine Preacher Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "67f896b2-2e22-467d-b0ab-3e5f2798c8fa",
    "legacyIds": [
      "spider-curl"
    ],
    "id": "spider-curl",
    "name": "Spider Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "EZ Bar",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "91945d91-ffe2-4012-84ba-2cefcfc2075e",
    "legacyIds": [
      "concentration-curl"
    ],
    "id": "concentration-curl",
    "name": "Concentration Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Dumbbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "75cc0c53-30af-40d1-be18-9cf61eb33462",
    "legacyIds": [
      "reverse-curl"
    ],
    "id": "reverse-curl",
    "name": "Reverse Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "EZ Bar",
    "aliases": [
      "Reverse EZ-Bar Curl"
    ],
    "family": null
  },
  {
    "canonicalId": "59df3fa5-dba6-4cc9-acbc-114e5240ed24",
    "legacyIds": [
      "cable-curl"
    ],
    "id": "cable-curl",
    "name": "Cable Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "4dba859c-23e1-46c8-80c2-6b239925c101",
    "legacyIds": [
      "bayesian-cable-curl"
    ],
    "id": "bayesian-cable-curl",
    "name": "Bayesian Cable Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "4a5d8127-a5af-478f-8dce-580050bf43dd",
    "legacyIds": [
      "ez-bar-curl"
    ],
    "id": "ez-bar-curl",
    "name": "EZ-Bar Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "EZ Bar",
    "aliases": [
      "EZ Bar Curl",
      "EZ Curl"
    ],
    "family": null
  },
  {
    "canonicalId": "4d343bf2-5f7d-49b3-9bb3-0eccd444f452",
    "legacyIds": [
      "back-squat"
    ],
    "id": "back-squat",
    "name": "Back Squat",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Barbell",
    "aliases": [
      "Squat",
      "Barbell Squat"
    ],
    "family": null
  },
  {
    "canonicalId": "2ee09133-0997-4108-9c38-49954b6c3517",
    "legacyIds": [
      "front-squat"
    ],
    "id": "front-squat",
    "name": "Front Squat",
    "day": "Legs",
    "muscle": "Quads",
    "equipment": "Barbell",
    "aliases": [
      "Front Barbell Squat"
    ],
    "family": null
  },
  {
    "canonicalId": "b5b01d47-aec1-4acb-9706-da7eef25ba1e",
    "legacyIds": [
      "hack-squat"
    ],
    "id": "hack-squat",
    "name": "Hack Squat",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "f49314d5-c9a0-4273-8f62-81b76a4893c5",
    "legacyIds": [
      "belt-squat"
    ],
    "id": "belt-squat",
    "name": "Belt Squat",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Machine",
    "aliases": [
      "Belt Squat Machine"
    ],
    "family": null
  },
  {
    "canonicalId": "3e9f5981-1d2d-4923-8c7c-fed87d88330d",
    "legacyIds": [
      "pendulum-squat"
    ],
    "id": "pendulum-squat",
    "name": "Pendulum Squat",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Machine",
    "aliases": [
      "Pendulum Squat Machine"
    ],
    "family": null
  },
  {
    "canonicalId": "33508e1b-11e9-400e-9b8b-014c4fd88c69",
    "legacyIds": [
      "v-squat-machine"
    ],
    "id": "v-squat-machine",
    "name": "V-Squat Machine",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Machine",
    "aliases": [
      "V Squat"
    ],
    "family": null
  },
  {
    "canonicalId": "9b3ee450-429e-419e-8591-6a44d638095e",
    "legacyIds": [
      "leg-press"
    ],
    "id": "leg-press",
    "name": "Leg Press",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "b8bf4e81-3de3-42fb-bed7-f59b00e1910a",
    "legacyIds": [
      "single-leg-press"
    ],
    "id": "single-leg-press",
    "name": "Single-Leg Press",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Machine",
    "aliases": [
      "Single Leg Press",
      "Unilateral Leg Press"
    ],
    "family": null
  },
  {
    "canonicalId": "8918f80d-1353-40da-a3e7-24287f7c4e22",
    "legacyIds": [
      "smith-machine-squat"
    ],
    "id": "smith-machine-squat",
    "name": "Smith Machine Squat",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Smith Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "9c398b1c-0fb8-4b8a-9c3a-7f5b084e0e73",
    "legacyIds": [
      "goblet-squat"
    ],
    "id": "goblet-squat",
    "name": "Goblet Squat",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Dumbbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "a10a78b7-a5b9-4d1b-9762-ebe59cf98cea",
    "legacyIds": [
      "bulgarian-split-squat"
    ],
    "id": "bulgarian-split-squat",
    "name": "Bulgarian Split Squat",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Dumbbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "c57cd1c8-a0dc-4772-a788-0320334d7f41",
    "legacyIds": [
      "walking-lunge"
    ],
    "id": "walking-lunge",
    "name": "Walking Lunge",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Dumbbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "136bc82f-5506-4ebd-b9cc-f2e40efcdd7b",
    "legacyIds": [
      "reverse-lunge"
    ],
    "id": "reverse-lunge",
    "name": "Reverse Lunge",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Dumbbell",
    "aliases": [
      "Reverse Lunges"
    ],
    "family": null
  },
  {
    "canonicalId": "e47e934a-0e33-4537-a3ae-7c2b48a39d0a",
    "legacyIds": [
      "step-up"
    ],
    "id": "step-up",
    "name": "Step-Up",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Dumbbell",
    "aliases": [
      "Step Up"
    ],
    "family": null
  },
  {
    "canonicalId": "c22da607-8530-4bee-ac23-65f58bb682fe",
    "legacyIds": [
      "leg-extension"
    ],
    "id": "leg-extension",
    "name": "Leg Extension",
    "day": "Legs",
    "muscle": "Quads",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "643ae68e-7243-4357-ac98-6ce1fb9703b7",
    "legacyIds": [
      "romanian-deadlift"
    ],
    "id": "romanian-deadlift",
    "name": "Romanian Deadlift",
    "day": "Legs",
    "muscle": "Hamstrings / Glutes",
    "equipment": "Barbell",
    "aliases": [
      "RDL",
      "Barbell RDL"
    ],
    "family": null
  },
  {
    "canonicalId": "f21d9bc1-d697-4aa5-b83a-0bd4b771cd72",
    "legacyIds": [
      "dumbbell-romanian-deadlift"
    ],
    "id": "dumbbell-romanian-deadlift",
    "name": "Dumbbell Romanian Deadlift",
    "day": "Legs",
    "muscle": "Hamstrings / Glutes",
    "equipment": "Dumbbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "70427367-59ce-47bf-a86d-f65a7a033543",
    "legacyIds": [
      "seated-leg-curl"
    ],
    "id": "seated-leg-curl",
    "name": "Seated Leg Curl",
    "day": "Legs",
    "muscle": "Hamstrings",
    "equipment": "Machine",
    "aliases": [
      "Leg Curl"
    ],
    "family": null
  },
  {
    "canonicalId": "d45d963e-43ec-42ef-9632-8115d7e066f0",
    "legacyIds": [
      "lying-leg-curl"
    ],
    "id": "lying-leg-curl",
    "name": "Lying Leg Curl",
    "day": "Legs",
    "muscle": "Hamstrings",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "39a8c106-d9d2-4abd-8805-2b70506a6629",
    "legacyIds": [
      "nordic-hamstring-curl"
    ],
    "id": "nordic-hamstring-curl",
    "name": "Nordic Hamstring Curl",
    "day": "Legs",
    "muscle": "Hamstrings",
    "equipment": "Bodyweight",
    "aliases": [
      "Nordic Curl"
    ],
    "family": null
  },
  {
    "canonicalId": "9ad8c213-2aa8-4227-a024-ec84c42965a4",
    "legacyIds": [
      "45-degree-back-extension"
    ],
    "id": "45-degree-back-extension",
    "name": "45-Degree Back Extension",
    "day": "Legs",
    "muscle": "Hamstrings / Glutes",
    "equipment": "Machine",
    "aliases": [
      "Back Extension",
      "45 Degree Hyperextension"
    ],
    "family": null
  },
  {
    "canonicalId": "7492bccf-54b4-430b-a6b9-bb7d567952a1",
    "legacyIds": [
      "hip-thrust"
    ],
    "id": "hip-thrust",
    "name": "Hip Thrust",
    "day": "Legs",
    "muscle": "Glutes",
    "equipment": "Barbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "05c8f47e-79e3-4933-bcfc-c62d54b1ad9f",
    "legacyIds": [
      "glute-bridge"
    ],
    "id": "glute-bridge",
    "name": "Glute Bridge",
    "day": "Legs",
    "muscle": "Glutes",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "34bca141-b8d2-41ba-8b2b-7ef74e87ac18",
    "legacyIds": [
      "cable-pull-through"
    ],
    "id": "cable-pull-through",
    "name": "Cable Pull-Through",
    "day": "Legs",
    "muscle": "Glutes",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "7e0cb04c-b637-46b0-a97b-bbf11fc693e4",
    "legacyIds": [
      "cable-glute-kickback"
    ],
    "id": "cable-glute-kickback",
    "name": "Cable Glute Kickback",
    "day": "Legs",
    "muscle": "Glutes",
    "equipment": "Cable",
    "aliases": [
      "Glute Cable Kickback"
    ],
    "family": null
  },
  {
    "canonicalId": "2a7b9098-26cd-4222-8ade-38d4e49baecc",
    "legacyIds": [
      "standing-calf-raise"
    ],
    "id": "standing-calf-raise",
    "name": "Standing Calf Raise",
    "day": "Legs",
    "muscle": "Calves",
    "equipment": "Machine",
    "aliases": [],
    "family": "calf-raise"
  },
  {
    "canonicalId": "7020d1c4-0a27-4fe3-8cbe-f5674946524d",
    "legacyIds": [
      "seated-calf-raise"
    ],
    "id": "seated-calf-raise",
    "name": "Seated Calf Raise",
    "day": "Legs",
    "muscle": "Calves",
    "equipment": "Machine",
    "aliases": [],
    "family": "calf-raise"
  },
  {
    "canonicalId": "8ee12864-2e5b-46a5-b873-d2a1d2783ef0",
    "legacyIds": [
      "calf-press-on-leg-press"
    ],
    "id": "calf-press-on-leg-press",
    "name": "Calf Press on Leg Press",
    "day": "Legs",
    "muscle": "Calves",
    "equipment": "Machine",
    "aliases": [
      "Calf Raise on Leg Press Machine",
      "Calf Press",
      "Leg Press Calf Raise"
    ],
    "family": "calf-raise"
  },
  {
    "canonicalId": "3d7b1e87-3e86-4404-acf1-33a891f0bca6",
    "legacyIds": [
      "hip-abductor"
    ],
    "id": "hip-abductor",
    "name": "Hip Abductor",
    "day": "Legs",
    "muscle": "Glutes",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "c94fbefb-1916-4347-91d9-74e40fd58bb3",
    "legacyIds": [
      "hip-adductor"
    ],
    "id": "hip-adductor",
    "name": "Hip Adductor",
    "day": "Legs",
    "muscle": "Adductors",
    "equipment": "Machine",
    "aliases": [
      "Adductor Machine"
    ],
    "family": null
  },
  {
    "canonicalId": "2c62dfaf-f5de-4367-92f6-bf167a904151",
    "legacyIds": [
      "cable-crunch"
    ],
    "id": "cable-crunch",
    "name": "Cable Crunch",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "689831d2-1b33-4f27-b768-6d07bb760318",
    "legacyIds": [
      "hanging-knee-raise"
    ],
    "id": "hanging-knee-raise",
    "name": "Hanging Knee Raise",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "1b3b15e5-e79e-4deb-aeda-e0eefef61f81",
    "legacyIds": [
      "hanging-leg-raise"
    ],
    "id": "hanging-leg-raise",
    "name": "Hanging Leg Raise",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "7a45ad83-c913-4cbf-82b0-4fe0d29b467c",
    "legacyIds": [
      "ab-wheel-rollout"
    ],
    "id": "ab-wheel-rollout",
    "name": "Ab Wheel Rollout",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "272e575b-eefb-40a5-9431-871d300a6b14",
    "legacyIds": [
      "plank"
    ],
    "id": "plank",
    "name": "Plank",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "75cf9baa-8522-4fe9-bbef-68d3a3289e95",
    "legacyIds": [
      "side-plank"
    ],
    "id": "side-plank",
    "name": "Side Plank",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "e03284b2-db53-4794-9ee4-32042ffff4aa",
    "legacyIds": [
      "pallof-press"
    ],
    "id": "pallof-press",
    "name": "Pallof Press",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Cable",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "e7e04989-d479-44c9-86bb-066cf794288e",
    "legacyIds": [
      "machine-crunch"
    ],
    "id": "machine-crunch",
    "name": "Machine Crunch",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "5a7767bc-3ba6-40fc-a161-7d5bdb05ab21",
    "legacyIds": [
      "russian-twist"
    ],
    "id": "russian-twist",
    "name": "Russian Twist",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "c0be1d82-bcb9-4271-8a96-245baf0ca741",
    "legacyIds": [
      "dead-bug"
    ],
    "id": "dead-bug",
    "name": "Dead Bug",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Bodyweight",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "d4067a6c-8851-4109-9864-0944ab6134bb",
    "legacyIds": [
      "treadmill-run"
    ],
    "id": "treadmill-run",
    "name": "Treadmill Run",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "Treadmill",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "ceaaa049-c00e-4d69-b2cb-9f30047a8f50",
    "legacyIds": [
      "outdoor-run"
    ],
    "id": "outdoor-run",
    "name": "Outdoor Run",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "None",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "58716db4-c02a-4270-829b-b17dbef6973e",
    "legacyIds": [
      "incline-walk"
    ],
    "id": "incline-walk",
    "name": "Incline Walk",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "Treadmill",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "3c8fea87-daf1-4cb7-9ae9-c6ac8c3fac11",
    "legacyIds": [
      "stair-climber"
    ],
    "id": "stair-climber",
    "name": "Stair Climber",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "a55b94d4-c155-4bcd-88fc-1ff90c13be47",
    "legacyIds": [
      "stationary-bike"
    ],
    "id": "stationary-bike",
    "name": "Stationary Bike",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "Bike",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "e9a4ad29-ca84-4984-9481-e7a500d670d4",
    "legacyIds": [
      "elliptical"
    ],
    "id": "elliptical",
    "name": "Elliptical",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "1243d9ca-bf59-42f5-bb84-d8fb33d45b5a",
    "legacyIds": [
      "rowing-machine"
    ],
    "id": "rowing-machine",
    "name": "Rowing Machine",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "Machine",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "e612230c-2d54-4c24-96be-4d049953b44f",
    "legacyIds": [
      "deadlift"
    ],
    "id": "deadlift",
    "name": "Deadlift",
    "day": "Other",
    "muscle": "Full Body",
    "equipment": "Barbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "c7680083-87db-4b47-975f-f676b8d18d29",
    "legacyIds": [
      "trap-bar-deadlift"
    ],
    "id": "trap-bar-deadlift",
    "name": "Trap Bar Deadlift",
    "day": "Other",
    "muscle": "Full Body",
    "equipment": "Trap Bar",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "c4defa6a-864a-416d-8c84-cfc1861b57db",
    "legacyIds": [
      "farmer-carry"
    ],
    "id": "farmer-carry",
    "name": "Farmer Carry",
    "day": "Other",
    "muscle": "Full Body",
    "equipment": "Dumbbell",
    "aliases": [],
    "family": null
  },
  {
    "canonicalId": "14015b5b-b608-4edb-9c18-aa6a932d24a9",
    "legacyIds": [
      "kettlebell-swing"
    ],
    "id": "kettlebell-swing",
    "name": "Kettlebell Swing",
    "day": "Other",
    "muscle": "Full Body",
    "equipment": "Kettlebell",
    "aliases": [],
    "family": null
  }
];
  const idForName = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const normalizeTerm = value => String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/\bdb\b/g, 'dumbbell').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const exercises = Object.freeze(RECORDS.map(record => Object.freeze({
    id: record.id,
    name: record.name,
    day: record.day,
    muscle: record.muscle,
    equipment: record.equipment,
    aliases: Object.freeze([...record.aliases]),
    family: record.family
  })));
  const compatibilityByCanonicalId = new Map(RECORDS.map((record, index) => [record.canonicalId, exercises[index]]));
  const canonicalIdByLegacyId = new Map(RECORDS.flatMap(record => record.legacyIds.map(legacyId => [legacyId, record.canonicalId])));
  const canonicalIdByTerm = new Map();
  RECORDS.forEach(record => [record.name, ...record.aliases].forEach(term => {
    const normalized = normalizeTerm(term);
    const existing = canonicalIdByTerm.get(normalized);
    if (existing && existing !== record.canonicalId) throw new Error(`Ambiguous EKF compatibility term in ${RELEASE_ID}: ${term}`);
    canonicalIdByTerm.set(normalized, record.canonicalId);
  }));

  const canonicalIdFor = value => {
    if (typeof value === 'string') return compatibilityByCanonicalId.has(value) ? value : canonicalIdByLegacyId.get(value) || null;
    if (!value || typeof value !== 'object') return null;
    return canonicalIdFor(value.definitionId) || canonicalIdFor(value.id);
  };
  const compatibilityForCanonicalId = canonicalId => compatibilityByCanonicalId.get(canonicalId) || null;
  const resolveCanonicalId = term => canonicalIdFor(term) || canonicalIdByTerm.get(normalizeTerm(term)) || null;
  const identityApi = Object.freeze({ canonicalIdFor, compatibilityForCanonicalId, resolveCanonicalId });

  const getById = id => typeof id === 'string' ? compatibilityForCanonicalId(canonicalIdFor(id)) : null;
  const resolve = term => compatibilityForCanonicalId(resolveCanonicalId(term));
  const definitionFor = value => {
    if (typeof value === 'string') return getById(value) || resolve(value);
    if (!value || typeof value !== 'object') return null;
    return getById(value.definitionId) || getById(value.id) || resolve(value.name);
  };
  const loadModeFor = value => {
    const definition = definitionFor(value);
    const equipment = definition?.equipment || (value && typeof value === 'object' ? value.equipment : '');
    return equipment === 'Bodyweight' ? 'bodyweight' : 'external';
  };
  const matchesSearch = (exercise, term) => {
    const normalized = normalizeTerm(term);
    return !normalized || normalizeTerm([exercise.name, ...exercise.aliases, exercise.muscle, exercise.equipment].join(' ')).includes(normalized);
  };

  const api = Object.freeze({ exercises, getById, idForName, loadModeFor, matchesSearch, normalizeTerm, resolve });
  Object.defineProperty(scope, 'BigGainsExerciseIdentity', {
    configurable: false,
    enumerable: true,
    value: identityApi,
    writable: false
  });
  Object.defineProperty(scope, 'BigGainsExerciseCatalog', {
    configurable: false,
    enumerable: true,
    value: api,
    writable: false
  });
  Object.defineProperty(scope, 'bigGainsExerciseCatalog', {
    configurable: false,
    enumerable: true,
    value: api,
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);
