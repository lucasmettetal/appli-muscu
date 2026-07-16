import type { Workout, Exercise, WorkoutSet, BodyWeight } from '../context/WorkoutContext';
import { exerciseMetric } from './exercise-utils';

// Générateur de données de démonstration : ~4 semaines de séances réalistes
// avec progression, pour visualiser tous les widgets du dashboard « pleins ».
// Usage dev uniquement (bouton dans Réglages).

const BASE_WEIGHT: Record<string, number> = {
  chest: 40,
  back: 35,
  shoulders: 18,
  arms: 14,
  legs: 60,
  core: 10,
  'full-body': 30,
};

// Modèles de séances : catégories ciblées (nb d'exercices puisés par catégorie).
const TEMPLATES: { name: string; picks: [string, number][] }[] = [
  { name: 'Push (pecs / épaules / triceps)', picks: [['chest', 2], ['shoulders', 1], ['arms', 1]] },
  { name: 'Pull (dos / biceps)', picks: [['back', 2], ['arms', 1], ['core', 1]] },
  { name: 'Legs (jambes)', picks: [['legs', 3], ['core', 1]] },
  { name: 'Upper (haut du corps)', picks: [['chest', 1], ['back', 1], ['shoulders', 1], ['arms', 1]] },
];

function round(n: number, step = 2.5) {
  return Math.round(n / step) * step;
}

/**
 * Génère des séances de démo réparties sur les 4 dernières semaines (4
 * séances/semaine), avec une légère progression de charge semaine après semaine.
 */
export function generateDemoWorkouts(exercises: Exercise[]): Workout[] {
  const pool = exercises.filter(e => !e.custom);
  const byCat = (cat: string) => pool.filter(e => e.category === cat);

  const workouts: Workout[] = [];
  const WEEKS = 4;
  // Jours d'entraînement dans la semaine (offset depuis lundi).
  const trainingDays = [0, 2, 4, 5]; // lun, mer, ven, sam

  for (let week = WEEKS - 1; week >= 0; week--) {
    trainingDays.forEach((dayOffset, sessionIdx) => {
      const template = TEMPLATES[sessionIdx % TEMPLATES.length];

      // Date : on remonte de `week` semaines, puis on se cale sur le jour voulu.
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      d.setDate(d.getDate() - week * 7 - (6 - dayOffset));

      const chosen: Exercise[] = [];
      for (const [cat, n] of template.picks) {
        const candidates = byCat(cat);
        for (let i = 0; i < n && candidates.length > 0; i++) {
          chosen.push(candidates[(sessionIdx + i + week) % candidates.length]);
        }
      }

      const exercisesForWorkout = chosen.map(ex => {
        const isCompound = ex.type === 'compound';
        const isDuration = exerciseMetric(ex) === 'duration';
        const setCount = isCompound ? 4 : 3;
        const progression = (WEEKS - 1 - week) * 2.5; // + charge chaque semaine
        const base = (BASE_WEIGHT[ex.category] ?? 20) + progression;
        const durationBase = 25 + (WEEKS - 1 - week) * 5; // maintien allongé chaque semaine

        const sets: WorkoutSet[] = Array.from({ length: setCount }, (_, i) => isDuration
          ? {
              id: crypto.randomUUID(),
              weight: 0,
              reps: 0,
              durationSeconds: durationBase + i * 5,
              completed: true,
            }
          : {
              id: crypto.randomUUID(),
              weight: ex.bodyweight ? 0 : round(base + i * 2.5),
              reps: isCompound ? 8 + (i % 2) : 12,
              completed: true,
            });

        return { exerciseId: ex.id, sets };
      });

      workouts.push({
        id: crypto.randomUUID(),
        name: template.name,
        date: d.toISOString(),
        duration: 55 + ((week + sessionIdx) % 4) * 5,
        exercises: exercisesForWorkout,
      });
    });
  }

  // Plus récentes en premier (comme addWorkout qui préfixe).
  return workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Génère une série de pesées sur les 4 dernières semaines (légère tendance).
 */
export function generateDemoBodyWeights(): BodyWeight[] {
  const entries: BodyWeight[] = [];
  const start = 75.2;
  for (let i = 0; i < 8; i++) {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    d.setDate(d.getDate() - (28 - i * 4));
    entries.push({
      id: crypto.randomUUID(),
      date: d.toISOString(),
      weight: Math.round((start - i * 0.15 + (i % 2 === 0 ? 0.1 : -0.1)) * 10) / 10,
    });
  }
  return entries;
}
