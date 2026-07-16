import type { Workout, WorkoutSet } from '../context/WorkoutContext';

// ─── Formule Epley (1RM estimé) ──────────────────────────────────────────────
// Valide pour 1–10 reps. Au-delà, moins fiable.
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// Durée d'une série (secondes), 0 si la série n'est pas mesurée en durée.
function setDuration(set: WorkoutSet): number {
  return set.durationSeconds ?? 0;
}

// ─── Record d'un exercice ─────────────────────────────────────────────────────

export interface ExercisePR {
  exerciseId:        string;
  maxWeight:         number;   // charge la plus lourde soulevée
  maxWeightReps:     number;   // reps réalisées à cette charge
  estimated1RM:      number;   // meilleur 1RM estimé (Epley)
  maxVolume:         number;   // meilleur volume total en une séance (kg × reps)
  maxDuration:       number;   // meilleur maintien (secondes) — exercices en durée
  totalDuration:     number;   // meilleur cumul de durée en une séance (secondes)
  prDate:            string;   // date du PR de charge (ou du meilleur maintien)
}

export function getExercisePR(workouts: Workout[], exerciseId: string): ExercisePR | null {
  let maxWeight     = 0;
  let maxWeightReps = 0;
  let estimated1RM  = 0;
  let maxVolume     = 0;
  let maxDuration   = 0;
  let totalDuration = 0;
  let prDate        = '';

  for (const workout of workouts) {
    const ex = workout.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;

    // Volume de la séance (charge × reps)
    const sessionVolume = ex.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    if (sessionVolume > maxVolume) maxVolume = sessionVolume;

    // Cumul de durée de la séance (exercices en maintien)
    const sessionDuration = ex.sets.reduce((sum, s) => sum + setDuration(s), 0);
    if (sessionDuration > totalDuration) totalDuration = sessionDuration;

    for (const set of ex.sets) {
      // Meilleur maintien (durée)
      const dur = setDuration(set);
      if (dur > maxDuration) {
        maxDuration = dur;
        if (maxWeight === 0) prDate = workout.date; // date du record de durée si pas de charge
      }

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

  if (maxWeight === 0 && maxDuration === 0) return null;
  return { exerciseId, maxWeight, maxWeightReps, estimated1RM, maxVolume, maxDuration, totalDuration, prDate };
}

// ─── Détection de nouveaux PRs ────────────────────────────────────────────────

export type PRType = 'weight' | 'estimated1RM' | 'volume' | 'duration';

export interface NewPR {
  exerciseId:    string;
  exerciseName:  string;
  type:          PRType;
  value:         number;       // en kg (charge/1RM/volume) ou en secondes (durée)
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
    const weightSets   = sets.filter(s => s.weight > 0 && s.reps > 0);
    const durationSets = sets.filter(s => setDuration(s) > 0);
    if (weightSets.length === 0 && durationSets.length === 0) continue;

    const previous = getExercisePR(previousWorkouts, exerciseId);
    const name     = exerciseNames.get(exerciseId) ?? exerciseId;

    if (weightSets.length > 0) {
      // PR de charge
      const newMaxWeight = Math.max(...weightSets.map(s => s.weight));
      if (newMaxWeight > (previous?.maxWeight ?? 0)) {
        results.push({ exerciseId, exerciseName: name, type: 'weight', value: newMaxWeight, previousValue: previous?.maxWeight ?? 0 });
      }

      // PR 1RM estimé (seulement si pas déjà un PR de charge)
      const new1RM = Math.max(...weightSets.map(s => epley1RM(s.weight, s.reps)));
      if (new1RM > (previous?.estimated1RM ?? 0) && newMaxWeight <= (previous?.maxWeight ?? 0)) {
        results.push({ exerciseId, exerciseName: name, type: 'estimated1RM', value: new1RM, previousValue: previous?.estimated1RM ?? 0 });
      }

      // PR de volume
      const newVolume = weightSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      if (newVolume > (previous?.maxVolume ?? 0) && newMaxWeight <= (previous?.maxWeight ?? 0)) {
        results.push({ exerciseId, exerciseName: name, type: 'volume', value: newVolume, previousValue: previous?.maxVolume ?? 0 });
      }
    }

    // PR de durée (meilleur maintien) — exercices mesurés en secondes
    if (durationSets.length > 0) {
      const newMaxDuration = Math.max(...durationSets.map(setDuration));
      if (newMaxDuration > (previous?.maxDuration ?? 0)) {
        results.push({ exerciseId, exerciseName: name, type: 'duration', value: newMaxDuration, previousValue: previous?.maxDuration ?? 0 });
      }
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
  bestDuration: number;    // meilleur maintien de la séance (secondes)
  totalDuration: number;   // cumul de durée de la séance (secondes)
  setCount: number;
}

export function getExerciseHistory(workouts: Workout[], exerciseId: string): SessionSnapshot[] {
  const snapshots: SessionSnapshot[] = [];

  for (const workout of workouts) {
    const ex = workout.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;

    // Une série compte si elle porte un travail mesurable : charge×reps OU durée.
    const validSets = ex.sets.filter(s => (s.weight > 0 && s.reps > 0) || setDuration(s) > 0);
    if (validSets.length === 0) continue;

    const maxWeight  = Math.max(0, ...validSets.map(s => s.weight));
    const totalVolume = validSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

    // Meilleur set : celui avec le 1RM estimé le plus élevé
    const best = validSets.reduce((prev, curr) =>
      epley1RM(curr.weight, curr.reps) > epley1RM(prev.weight, prev.reps) ? curr : prev
    );
    const estimated1RM = epley1RM(best.weight, best.reps);

    const bestDuration  = Math.max(0, ...validSets.map(setDuration));
    const totalDuration = validSets.reduce((sum, s) => sum + setDuration(s), 0);

    snapshots.push({
      date: workout.date,
      maxWeight,
      bestSetWeight: best.weight,
      bestSetReps:   best.reps,
      totalVolume,
      estimated1RM,
      bestDuration,
      totalDuration,
      setCount: validSets.length,
    });
  }

  return snapshots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ─── Dernière performance (pré-remplissage) ──────────────────────────────────

export interface LastSet {
  weight: number;
  reps: number;
  durationSeconds?: number;
  side?: 'left' | 'right';
}

// Séries de la séance la plus récente contenant cet exercice (avec au moins une
// série valide). Sert à pré-remplir les charges/reps/durées lors d'une nouvelle séance.
export function getLastPerformance(workouts: Workout[], exerciseId: string): LastSet[] | null {
  const sorted = [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const w of sorted) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;
    const valid = ex.sets.filter(s => s.weight > 0 || s.reps > 0 || setDuration(s) > 0);
    if (valid.length > 0) return valid.map(s => ({ weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds, side: s.side }));
  }
  return null;
}

// ─── Statut de progression ────────────────────────────────────────────────────

export type ProgressionStatus = 'positive' | 'stable' | 'stagnation' | 'insufficient';

export interface ProgressionResult {
  status: ProgressionStatus;
  label: string;
  description: string;
  delta: number | null; // % de variation du 1RM entre les deux périodes
}

export function getProgressionStatus(
  history: SessionSnapshot[],
  metric: 'reps' | 'duration' = 'reps',
): ProgressionResult {
  if (history.length < 2) {
    return { status: 'insufficient', label: 'Pas assez de données', description: 'Au moins 2 séances sont nécessaires.', delta: null };
  }

  const isDuration = metric === 'duration';
  const valueOf = (s: SessionSnapshot) => (isDuration ? s.bestDuration : s.estimated1RM);
  const refLabel = isDuration ? 'le meilleur maintien' : 'le 1RM estimé';

  // On compare la dernière séance à la moyenne des 3 précédentes (ou moins)
  const last    = history[history.length - 1];
  const previous = history.slice(-4, -1); // jusqu'à 3 séances avant la dernière

  const avgPrev = previous.reduce((sum, s) => sum + valueOf(s), 0) / previous.length;
  const delta = avgPrev > 0 ? ((valueOf(last) - avgPrev) / avgPrev) * 100 : 0;
  const deltaRounded = Math.round(delta * 10) / 10;

  if (delta > 3) {
    return {
      status: 'positive',
      label: 'Progression positive',
      description: `+${deltaRounded}% sur ${refLabel} vs séances précédentes.`,
      delta: deltaRounded,
    };
  }
  if (delta < -3) {
    return {
      status: 'stagnation',
      label: 'Stagnation possible',
      description: `${deltaRounded}% sur ${refLabel}. Pense à ajuster la récupération ou l'intensité.`,
      delta: deltaRounded,
    };
  }
  return {
    status: 'stable',
    label: 'Stable',
    description: isDuration
      ? `Performances constantes (${deltaRounded > 0 ? '+' : ''}${deltaRounded}%). Vise 5 à 10 s de plus sur ton prochain maintien.`
      : `Performances constantes (${deltaRounded > 0 ? '+' : ''}${deltaRounded}%). Continue à surcharger progressivement.`,
    delta: deltaRounded,
  };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const PR_TYPE_LABEL: Record<PRType, string> = {
  weight:       'Nouveau record de charge',
  estimated1RM: 'Nouveau 1RM estimé',
  volume:       'Nouveau record de volume',
  duration:     'Nouveau record de maintien',
};

export const PR_TYPE_UNIT: Record<PRType, string> = {
  weight:       'kg',
  estimated1RM: 'kg (estimé)',
  volume:       'kg de volume',
  duration:     's',
};
