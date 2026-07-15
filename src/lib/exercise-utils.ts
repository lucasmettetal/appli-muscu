import type { Exercise } from '../context/WorkoutContext';

export const EQUIPMENT_LABEL: Record<string, string> = {
  barbell:           'Barre',
  dumbbell:          'Haltères',
  cable:             'Poulie',
  machine:           'Machine',
  'pull-up-bar':     'Barre de traction',
  bench:             'Banc',
  'squat-rack':      'Rack / Cage',
  'dip-bar':         'Barres à dips',
  kettlebell:        'Kettlebell',
  'resistance-band': 'Élastique',
  'smith-machine':   'Machine Smith',
  bodyweight:        'Poids du corps',
  'body only':       'Poids du corps',
  bands:             'Élastiques',
  kettlebells:       'Kettlebells',
  'medicine ball':   'Médecine-ball',
  'exercise ball':   'Swiss ball',
  'e-z curl bar':    'Barre EZ',
  'foam roll':       'Rouleau de massage',
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  beginner:     'Débutant',
  intermediate: 'Intermédiaire',
  advanced:     'Avancé',
};

export const DIFFICULTY_STYLE: Record<string, string> = {
  beginner:     'bg-green-50 text-green-700',
  intermediate: 'bg-yellow-50 text-yellow-700',
  advanced:     'bg-red-50 text-red-700',
};

export const TYPE_LABEL: Record<string, string> = {
  compound:   'Polyarticulaire',
  isolation:  'Isolation',
  cardio:     'Cardio',
  plyometric: 'Pliométrique',
  mobility:   'Mobilité',
};

export const CATEGORY_LABEL: Record<string, string> = {
  chest:      'Pectoraux',
  back:       'Dos',
  shoulders:  'Épaules',
  arms:       'Bras',
  legs:       'Jambes',
  core:       'Abdominaux',
  'full-body':'Corps entier',
};

export function normalizeSearchText(text: string | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesExerciseSearch(
  exercise: Pick<Exercise, 'name' | 'nameEn' | 'muscleGroup' | 'musclesPrimary' | 'musclesSecondary' | 'equipment' | 'tags' | 'aliases' | 'searchTerms'>,
  term: string
): boolean {
  const query = normalizeSearchText(term.trim());
  if (!query) return true;

  const fields = [
    exercise.name,
    exercise.nameEn,
    exercise.muscleGroup,
    ...exercise.musclesPrimary,
    ...exercise.musclesSecondary,
    ...exercise.equipment,
    ...exercise.equipment.map(value => EQUIPMENT_LABEL[value] ?? value),
    ...exercise.tags,
    ...(exercise.aliases ?? []),
    ...(exercise.searchTerms ?? []),
  ];

  return fields.some(field => normalizeSearchText(field).includes(query));
}

export function formatExerciseTarget(value: number, metric: Exercise['metric'] = 'reps'): string {
  if (metric !== 'duration') return `${value} reps`;

  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${totalSeconds} s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} s`;
}

export function exerciseSetUnit(metric: Exercise['metric'] = 'reps'): string {
  return metric === 'duration' ? 'temps' : 'reps';
}
