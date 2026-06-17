import type { Workout } from '../context/WorkoutContext';

// ─── Formule Epley (1RM estimé) ──────────────────────────────────────────────
// Valide pour 1–10 reps. Au-delà, moins fiable.
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// ─── Record d'un exercice ─────────────────────────────────────────────────────

export interface ExercisePR {
  exerciseId:        string;
  maxWeight:         number;   // charge la plus lourde soulevée
  maxWeightReps:     number;   // reps réalisées à cette charge
  estimated1RM:      number;   // meilleur 1RM estimé (Epley)
  maxVolume:         number;   // meilleur volume total en une séance (kg × reps)
  prDate:            string;   // date du PR de charge
}

export function getExercisePR(workouts: Workout[], exerciseId: string): ExercisePR | null {
  let maxWeight     = 0;
  let maxWeightReps = 0;
  let estimated1RM  = 0;
  let maxVolume     = 0;
  let prDate        = '';

  for (const workout of workouts) {
    const ex = workout.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;

    // Volume de la séance
    const sessionVolume = ex.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    if (sessionVolume > maxVolume) maxVolume = sessionVolume;

    for (const set of ex.sets) {
      if (set.weight <= 0 || set.reps <= 0) continue;

      // 1RM estimé
      const e1rm = epley1RM(set.weight, set.reps);
      if (e1rm > estimated1RM) estimated1RM = e1rm;

      // Charge max
      if (set.weight > maxWeight) {
        maxWeight     = set.weight;
        maxWeightReps = set.reps;
        prDate        = workout.date;
      } else if (set.weight === maxWeight && set.reps > maxWeightReps) {
        maxWeightReps = set.reps;
      }
    }
  }

  if (maxWeight === 0) return null;
  return { exerciseId, maxWeight, maxWeightReps, estimated1RM, maxVolume, prDate };
}

// ─── Détection de nouveaux PRs ────────────────────────────────────────────────

export type PRType = 'weight' | 'estimated1RM' | 'volume';

export interface NewPR {
  exerciseId:    string;
  exerciseName:  string;
  type:          PRType;
  value:         number;
  previousValue: number;
}

export function detectNewPRs(
  previousWorkouts: Workout[],
  newWorkout: Pick<Workout, 'exercises'>,
  exerciseNames: Map<string, string>
): NewPR[] {
  const results: NewPR[] = [];

  for (const workoutEx of newWorkout.exercises) {
    const { exerciseId, sets } = workoutEx;
    const validSets = sets.filter(s => s.weight > 0 && s.reps > 0);
    if (validSets.length === 0) continue;

    const previous = getExercisePR(previousWorkouts, exerciseId);
    const name     = exerciseNames.get(exerciseId) ?? exerciseId;

    // PR de charge
    const newMaxWeight = Math.max(...validSets.map(s => s.weight));
    if (newMaxWeight > (previous?.maxWeight ?? 0)) {
      results.push({ exerciseId, exerciseName: name, type: 'weight', value: newMaxWeight, previousValue: previous?.maxWeight ?? 0 });
    }

    // PR 1RM estimé (seulement si pas déjà un PR de charge)
    const new1RM = Math.max(...validSets.map(s => epley1RM(s.weight, s.reps)));
    if (new1RM > (previous?.estimated1RM ?? 0) && newMaxWeight <= (previous?.maxWeight ?? 0)) {
      results.push({ exerciseId, exerciseName: name, type: 'estimated1RM', value: new1RM, previousValue: previous?.estimated1RM ?? 0 });
    }

    // PR de volume
    const newVolume = validSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    if (newVolume > (previous?.maxVolume ?? 0) && newMaxWeight <= (previous?.maxWeight ?? 0)) {
      results.push({ exerciseId, exerciseName: name, type: 'volume', value: newVolume, previousValue: previous?.maxVolume ?? 0 });
    }
  }

  return results;
}

// ─── Historique par séance ────────────────────────────────────────────────────

export interface SessionSnapshot {
  date: string;
  maxWeight: number;
  bestSetWeight: number;
  bestSetReps: number;
  totalVolume: number;
  estimated1RM: number;
  setCount: number;
}

export function getExerciseHistory(workouts: Workout[], exerciseId: string): SessionSnapshot[] {
  const snapshots: SessionSnapshot[] = [];

  for (const workout of workouts) {
    const ex = workout.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;

    const validSets = ex.sets.filter(s => s.weight > 0 && s.reps > 0);
    if (validSets.length === 0) continue;

    const maxWeight  = Math.max(...validSets.map(s => s.weight));
    const totalVolume = validSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

    // Meilleur set : celui avec le 1RM estimé le plus élevé
    const best = validSets.reduce((prev, curr) =>
      epley1RM(curr.weight, curr.reps) > epley1RM(prev.weight, prev.reps) ? curr : prev
    );
    const estimated1RM = epley1RM(best.weight, best.reps);

    snapshots.push({
      date: workout.date,
      maxWeight,
      bestSetWeight: best.weight,
      bestSetReps:   best.reps,
      totalVolume,
      estimated1RM,
      setCount: validSets.length,
    });
  }

  return snapshots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ─── Statut de progression ────────────────────────────────────────────────────

export type ProgressionStatus = 'positive' | 'stable' | 'stagnation' | 'insufficient';

export interface ProgressionResult {
  status: ProgressionStatus;
  label: string;
  description: string;
  delta: number | null; // % de variation du 1RM entre les deux périodes
}

export function getProgressionStatus(history: SessionSnapshot[]): ProgressionResult {
  if (history.length < 2) {
    return { status: 'insufficient', label: 'Pas assez de données', description: 'Au moins 2 séances sont nécessaires.', delta: null };
  }

  // On compare la dernière séance à la moyenne des 3 précédentes (ou moins)
  const last    = history[history.length - 1];
  const previous = history.slice(-4, -1); // jusqu'à 3 séances avant la dernière

  const avgPrev1RM = previous.reduce((sum, s) => sum + s.estimated1RM, 0) / previous.length;
  const delta = avgPrev1RM > 0 ? ((last.estimated1RM - avgPrev1RM) / avgPrev1RM) * 100 : 0;
  const deltaRounded = Math.round(delta * 10) / 10;

  if (delta > 3) {
    return {
      status: 'positive',
      label: 'Progression positive',
      description: `+${deltaRounded}% sur le 1RM estimé vs séances précédentes.`,
      delta: deltaRounded,
    };
  }
  if (delta < -3) {
    return {
      status: 'stagnation',
      label: 'Stagnation possible',
      description: `${deltaRounded}% sur le 1RM estimé. Pense à ajuster la récupération ou l'intensité.`,
      delta: deltaRounded,
    };
  }
  return {
    status: 'stable',
    label: 'Stable',
    description: `Performances constantes (${deltaRounded > 0 ? '+' : ''}${deltaRounded}%). Continue à surcharger progressivement.`,
    delta: deltaRounded,
  };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const PR_TYPE_LABEL: Record<PRType, string> = {
  weight:       'Nouveau record de charge',
  estimated1RM: 'Nouveau 1RM estimé',
  volume:       'Nouveau record de volume',
};

export const PR_TYPE_UNIT: Record<PRType, string> = {
  weight:       'kg',
  estimated1RM: 'kg (estimé)',
  volume:       'kg de volume',
};
