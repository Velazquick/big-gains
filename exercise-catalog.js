// GENERATED FILE - DO NOT EDIT.
// Sources: EKF-2 baseline plus deterministic ekf/curated/ekf-3-* curation artifacts
// Generator: scripts/generate-exercise-catalog.mjs
// EKF-3 compatibility + measurement projection: EKF-4.2 through EKF-4.20, EKF-6.3, EKF-11.1.
((scope) => {
  'use strict';

  const RELEASE_ID = "ekf-3-curated-catalog-v1";
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "bodyweight_plus_external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "full_system",
      "ui": {
        "loadLabel": "Added weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps",
        "loadMayBeZero": true
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "effective_system_load"
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [
        "Triceps"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "assistance_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "assistance"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "full_system",
      "ui": {
        "loadLabel": "Assistance",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [
        "Triceps"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Rear Delts"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Rear Delts"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Rear Delts"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": "lat-pulldown",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": "lat-pulldown",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": "lat-pulldown",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": "lat-pulldown",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "assistance_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "assistance"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "full_system",
      "ui": {
        "loadLabel": "Assistance",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "bodyweight_plus_external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "full_system",
      "ui": {
        "loadLabel": "Added weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps",
        "loadMayBeZero": true
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "effective_system_load"
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Traps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Traps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "loadUnitsPerEvent": 2,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "alternating",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "alternating_total",
      "bodyweightModel": null,
      "loadUnitsPerEvent": 2,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Alternating reps total"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "loadUnitsPerEvent": 2,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "loadUnitsPerEvent": 2,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Added weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Glutes"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Glutes"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Glutes"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Glutes"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": "calf-raise",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Calves"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": "calf-raise",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Calves"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": "calf-raise",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Calves"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Glutes"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Adductors"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "durationLabel": "Duration per side",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "alternating",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "alternating_total",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Alternating reps total"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "alternating",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "alternating_total",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Alternating reps total"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "distance_duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "distanceLabel": "Distance",
        "distanceUnit": "mi",
        "distanceStep": 0.1,
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "distance_duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "distanceLabel": "Distance",
        "distanceUnit": "mi",
        "distanceStep": 0.1,
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "distance_duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "distanceLabel": "Distance",
        "distanceUnit": "mi",
        "distanceStep": 0.1,
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "distance_duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "distanceLabel": "Distance",
        "distanceUnit": "mi",
        "distanceStep": 0.1,
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "distance_duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "distanceLabel": "Distance",
        "distanceUnit": "mi",
        "distanceStep": 0.1,
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "distance_duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "distanceLabel": "Distance",
        "distanceUnit": "m",
        "distanceStep": 50,
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Full Body"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Full Body"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "asymmetric",
    "measurement": {
      "trackingModel": "load_distance",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "loadUnitsPerEvent": 2,
      "ui": {
        "loadLabel": "Weight per hand",
        "loadUnit": "lb",
        "loadStep": 5,
        "distanceLabel": "Distance",
        "distanceUnit": "ft",
        "distanceStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Full Body"
      ],
      "secondary": [],
      "stabilizer": []
    }
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
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "unknown",
    "programmingTags": [],
    "movementPatterns": [
      "unknown"
    ],
    "mechanics": "unknown",
    "equipmentRoles": [],
    "provenanceRefs": [
      "big-gains-curated-baseline-v64"
    ],
    "rightsRefs": [
      "big-gains-project-owned"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Full Body"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "6b4b0288-3909-4184-ac21-64d4ff6f2c8d",
    "legacyIds": [
      "cable-chest-press"
    ],
    "id": "cable-chest-press",
    "name": "Cable Chest Press",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Cable",
    "aliases": [
      "Standing Cable Chest Press"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "push"
    ],
    "movementPatterns": [
      "horizontal_push"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "cable_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Cable_Chest_Press",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [
        "Shoulders",
        "Triceps"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "2735823a-2a0c-453a-97b3-1c1143f73df4",
    "legacyIds": [
      "dumbbell-chest-fly"
    ],
    "id": "dumbbell-chest-fly",
    "name": "Dumbbell Chest Fly",
    "day": "Push",
    "muscle": "Chest",
    "equipment": "Dumbbell",
    "aliases": [
      "Dumbbell Fly",
      "Dumbbell Flyes",
      "Flat Dumbbell Fly"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "push"
    ],
    "movementPatterns": [
      "horizontal_push"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "dumbbell",
        "role": "resistance"
      },
      {
        "equipmentId": "bench",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Dumbbell_Flyes",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Chest"
      ],
      "secondary": [],
      "stabilizer": [
        "Shoulders"
      ]
    }
  },
  {
    "canonicalId": "7bd126a3-ae15-40c7-9022-c86db7164bbc",
    "legacyIds": [
      "dumbbell-pullover"
    ],
    "id": "dumbbell-pullover",
    "name": "Dumbbell Pullover",
    "day": "Pull",
    "muscle": "Back / Chest",
    "equipment": "Dumbbell",
    "aliases": [
      "Bent-Arm Dumbbell Pullover",
      "DB Pullover"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "shoulder_extension"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "dumbbell",
        "role": "resistance"
      },
      {
        "equipmentId": "bench",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Bent-Arm_Dumbbell_Pullover",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Dumbbell weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [
        "Chest"
      ],
      "stabilizer": [
        "Triceps"
      ]
    }
  },
  {
    "canonicalId": "c24045d6-7940-4d41-9235-613e9dbbb03e",
    "legacyIds": [
      "dumbbell-floor-press"
    ],
    "id": "dumbbell-floor-press",
    "name": "Dumbbell Floor Press",
    "day": "Push",
    "muscle": "Chest / Triceps",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Floor Press"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "push"
    ],
    "movementPatterns": [
      "horizontal_push",
      "elbow_extension"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "dumbbell",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Dumbbell_Floor_Press",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "entered_load"
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [
        "Chest",
        "Shoulders"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "7d32114f-b311-4779-ab6c-66a1d853f218",
    "legacyIds": [
      "dip-machine"
    ],
    "id": "dip-machine",
    "name": "Dip Machine",
    "day": "Push",
    "muscle": "Triceps / Chest",
    "equipment": "Machine",
    "aliases": [
      "Seated Dip Machine",
      "Machine Dip",
      "Triceps Dip Machine"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "push"
    ],
    "movementPatterns": [
      "elbow_extension",
      "horizontal_push"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "selectorized_dip_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Dip_Machine",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [
        "Chest",
        "Shoulders"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "7f3b7f8c-5e83-40f4-a292-3e4a520c144a",
    "legacyIds": [
      "machine-biceps-curl"
    ],
    "id": "machine-biceps-curl",
    "name": "Machine Biceps Curl",
    "day": "Pull",
    "muscle": "Biceps",
    "equipment": "Machine",
    "aliases": [
      "Biceps Curl Machine",
      "Machine Bicep Curl"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "elbow_flexion"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "selectorized_curl_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Machine_Bicep_Curl",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Biceps"
      ],
      "secondary": [],
      "stabilizer": [
        "Forearms"
      ]
    }
  },
  {
    "canonicalId": "df2db845-a0db-4e72-8a4c-17c8d82fd856",
    "legacyIds": [
      "machine-triceps-extension"
    ],
    "id": "machine-triceps-extension",
    "name": "Machine Triceps Extension",
    "day": "Push",
    "muscle": "Triceps",
    "equipment": "Machine",
    "aliases": [
      "Triceps Extension Machine"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "push"
    ],
    "movementPatterns": [
      "elbow_extension"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "selectorized_triceps_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Machine_Triceps_Extension",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Triceps"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "fbfcb0b8-7e32-4149-89a9-01d5222e3dd8",
    "legacyIds": [
      "dumbbell-front-raise"
    ],
    "id": "dumbbell-front-raise",
    "name": "Dumbbell Front Raise",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Dumbbell",
    "aliases": [
      "DB Front Raise",
      "Front Dumbbell Raise"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "push"
    ],
    "movementPatterns": [
      "other"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "dumbbell",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Front_Dumbbell_Raise",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "c23dead5-dc07-4397-9695-8e46bfc7c5c5",
    "legacyIds": [
      "machine-lateral-raise"
    ],
    "id": "machine-lateral-raise",
    "name": "Machine Lateral Raise",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Machine",
    "aliases": [
      "Lateral Raise Machine",
      "Selectorized Lateral Raise"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "push"
    ],
    "movementPatterns": [
      "shoulder_abduction"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "selectorized_lateral_raise_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "356aade0-1c4c-4859-80c3-aaf0d70b65e3",
    "legacyIds": [
      "smith-machine-overhead-press"
    ],
    "id": "smith-machine-overhead-press",
    "name": "Smith Machine Overhead Press",
    "day": "Push",
    "muscle": "Shoulders",
    "equipment": "Smith Machine",
    "aliases": [
      "Smith Machine Shoulder Press",
      "Smith Shoulder Press"
    ],
    "family": null,
    "variantOf": "766bfd3e-b8c4-4b8e-aba6-1af3e1431aec",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "push"
    ],
    "movementPatterns": [
      "vertical_push"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "smith_machine",
        "role": "resistance"
      },
      {
        "equipmentId": "bench",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Smith_Machine_Overhead_Shoulder_Press",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Smith machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Shoulders"
      ],
      "secondary": [
        "Triceps"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "4f5681be-74cb-4cab-b104-9773299f6073",
    "legacyIds": [
      "plate-loaded-high-row"
    ],
    "id": "plate-loaded-high-row",
    "name": "Plate-Loaded High Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [
      "Leverage High Row",
      "Iso-Lateral High Row",
      "Hammer Strength High Row"
    ],
    "family": "plate-loaded-row",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "horizontal_pull"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "plate_loaded_row_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Leverage_High_Row",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [
        "Biceps"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "e6b99d0a-18e6-46a6-aae3-a5e9badd341b",
    "legacyIds": [
      "plate-loaded-low-row"
    ],
    "id": "plate-loaded-low-row",
    "name": "Plate-Loaded Low Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Machine",
    "aliases": [
      "Leverage Low Row",
      "Iso-Lateral Low Row",
      "Hammer Strength Low Row"
    ],
    "family": "plate-loaded-row",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "horizontal_pull"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "plate_loaded_row_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_side",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per side",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [
        "Biceps"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "7fbd6433-c9f1-4311-8b55-4803aefc9933",
    "legacyIds": [
      "single-arm-lat-pulldown"
    ],
    "id": "single-arm-lat-pulldown",
    "name": "Single-Arm Lat Pulldown",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Cable",
    "aliases": [
      "One-Arm Lat Pulldown",
      "One Arm Lat Pulldown",
      "Single Arm Cable Pulldown"
    ],
    "family": "lat-pulldown",
    "variantOf": "a1c6ea43-5c0f-4c82-ab3e-c984fcb16306",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "vertical_pull"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "cable_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [
        "Biceps"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "be95b20e-588f-4b5d-a44c-4df806e79798",
    "legacyIds": [
      "inverted-row"
    ],
    "id": "inverted-row",
    "name": "Inverted Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Bodyweight",
    "aliases": [
      "Body Row",
      "Australian Pull-Up"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "horizontal_pull"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "rack_or_bar",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Inverted_Row",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [
        "Biceps"
      ],
      "stabilizer": [
        "Core"
      ]
    }
  },
  {
    "canonicalId": "67e2fc5b-f97b-42b6-b064-af388b135115",
    "legacyIds": [
      "smith-machine-bent-over-row"
    ],
    "id": "smith-machine-bent-over-row",
    "name": "Smith Machine Bent-Over Row",
    "day": "Pull",
    "muscle": "Back",
    "equipment": "Smith Machine",
    "aliases": [
      "Smith Machine Row",
      "Smith Row"
    ],
    "family": null,
    "variantOf": "e5185176-05a3-4704-97fd-accb0ae5c3e7",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "horizontal_pull"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "smith_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Smith_Machine_Bent_Over_Row",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Smith machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Back"
      ],
      "secondary": [
        "Biceps"
      ],
      "stabilizer": [
        "Core"
      ]
    }
  },
  {
    "canonicalId": "e31d21c2-7861-4ac1-b127-b619f7d291f0",
    "legacyIds": [
      "standing-leg-curl"
    ],
    "id": "standing-leg-curl",
    "name": "Standing Leg Curl",
    "day": "Legs",
    "muscle": "Hamstrings",
    "equipment": "Machine",
    "aliases": [
      "Single-Leg Standing Curl",
      "Standing Hamstring Curl"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "knee_flexion"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "standing_leg_curl_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Standing_Leg_Curl",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "c4da1857-3f99-4655-87f0-699402e50e03",
    "legacyIds": [
      "single-leg-leg-extension"
    ],
    "id": "single-leg-leg-extension",
    "name": "Single-Leg Leg Extension",
    "day": "Legs",
    "muscle": "Quads",
    "equipment": "Machine",
    "aliases": [
      "Unilateral Leg Extension",
      "One-Leg Leg Extension"
    ],
    "family": null,
    "variantOf": "c22da607-8530-4bee-ac23-65f58bb682fe",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "knee_extension"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "selectorized_leg_extension",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "7561911b-4087-47a1-83f5-9fe1def2093b",
    "legacyIds": [
      "single-leg-seated-leg-curl"
    ],
    "id": "single-leg-seated-leg-curl",
    "name": "Single-Leg Seated Leg Curl",
    "day": "Legs",
    "muscle": "Hamstrings",
    "equipment": "Machine",
    "aliases": [
      "Unilateral Seated Leg Curl",
      "One-Leg Seated Curl"
    ],
    "family": null,
    "variantOf": "70427367-59ce-47bf-a86d-f65a7a033543",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "knee_flexion"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "selectorized_seated_leg_curl",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "27803211-c8f0-4210-9857-4fc4aeab039d",
    "legacyIds": [
      "glute-ham-raise"
    ],
    "id": "glute-ham-raise",
    "name": "Glute-Ham Raise",
    "day": "Legs",
    "muscle": "Hamstrings / Glutes",
    "equipment": "Machine",
    "aliases": [
      "GHR",
      "Glute Ham Developer Raise"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "knee_flexion",
      "hip_extension"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "glute_ham_developer",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Glute_Ham_Raise",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "reps_only",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "bodyweight_only"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": "unsupported_fraction",
      "ui": {
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [
        "Glutes",
        "Calves"
      ],
      "stabilizer": [
        "Core"
      ]
    }
  },
  {
    "canonicalId": "292eccd2-d34e-4b91-9e99-b655fee2bc01",
    "legacyIds": [
      "good-morning"
    ],
    "id": "good-morning",
    "name": "Good Morning",
    "day": "Legs",
    "muscle": "Hamstrings / Glutes",
    "equipment": "Barbell",
    "aliases": [
      "Barbell Good Morning"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "hinge"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "barbell",
        "role": "resistance"
      },
      {
        "equipmentId": "rack",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Good_Morning",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": [
        "Core"
      ]
    }
  },
  {
    "canonicalId": "3b1944c8-b9dc-48a0-85e8-98a41ddf7cef",
    "legacyIds": [
      "sumo-deadlift"
    ],
    "id": "sumo-deadlift",
    "name": "Sumo Deadlift",
    "day": "Other",
    "muscle": "Full Body",
    "equipment": "Barbell",
    "aliases": [
      "Wide-Stance Deadlift"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "full_body"
    ],
    "movementPatterns": [
      "hinge"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "barbell",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Sumo_Deadlift",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Total weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": true,
      "e1rmLoadBasis": "combined_external_load"
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings",
        "Glutes"
      ],
      "secondary": [
        "Quads",
        "Back"
      ],
      "stabilizer": [
        "Core",
        "Forearms"
      ]
    }
  },
  {
    "canonicalId": "873d7ad1-7c25-41e9-a80c-821bdcd0bc2e",
    "legacyIds": [
      "smith-machine-romanian-deadlift"
    ],
    "id": "smith-machine-romanian-deadlift",
    "name": "Smith Machine Romanian Deadlift",
    "day": "Legs",
    "muscle": "Hamstrings / Glutes",
    "equipment": "Smith Machine",
    "aliases": [
      "Smith Machine RDL",
      "Smith RDL"
    ],
    "family": null,
    "variantOf": "643ae68e-7243-4357-ac98-6ce1fb9703b7",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "hinge"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "smith_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Smith machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Hamstrings"
      ],
      "secondary": [
        "Glutes"
      ],
      "stabilizer": [
        "Core"
      ]
    }
  },
  {
    "canonicalId": "a8b31e87-3f30-4ea8-89ba-db6f9e5a872c",
    "legacyIds": [
      "smith-machine-split-squat"
    ],
    "id": "smith-machine-split-squat",
    "name": "Smith Machine Split Squat",
    "day": "Legs",
    "muscle": "Quads / Glutes",
    "equipment": "Smith Machine",
    "aliases": [
      "Smith Split Squat"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "lunge"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "smith_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Smith_Single-Leg_Split_Squat",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Smith machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes",
        "Hamstrings"
      ],
      "stabilizer": [
        "Calves"
      ]
    }
  },
  {
    "canonicalId": "d1c6bd5a-f193-4207-9e03-9a311d0813bc",
    "legacyIds": [
      "smith-machine-hip-thrust"
    ],
    "id": "smith-machine-hip-thrust",
    "name": "Smith Machine Hip Thrust",
    "day": "Legs",
    "muscle": "Glutes",
    "equipment": "Smith Machine",
    "aliases": [
      "Smith Hip Thrust"
    ],
    "family": null,
    "variantOf": "7492bccf-54b4-430b-a6b9-bb7d567952a1",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "hip_extension"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "smith_machine",
        "role": "resistance"
      },
      {
        "equipmentId": "bench",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Smith machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Glutes"
      ],
      "secondary": [
        "Hamstrings"
      ],
      "stabilizer": [
        "Core"
      ]
    }
  },
  {
    "canonicalId": "796289cd-eac0-4ec3-b569-4f5731a74eb0",
    "legacyIds": [
      "glute-drive-machine"
    ],
    "id": "glute-drive-machine",
    "name": "Glute Drive Machine",
    "day": "Legs",
    "muscle": "Glutes",
    "equipment": "Machine",
    "aliases": [
      "Hip Thrust Machine",
      "Machine Hip Thrust"
    ],
    "family": null,
    "variantOf": "7492bccf-54b4-430b-a6b9-bb7d567952a1",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "hip_extension"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "glute_drive_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Glutes"
      ],
      "secondary": [
        "Hamstrings"
      ],
      "stabilizer": [
        "Core"
      ]
    }
  },
  {
    "canonicalId": "b4eea2ad-81e8-4a93-9bfc-563884204cd4",
    "legacyIds": [
      "machine-glute-kickback"
    ],
    "id": "machine-glute-kickback",
    "name": "Machine Glute Kickback",
    "day": "Legs",
    "muscle": "Glutes",
    "equipment": "Machine",
    "aliases": [
      "Glute Kickback Machine",
      "Machine Hip Extension"
    ],
    "family": null,
    "variantOf": "7e0cb04c-b637-46b0-a97b-bbf11fc693e4",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "hip_extension"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "glute_kickback_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Glutes"
      ],
      "secondary": [
        "Hamstrings"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "c056e322-1298-4fd3-a934-02266e6133b4",
    "legacyIds": [
      "smith-machine-calf-raise"
    ],
    "id": "smith-machine-calf-raise",
    "name": "Smith Machine Calf Raise",
    "day": "Legs",
    "muscle": "Calves",
    "equipment": "Smith Machine",
    "aliases": [
      "Smith Calf Raise"
    ],
    "family": "calf-raise",
    "variantOf": "2a7b9098-26cd-4222-8ade-38d4e49baecc",
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs"
    ],
    "movementPatterns": [
      "calf_raise"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "smith_machine",
        "role": "resistance"
      },
      {
        "equipmentId": "calf_block",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Smith_Machine_Calf_Raise",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Smith machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Calves"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "18b80e62-4a20-4275-b87d-d1a4f4344df4",
    "legacyIds": [
      "cable-wood-chop"
    ],
    "id": "cable-wood-chop",
    "name": "Cable Wood Chop",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Cable",
    "aliases": [
      "Standing Cable Wood Chop",
      "Cable Woodchop"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "core"
    ],
    "movementPatterns": [
      "trunk_rotation"
    ],
    "mechanics": "compound",
    "equipmentRoles": [
      {
        "equipmentId": "cable_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Standing_Cable_Wood_Chop",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "asymmetric",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Stack weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [
        "Shoulders"
      ],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "9b0f4524-f54d-4b20-88ce-bea81b7707ef",
    "legacyIds": [
      "rotary-torso-machine"
    ],
    "id": "rotary-torso-machine",
    "name": "Rotary Torso Machine",
    "day": "Legs",
    "muscle": "Core",
    "equipment": "Machine",
    "aliases": [
      "Torso Rotation Machine",
      "Machine Torso Rotation"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "core"
    ],
    "movementPatterns": [
      "trunk_rotation"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "rotary_torso_machine",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "unilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "reps_per_side",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Machine weight",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps per side"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Core"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "fa1606ef-97f4-42cc-97e2-c52636755dad",
    "legacyIds": [
      "sled-push"
    ],
    "id": "sled-push",
    "name": "Sled Push",
    "day": "Other",
    "muscle": "Full Body",
    "equipment": "Sled",
    "aliases": [
      "Prowler Push"
    ],
    "family": "sled-work",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "full_body"
    ],
    "movementPatterns": [
      "locomotion"
    ],
    "mechanics": "mixed",
    "equipmentRoles": [
      {
        "equipmentId": "weighted_sled",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Sled_Push",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "load_distance",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Sled load",
        "loadUnit": "lb",
        "loadStep": 5,
        "distanceLabel": "Distance",
        "distanceUnit": "ft",
        "distanceStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Full Body"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "03b856c5-c1e1-49b5-80a7-c567199909b6",
    "legacyIds": [
      "backward-sled-drag"
    ],
    "id": "backward-sled-drag",
    "name": "Backward Sled Drag",
    "day": "Other",
    "muscle": "Quads",
    "equipment": "Sled",
    "aliases": [
      "Backward Drag",
      "Reverse Sled Drag"
    ],
    "family": "sled-work",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "legs",
      "full_body"
    ],
    "movementPatterns": [
      "locomotion"
    ],
    "mechanics": "mixed",
    "equipmentRoles": [
      {
        "equipmentId": "weighted_sled",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Backward_Drag",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "load_distance",
      "loadSemantics": {
        "loadBasis": "total",
        "resistanceSemantics": "machine_indicated"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Sled load",
        "loadUnit": "lb",
        "loadStep": 5,
        "distanceLabel": "Distance",
        "distanceUnit": "ft",
        "distanceStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Quads"
      ],
      "secondary": [
        "Glutes",
        "Hamstrings"
      ],
      "stabilizer": [
        "Core"
      ]
    }
  },
  {
    "canonicalId": "63ce5b42-a77d-4e17-8fde-992e99646d82",
    "legacyIds": [
      "air-bike"
    ],
    "id": "air-bike",
    "name": "Air Bike",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "Bike",
    "aliases": [
      "Assault Bike",
      "Fan Bike"
    ],
    "family": "ergometer",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "cardio",
    "programmingTags": [
      "cardio",
      "full_body"
    ],
    "movementPatterns": [
      "cyclic"
    ],
    "mechanics": "cyclic",
    "equipmentRoles": [
      {
        "equipmentId": "air_bike",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "fedb-Air_Bike",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "distance_duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "distanceLabel": "Distance",
        "distanceUnit": "mi",
        "distanceStep": 0.1,
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "38ed2c6d-9ff2-4bb5-9b08-108d9443cac6",
    "legacyIds": [
      "ski-erg"
    ],
    "id": "ski-erg",
    "name": "Ski Erg",
    "day": "Cardio",
    "muscle": "Cardio",
    "equipment": "Machine",
    "aliases": [
      "SkiErg",
      "Ski Ergometer"
    ],
    "family": "ergometer",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "cardio",
    "programmingTags": [
      "cardio",
      "full_body"
    ],
    "movementPatterns": [
      "cyclic"
    ],
    "mechanics": "cyclic",
    "equipmentRoles": [
      {
        "equipmentId": "ski_ergometer",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "distance_duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "distanceLabel": "Distance",
        "distanceUnit": "m",
        "distanceStep": 50,
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Cardio"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "872759cb-cc58-4fc9-ba84-9eb784d6c542",
    "legacyIds": [
      "battle-rope-waves"
    ],
    "id": "battle-rope-waves",
    "name": "Battle Rope Waves",
    "day": "Cardio",
    "muscle": "Full Body",
    "equipment": "Battle Rope",
    "aliases": [
      "Battle Ropes",
      "Rope Waves"
    ],
    "family": null,
    "variantOf": null,
    "contentRevision": 2,
    "modality": "cardio",
    "programmingTags": [
      "cardio",
      "full_body"
    ],
    "movementPatterns": [
      "other"
    ],
    "mechanics": "cyclic",
    "equipmentRoles": [
      {
        "equipmentId": "battle_rope",
        "role": "resistance"
      }
    ],
    "provenanceRefs": [
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "not_applicable",
    "measurement": {
      "trackingModel": "duration",
      "loadSemantics": {
        "loadBasis": "not_applicable",
        "resistanceSemantics": "not_applicable"
      },
      "repSemantics": "not_applicable",
      "bodyweightModel": null,
      "ui": {
        "durationLabel": "Duration",
        "durationUnit": "sec",
        "durationStep": 5
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Full Body"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "b078a32f-81ee-4455-ac88-e0eb75291840",
    "legacyIds": [
      "dumbbell-wrist-curl"
    ],
    "id": "dumbbell-wrist-curl",
    "name": "Dumbbell Wrist Curl",
    "day": "Pull",
    "muscle": "Forearms",
    "equipment": "Dumbbell",
    "aliases": [
      "Palms-Up Dumbbell Wrist Curl",
      "DB Wrist Curl"
    ],
    "family": "wrist-curl",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "other"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "dumbbell",
        "role": "resistance"
      },
      {
        "equipmentId": "bench",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Forearms"
      ],
      "secondary": [],
      "stabilizer": []
    }
  },
  {
    "canonicalId": "b5f7b82a-5463-4621-80ad-d869f50c0c86",
    "legacyIds": [
      "dumbbell-reverse-wrist-curl"
    ],
    "id": "dumbbell-reverse-wrist-curl",
    "name": "Dumbbell Reverse Wrist Curl",
    "day": "Pull",
    "muscle": "Forearms",
    "equipment": "Dumbbell",
    "aliases": [
      "Palms-Down Dumbbell Wrist Curl",
      "DB Reverse Wrist Curl"
    ],
    "family": "wrist-curl",
    "variantOf": null,
    "contentRevision": 2,
    "modality": "resistance",
    "programmingTags": [
      "pull"
    ],
    "movementPatterns": [
      "other"
    ],
    "mechanics": "isolation",
    "equipmentRoles": [
      {
        "equipmentId": "dumbbell",
        "role": "resistance"
      },
      {
        "equipmentId": "bench",
        "role": "support"
      }
    ],
    "provenanceRefs": [
      "fedb-Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench",
      "big-gains-ekf3-curation-v1"
    ],
    "rightsRefs": [
      "free-exercise-db-unlicense-b0eed061",
      "big-gains-project-owned-ekf3"
    ],
    "laterality": "independent_bilateral",
    "measurement": {
      "trackingModel": "load_reps",
      "loadSemantics": {
        "loadBasis": "per_hand",
        "resistanceSemantics": "external"
      },
      "repSemantics": "bilateral_cycle",
      "bodyweightModel": null,
      "ui": {
        "loadLabel": "Weight per dumbbell",
        "loadUnit": "lb",
        "loadStep": 5,
        "repsLabel": "Reps"
      }
    },
    "analytics": {
      "e1rmPermitted": false,
      "e1rmLoadBasis": null
    },
    "muscleRoles": {
      "primary": [
        "Forearms"
      ],
      "secondary": [],
      "stabilizer": []
    }
  }
];
  const idForName = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const normalizeTerm = value => String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/\bdb\b/g, 'dumbbell').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };
  const exercises = Object.freeze(RECORDS.map(record => deepFreeze({
    id: record.id,
    name: record.name,
    day: record.day,
    muscle: record.muscle,
    equipment: record.equipment,
    aliases: [...record.aliases],
    family: record.family,
    variantOf: record.variantOf,
    canonicalId: record.canonicalId,
    contentRevision: record.contentRevision,
    modality: record.modality,
    programmingTags: record.programmingTags,
    movementPatterns: record.movementPatterns,
    mechanics: record.mechanics,
    equipmentRoles: record.equipmentRoles,
    provenanceRefs: record.provenanceRefs,
    rightsRefs: record.rightsRefs,
    laterality: record.laterality,
    measurement: { ...record.measurement, laterality: record.laterality, analytics: record.analytics, canonicalExerciseId: record.canonicalId, contentRevision: record.contentRevision },
    analytics: record.analytics,
    muscleRoles: record.muscleRoles
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
    if (typeof value.definitionId === 'string' && value.definitionId) return getById(value.definitionId);
    if (typeof value.id === 'string' && value.id) return getById(value.id);
    return resolve(value.name);
  };
  const measurementFor = value => definitionFor(value)?.measurement || null;
  const inputFieldsFor = value => {
    const measurement = measurementFor(value);
    if (!measurement) return deepFreeze([
      { name: 'weight', label: value?.equipment === 'Bodyweight' ? 'Added weight' : 'Weight', unit: 'lb', step: 5, mayBeZero: value?.equipment === 'Bodyweight' },
      { name: 'reps', label: 'Reps', unit: '', step: 1, mayBeZero: false }
    ]);
    const fields = [];
    const model = measurement.trackingModel;
    const ui = measurement.ui || {};
    if (['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(model)) fields.push({ name: 'weight', label: ui.loadLabel, unit: ui.loadUnit || 'lb', step: ui.loadStep || 5, mayBeZero: ui.loadMayBeZero === true });
    if (['load_reps', 'reps_only', 'assistance_reps'].includes(model)) fields.push({ name: 'reps', label: ui.repsLabel || 'Reps', unit: '', step: 1, mayBeZero: false });
    if (['distance_duration', 'load_distance', 'distance_only'].includes(model)) fields.push({ name: 'distance', label: ui.distanceLabel || 'Distance', unit: ui.distanceUnit || '', step: ui.distanceStep || 1, mayBeZero: false });
    if (['duration', 'distance_duration', 'load_duration'].includes(model)) fields.push({ name: 'duration', label: ui.durationLabel || 'Duration', unit: ui.durationUnit || 'sec', step: ui.durationStep || 5, mayBeZero: false });
    return deepFreeze(fields);
  };
  const loadModeFor = value => {
    const resistance = measurementFor(value)?.loadSemantics?.resistanceSemantics;
    if (resistance === 'bodyweight_only' || resistance === 'bodyweight_plus_external') return 'bodyweight';
    const definition = definitionFor(value);
    const equipment = definition?.equipment || (value && typeof value === 'object' ? value.equipment : '');
    return equipment === 'Bodyweight' ? 'bodyweight' : 'external';
  };
  const matchesSearch = (exercise, term) => {
    const normalized = normalizeTerm(term);
    return !normalized || normalizeTerm([exercise.name, ...exercise.aliases, exercise.muscle, exercise.equipment, ...exercise.programmingTags, ...exercise.movementPatterns].join(' ')).includes(normalized);
  };

  const api = Object.freeze({ canonicalIdFor, definitionFor, exercises, getById, idForName, inputFieldsFor, loadModeFor, matchesSearch, measurementFor, normalizeTerm, resolve });
  Object.defineProperty(scope, 'BigGainsExerciseIdentity', { configurable: false, enumerable: true, value: identityApi, writable: false });
  Object.defineProperty(scope, 'BigGainsExerciseCatalog', { configurable: false, enumerable: true, value: api, writable: false });
  Object.defineProperty(scope, 'bigGainsExerciseCatalog', { configurable: false, enumerable: true, value: api, writable: false });
})(typeof window === 'object' ? window : globalThis);
