((scope) => {
  'use strict';

  const RAW = [
    ['Seated Machine Chest Press','Push','Chest','Machine'],['Seated Iso-Lateral Bench Press','Push','Chest','Machine',['Iso-Lateral Bench Press','Seated Iso Lateral Bench Press','Iso-Lateral Chest Press','Seated Iso-Lateral Chest Press']],['Incline Iso Machine Press','Push','Chest','Machine'],['Smith Machine Incline Press','Push','Chest','Smith Machine'],['Flat Smith Machine Bench Press','Push','Chest','Smith Machine',['Smith Machine Bench Press','Smith Bench']],['Barbell Bench Press','Push','Chest','Barbell',['Bench','Barbell Bench']],['Decline Barbell Bench Press','Push','Chest','Barbell',['Decline Bench Press','Decline Bench']],['Dumbbell Bench Press','Push','Chest','Dumbbell',['DB Bench']],['Incline Dumbbell Press','Push','Chest','Dumbbell',['DB Incline Press','Incline DB Press']],['Decline Dumbbell Press','Push','Chest','Dumbbell',['Decline DB Press']],['Cable Chest Fly','Push','Chest','Cable'],['Incline Cable Fly','Push','Chest','Cable',['Incline Cable Chest Fly']],['Seated Pec Deck','Push','Chest','Machine',['Pec Fly Machine','Pec Deck','Machine Pec Fly']],['Push-Up','Push','Chest','Bodyweight'],['Dips','Push','Chest / Triceps','Bodyweight'],['Assisted Dip','Push','Chest / Triceps','Machine',['Assisted Dips']],
    ['Iso Machine Shoulder Press','Push','Shoulders','Machine',['Iso Shoulder Press']],['Dumbbell Shoulder Press','Push','Shoulders','Dumbbell',['DB Shoulder Press']],['Barbell Overhead Press','Push','Shoulders','Barbell'],['Machine Shoulder Press','Push','Shoulders','Machine'],['Arnold Press','Push','Shoulders','Dumbbell',['Arnold Shoulder Press']],['Landmine Press','Push','Shoulders','Barbell',['Single-Arm Landmine Press']],['Dumbbell Lateral Raise','Push','Shoulders','Dumbbell',['DB Lat Raise','DB Lateral Raise']],['Cable Lateral Raise','Push','Shoulders','Cable',['Cable Lat Raise']],['Reverse Pec Deck','Pull','Rear Delts','Machine'],['Rear Delt Cable Fly','Pull','Rear Delts','Cable',['Cable Rear Delt Fly']],['Face Pull','Pull','Rear Delts','Cable',['Face Pulls']],
    ['Overhead Triceps Extension','Push','Triceps','Cable',['Overhead Tricep Extension']],['Triceps Pushdown','Push','Triceps','Cable'],['Rope Pushdown','Push','Triceps','Cable'],['Skull Crusher','Push','Triceps','EZ Bar'],['Close-Grip Bench Press','Push','Triceps','Barbell'],['Single-Arm Cable Extension','Push','Triceps','Cable'],['Cable Triceps Kickback','Push','Triceps','Cable',['Cable Tricep Kickback']],['Dumbbell Triceps Kickback','Push','Triceps','Dumbbell',['DB Tricep Kickback','Dumbbell Tricep Kickback']],
    ['Lat Pulldown','Pull','Back','Cable',[],'lat-pulldown'],['Wide-Grip Lat Pulldown','Pull','Back','Cable',['Wide Grip Pulldown'],'lat-pulldown'],['Neutral-Grip Lat Pulldown','Pull','Back','Cable',['Neutral Grip Pulldown'],'lat-pulldown'],['Iso-Lateral Pulldown Machine','Pull','Back','Machine',['Iso Lat Pull Machine','Iso Lat Pulldown Machine'],'lat-pulldown'],['Assisted Pull-Up','Pull','Back','Machine'],['Pull-Up','Pull','Back','Bodyweight',['Pull ups','Pullup','Pullups']],['Seated Cable Row','Pull','Back','Cable',['Cable Row']],['Close-Grip Seated Cable Row','Pull','Back','Cable',['Close Grip Cable Row']],['One-Arm Cable Row','Pull','Back','Cable',['Single-Arm Cable Row','Single Arm Cable Row']],['Chest-Supported Row','Pull','Back','Machine'],['T-Bar Row','Pull','Back','Machine'],['Chest-Supported T-Bar Row','Pull','Back','Machine',['Chest Supported T Bar Row']],['Barbell Row','Pull','Back','Barbell'],['Meadows Row','Pull','Back','Barbell'],['One-Arm Dumbbell Row','Pull','Back','Dumbbell'],['Iso-Lateral Row','Pull','Back','Machine',['One Arm Row Machine','One-Arm Row Machine','Iso Row Machine']],['Straight-Arm Pulldown','Pull','Back','Cable'],['Machine Pullover','Pull','Back','Machine'],['Rack Pull','Pull','Back','Barbell'],['Dumbbell Shrug','Pull','Traps','Dumbbell',['DB Shrug','DB Shrugs']],['Barbell Shrug','Pull','Traps','Barbell',['Barbell Shrugs']],
    ['Dumbbell Curl','Pull','Biceps','Dumbbell',['DB Curl','DB Curls']],['Hammer Curl','Pull','Biceps','Dumbbell',['Hammer Curls']],['Rope Hammer Curl','Pull','Biceps','Cable',['Rope Hammer Curls']],['Incline Dumbbell Curl','Pull','Biceps','Dumbbell'],['Preacher Curl','Pull','Biceps','EZ Bar'],['Machine Preacher Curl','Pull','Biceps','Machine'],['Spider Curl','Pull','Biceps','EZ Bar'],['Concentration Curl','Pull','Biceps','Dumbbell'],['Reverse Curl','Pull','Biceps','EZ Bar',['Reverse EZ-Bar Curl']],['Cable Curl','Pull','Biceps','Cable'],['Bayesian Cable Curl','Pull','Biceps','Cable'],['EZ-Bar Curl','Pull','Biceps','EZ Bar',['EZ Bar Curl','EZ Curl']],
    ['Back Squat','Legs','Quads / Glutes','Barbell',['Squat','Barbell Squat']],['Front Squat','Legs','Quads','Barbell',['Front Barbell Squat']],['Hack Squat','Legs','Quads / Glutes','Machine'],['Belt Squat','Legs','Quads / Glutes','Machine',['Belt Squat Machine']],['Pendulum Squat','Legs','Quads / Glutes','Machine',['Pendulum Squat Machine']],['V-Squat Machine','Legs','Quads / Glutes','Machine',['V Squat']],['Leg Press','Legs','Quads / Glutes','Machine'],['Single-Leg Press','Legs','Quads / Glutes','Machine',['Single Leg Press','Unilateral Leg Press']],['Smith Machine Squat','Legs','Quads / Glutes','Smith Machine'],['Goblet Squat','Legs','Quads / Glutes','Dumbbell'],['Bulgarian Split Squat','Legs','Quads / Glutes','Dumbbell'],['Walking Lunge','Legs','Quads / Glutes','Dumbbell'],['Reverse Lunge','Legs','Quads / Glutes','Dumbbell',['Reverse Lunges']],['Step-Up','Legs','Quads / Glutes','Dumbbell',['Step Up']],['Leg Extension','Legs','Quads','Machine'],
    ['Romanian Deadlift','Legs','Hamstrings / Glutes','Barbell',['RDL','Barbell RDL']],['Dumbbell Romanian Deadlift','Legs','Hamstrings / Glutes','Dumbbell'],['Seated Leg Curl','Legs','Hamstrings','Machine',['Leg Curl']],['Lying Leg Curl','Legs','Hamstrings','Machine'],['Nordic Hamstring Curl','Legs','Hamstrings','Bodyweight',['Nordic Curl']],['45-Degree Back Extension','Legs','Hamstrings / Glutes','Machine',['Back Extension','45 Degree Hyperextension']],['Hip Thrust','Legs','Glutes','Barbell'],['Glute Bridge','Legs','Glutes','Bodyweight'],['Cable Pull-Through','Legs','Glutes','Cable'],['Cable Glute Kickback','Legs','Glutes','Cable',['Glute Cable Kickback']],['Standing Calf Raise','Legs','Calves','Machine',[],'calf-raise'],['Seated Calf Raise','Legs','Calves','Machine',[],'calf-raise'],['Calf Press on Leg Press','Legs','Calves','Machine',['Calf Raise on Leg Press Machine','Calf Press','Leg Press Calf Raise'],'calf-raise'],['Hip Abductor','Legs','Glutes','Machine'],['Hip Adductor','Legs','Adductors','Machine',['Adductor Machine']],
    ['Cable Crunch','Legs','Core','Cable'],['Hanging Knee Raise','Legs','Core','Bodyweight'],['Hanging Leg Raise','Legs','Core','Bodyweight'],['Ab Wheel Rollout','Legs','Core','Bodyweight'],['Plank','Legs','Core','Bodyweight'],['Side Plank','Legs','Core','Bodyweight'],['Pallof Press','Legs','Core','Cable'],['Machine Crunch','Legs','Core','Machine'],['Russian Twist','Legs','Core','Bodyweight'],['Dead Bug','Legs','Core','Bodyweight'],
    ['Treadmill Run','Cardio','Cardio','Treadmill'],['Outdoor Run','Cardio','Cardio','None'],['Incline Walk','Cardio','Cardio','Treadmill'],['Stair Climber','Cardio','Cardio','Machine'],['Stationary Bike','Cardio','Cardio','Bike'],['Elliptical','Cardio','Cardio','Machine'],['Rowing Machine','Cardio','Cardio','Machine'],
    ['Deadlift','Other','Full Body','Barbell'],['Trap Bar Deadlift','Other','Full Body','Trap Bar'],['Farmer Carry','Other','Full Body','Dumbbell'],['Kettlebell Swing','Other','Full Body','Kettlebell']
  ];

  const idForName = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const normalizeTerm = value => String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/\bdb\b/g, 'dumbbell').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const exercises = Object.freeze(RAW.map(([name, day, muscle, equipment, aliases = [], family = null]) => Object.freeze({
    id: idForName(name),
    name,
    day,
    muscle,
    equipment,
    aliases: Object.freeze([...aliases]),
    family
  })));
  const exercisesById = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const getById = id => exercisesById.get(id) || null;
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
  const resolve = term => {
    const normalized = normalizeTerm(term);
    return exercises.find(exercise => normalizeTerm(exercise.name) === normalized || exercise.aliases.some(alias => normalizeTerm(alias) === normalized)) || null;
  };
  const matchesSearch = (exercise, term) => {
    const normalized = normalizeTerm(term);
    return !normalized || normalizeTerm([exercise.name, ...exercise.aliases, exercise.muscle, exercise.equipment].join(' ')).includes(normalized);
  };

  const api = Object.freeze({ exercises, getById, idForName, loadModeFor, matchesSearch, normalizeTerm, resolve });
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
