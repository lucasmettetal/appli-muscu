import { describe, it, expect } from 'vitest';
import {
  epley1RM,
  getExercisePR,
  detectNewPRs,
  getExerciseHistory,
  getProgressionStatus,
  getProgressionSuggestion,
  getLastPerformance,
  type SessionSnapshot,
} from './pr-utils';
import type { Workout, WorkoutSet } from '../context/WorkoutContext';

// ─── Fabriques de fixtures ────────────────────────────────────────────────────

let setCounter = 0;
function mkSet(weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: `set-${setCounter++}`, weight, reps, completed: true, ...extra };
}

// Série en durée (maintien) : poids/reps à 0, durée en secondes.
function mkDurationSet(durationSeconds: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: `set-${setCounter++}`, weight: 0, reps: 0, durationSeconds, completed: true, ...extra };
}

let workoutCounter = 0;
function mkWorkout(
  date: string,
  exercises: Array<{ exerciseId: string; sets: WorkoutSet[] }>,
): Workout {
  return { id: `w-${workoutCounter++}`, name: 'Séance', date, exercises };
}

// ─── epley1RM ─────────────────────────────────────────────────────────────────

describe('epley1RM', () => {
  it('renvoie le poids tel quel pour 1 rep', () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  it('applique la formule Epley et arrondit', () => {
    // 100 * (1 + 5/30) = 116.66 -> 117
    expect(epley1RM(100, 5)).toBe(117);
    // 80 * (1 + 10/30) = 106.66 -> 107
    expect(epley1RM(80, 10)).toBe(107);
  });

  it('renvoie 0 pour des entrées invalides', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(-50, 5)).toBe(0);
  });
});

// ─── getExercisePR ────────────────────────────────────────────────────────────

describe('getExercisePR', () => {
  it('renvoie null si aucune série valide', () => {
    const workouts = [mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(0, 0)] }])];
    expect(getExercisePR(workouts, 'squat')).toBeNull();
  });

  it('renvoie null si l\'exercice n\'a jamais été pratiqué', () => {
    const workouts = [mkWorkout('2026-01-01', [{ exerciseId: 'bench', sets: [mkSet(50, 5)] }])];
    expect(getExercisePR(workouts, 'squat')).toBeNull();
  });

  it('identifie la charge max, ses reps, le 1RM et le volume', () => {
    const workouts = [
      mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(100, 5), mkSet(110, 3)] }]),
      mkWorkout('2026-01-08', [{ exerciseId: 'squat', sets: [mkSet(120, 2), mkSet(100, 8)] }]),
    ];
    const pr = getExercisePR(workouts, 'squat');
    expect(pr).not.toBeNull();
    expect(pr!.maxWeight).toBe(120);
    expect(pr!.maxWeightReps).toBe(2);
    expect(pr!.prDate).toBe('2026-01-08');
    // meilleur 1RM = max sur toutes les séries : 120x2 -> 128 (le plus élevé)
    expect(pr!.estimated1RM).toBe(epley1RM(120, 2)); // 128
    // meilleur volume de séance : séance 2 = 120*2 + 100*8 = 1040
    expect(pr!.maxVolume).toBe(1040);
  });

  it('garde le max de reps à charge égale', () => {
    const workouts = [
      mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }]),
      mkWorkout('2026-01-08', [{ exerciseId: 'squat', sets: [mkSet(100, 8)] }]),
    ];
    const pr = getExercisePR(workouts, 'squat');
    expect(pr!.maxWeight).toBe(100);
    expect(pr!.maxWeightReps).toBe(8);
  });

  it('identifie le meilleur maintien pour un exercice en durée (planche)', () => {
    const workouts = [
      mkWorkout('2026-01-01', [{ exerciseId: 'plank', sets: [mkDurationSet(30), mkDurationSet(30)] }]),
      mkWorkout('2026-01-08', [{ exerciseId: 'plank', sets: [mkDurationSet(45), mkDurationSet(40)] }]),
    ];
    const pr = getExercisePR(workouts, 'plank');
    expect(pr).not.toBeNull();
    expect(pr!.maxWeight).toBe(0);          // aucune charge : ce n'est pas un record de charge
    expect(pr!.maxDuration).toBe(45);        // meilleur maintien
    expect(pr!.totalDuration).toBe(85);      // meilleur cumul de séance (45 + 40)
    expect(pr!.prDate).toBe('2026-01-08');
  });
});

// ─── detectNewPRs ─────────────────────────────────────────────────────────────

describe('detectNewPRs', () => {
  const names = new Map([['squat', 'Squat']]);

  it('détecte un PR de charge', () => {
    const previous = [mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }])];
    const next = { exercises: [{ exerciseId: 'squat', sets: [mkSet(110, 3)] }] };
    const prs = detectNewPRs(previous, next, names);
    const weightPR = prs.find(p => p.type === 'weight');
    expect(weightPR).toBeDefined();
    expect(weightPR!.value).toBe(110);
    expect(weightPR!.previousValue).toBe(100);
    expect(weightPR!.exerciseName).toBe('Squat');
  });

  it('ne signale pas de PR quand rien n\'est battu', () => {
    const previous = [mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(120, 5)] }])];
    const next = { exercises: [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }] };
    expect(detectNewPRs(previous, next, names)).toHaveLength(0);
  });

  it('signale un 1RM estimé sans PR de charge (plus de reps même poids)', () => {
    const previous = [mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }])];
    const next = { exercises: [{ exerciseId: 'squat', sets: [mkSet(100, 8)] }] };
    const prs = detectNewPRs(previous, next, names);
    expect(prs.some(p => p.type === 'weight')).toBe(false);
    expect(prs.some(p => p.type === 'estimated1RM')).toBe(true);
  });

  it('donne le nom de l\'exercice par défaut si absent de la map', () => {
    const previous: Workout[] = [];
    const next = { exercises: [{ exerciseId: 'unknown-id', sets: [mkSet(50, 5)] }] };
    const prs = detectNewPRs(previous, next, new Map());
    expect(prs[0].exerciseName).toBe('unknown-id');
  });

  it('ignore les séries invalides', () => {
    const previous: Workout[] = [];
    const next = { exercises: [{ exerciseId: 'squat', sets: [mkSet(0, 0)] }] };
    expect(detectNewPRs(previous, next, names)).toHaveLength(0);
  });

  it('détecte un record de maintien pour un exercice en durée', () => {
    const previous = [mkWorkout('2026-01-01', [{ exerciseId: 'plank', sets: [mkDurationSet(30)] }])];
    const next = { exercises: [{ exerciseId: 'plank', sets: [mkDurationSet(45)] }] };
    const prs = detectNewPRs(previous, next, new Map([['plank', 'Planche']]));
    const durationPR = prs.find(p => p.type === 'duration');
    expect(durationPR).toBeDefined();
    expect(durationPR!.value).toBe(45);
    expect(durationPR!.previousValue).toBe(30);
    // Un maintien ne produit jamais de record de charge/1RM.
    expect(prs.some(p => p.type === 'weight' || p.type === 'estimated1RM')).toBe(false);
  });
});

// ─── getExerciseHistory ───────────────────────────────────────────────────────

describe('getExerciseHistory', () => {
  it('trie les snapshots par date croissante', () => {
    const workouts = [
      mkWorkout('2026-03-01', [{ exerciseId: 'squat', sets: [mkSet(120, 5)] }]),
      mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }]),
      mkWorkout('2026-02-01', [{ exerciseId: 'squat', sets: [mkSet(110, 5)] }]),
    ];
    const history = getExerciseHistory(workouts, 'squat');
    expect(history.map(h => h.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('choisit le meilleur set par 1RM estimé', () => {
    const workouts = [
      mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(100, 5), mkSet(90, 12)] }]),
    ];
    const [snap] = getExerciseHistory(workouts, 'squat');
    // 90*12 -> 1RM 126 > 100*5 -> 117, donc bestSet = 90x12
    expect(snap.bestSetWeight).toBe(90);
    expect(snap.bestSetReps).toBe(12);
    expect(snap.maxWeight).toBe(100);
    expect(snap.totalVolume).toBe(100 * 5 + 90 * 12);
    expect(snap.setCount).toBe(2);
  });

  it('ignore les séances sans série valide', () => {
    const workouts = [mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(0, 5)] }])];
    expect(getExerciseHistory(workouts, 'squat')).toHaveLength(0);
  });
});

// ─── getProgressionStatus ─────────────────────────────────────────────────────

function snap(estimated1RM: number, date = '2026-01-01'): SessionSnapshot {
  return { date, maxWeight: 0, bestSetWeight: 0, bestSetReps: 0, totalVolume: 0, estimated1RM, bestDuration: 0, totalDuration: 0, setCount: 1 };
}

function durationSnap(bestDuration: number, date = '2026-01-01'): SessionSnapshot {
  return { date, maxWeight: 0, bestSetWeight: 0, bestSetReps: 0, totalVolume: 0, estimated1RM: 0, bestDuration, totalDuration: bestDuration, setCount: 1 };
}

describe('getProgressionStatus', () => {
  it('renvoie "insufficient" avec moins de 2 séances', () => {
    expect(getProgressionStatus([]).status).toBe('insufficient');
    expect(getProgressionStatus([snap(100)]).status).toBe('insufficient');
  });

  it('détecte une progression positive (> +3%)', () => {
    const history = [snap(100), snap(100), snap(100), snap(110)];
    const res = getProgressionStatus(history);
    expect(res.status).toBe('positive');
    expect(res.delta).toBe(10);
  });

  it('détecte une stagnation (< -3%)', () => {
    const history = [snap(100), snap(100), snap(100), snap(90)];
    const res = getProgressionStatus(history);
    expect(res.status).toBe('stagnation');
    expect(res.delta).toBe(-10);
  });

  it('renvoie "stable" dans la bande ±3%', () => {
    const history = [snap(100), snap(100), snap(100), snap(101)];
    expect(getProgressionStatus(history).status).toBe('stable');
  });

  it('ne compare qu\'aux 3 séances précédentes', () => {
    // les vieilles séances très basses ne doivent pas compter
    const history = [snap(10), snap(100), snap(100), snap(100), snap(103.5)];
    const res = getProgressionStatus(history);
    // moyenne des 3 précédentes = 100, dernière = 103.5 -> +3.5% -> positive
    expect(res.status).toBe('positive');
  });

  it('base la progression sur le maintien pour un exercice en durée', () => {
    // 1RM à 0 partout : sans le mode durée, on ne détecterait aucune progression.
    const history = [durationSnap(30), durationSnap(30), durationSnap(30), durationSnap(45)];
    const res = getProgressionStatus(history, 'duration');
    expect(res.status).toBe('positive');
    expect(res.delta).toBe(50);
    expect(res.description).toContain('maintien');
  });

  it('recommande d\'allonger le maintien quand la durée stagne', () => {
    const history = [durationSnap(30), durationSnap(30), durationSnap(30), durationSnap(30)];
    const res = getProgressionStatus(history, 'duration');
    expect(res.status).toBe('stable');
    expect(res.description).toMatch(/5 à 10 s/);
  });
});

// ─── getProgressionSuggestion ─────────────────────────────────────────────────

describe('getProgressionSuggestion', () => {
  it('renvoie null sans historique', () => {
    expect(getProgressionSuggestion([], 'squat')).toBeNull();
  });

  it('ajoute de la charge quand le plafond de reps est atteint', () => {
    const workouts = [mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(60, 12)] }])];
    const s = getProgressionSuggestion(workouts, 'squat');
    expect(s).toEqual({ type: 'weight', current: 60, suggested: 62.5, reps: 8 });
  });

  it('ajoute une répétition tant que le plafond n\'est pas atteint', () => {
    const workouts = [mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(60, 8)] }])];
    const s = getProgressionSuggestion(workouts, 'squat');
    expect(s).toEqual({ type: 'reps', current: 8, suggested: 9 });
  });

  it('allonge le maintien de 5 s pour un exercice en durée', () => {
    const workouts = [mkWorkout('2026-01-01', [{ exerciseId: 'plank', sets: [mkDurationSet(30)] }])];
    const s = getProgressionSuggestion(workouts, 'plank', 'duration');
    expect(s).toEqual({ type: 'duration', current: 30, suggested: 35 });
  });
});

// ─── getLastPerformance ───────────────────────────────────────────────────────

describe('getLastPerformance', () => {
  it('renvoie null si jamais pratiqué', () => {
    const workouts = [mkWorkout('2026-01-01', [{ exerciseId: 'bench', sets: [mkSet(50, 5)] }])];
    expect(getLastPerformance(workouts, 'squat')).toBeNull();
  });

  it('renvoie les séries de la séance la plus récente', () => {
    const workouts = [
      mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }]),
      mkWorkout('2026-02-01', [{ exerciseId: 'squat', sets: [mkSet(110, 5), mkSet(110, 4)] }]),
    ];
    expect(getLastPerformance(workouts, 'squat')).toEqual([
      { weight: 110, reps: 5 },
      { weight: 110, reps: 4 },
    ]);
  });

  it('ignore les séances sans série valide et remonte à la précédente', () => {
    const workouts = [
      mkWorkout('2026-01-01', [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }]),
      mkWorkout('2026-02-01', [{ exerciseId: 'squat', sets: [mkSet(0, 0)] }]),
    ];
    expect(getLastPerformance(workouts, 'squat')).toEqual([{ weight: 100, reps: 5 }]);
  });
});
