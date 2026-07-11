import { describe, it, expect } from 'vitest';
import {
  epley1RM,
  getExercisePR,
  detectNewPRs,
  getExerciseHistory,
  getProgressionStatus,
  type SessionSnapshot,
} from './pr-utils';
import type { Workout, WorkoutSet } from '../context/WorkoutContext';

// ─── Fabriques de fixtures ────────────────────────────────────────────────────

let setCounter = 0;
function mkSet(weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: `set-${setCounter++}`, weight, reps, completed: true, ...extra };
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
  return { date, maxWeight: 0, bestSetWeight: 0, bestSetReps: 0, totalVolume: 0, estimated1RM, setCount: 1 };
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
});
