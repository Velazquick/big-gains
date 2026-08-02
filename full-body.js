(() => {
  const day = 'FullBody';
  const names = [
    'Seated Machine Chest Press',
    'Dumbbell Shoulder Press',
    'Lat Pulldown',
    'Triceps Pushdown',
    'Dumbbell Lateral Raise',
    'Hack Squat',
    'Leg Extension',
    'Standing Calf Raise'
  ];

  DEFAULT_ROUTINES[day] = {
    label: 'Full Body',
    exercises: names
  };

  const existingIds = new Set(EXERCISES.map(exercise => exercise.id));
  names.forEach(name => {
    const source = EXERCISES.find(exercise => exercise.name === name);
    if (source && !existingIds.has(source.id)) {
      EXERCISES.push({ ...source, day });
      existingIds.add(source.id);
    }
  });

  if (selectedDay === day) {
    renderLibrary();
  } else {
    renderSelectors();
  }
})();
