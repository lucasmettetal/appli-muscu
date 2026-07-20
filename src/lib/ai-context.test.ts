import { describe, it, expect } from 'vitest';
import {
  formatRecentWorkouts,
  formatPRSummary,
  formatProgressionSummary,
  formatNextTargets,
  buildSystemPrompt,
} from './ai-context';
import type { Workout, Exercise, WorkoutSet } from '../context/WorkoutContext';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function mkExercise(id: string, name: string): Exercise {
  return {
    id, name, category: 'legs', muscleGroup: 'quads',
    musclesPrimary: [], musclesSecondary: [], equipment: [],
    type: 'compound', difficulty: 'intermediate',
    unilateral: false, bodyweight: false, tags: [],
    imageStart: null, imageEnd: null,
  };
}

let n = 0;
function mkSet(weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: `s-${n++}`, weight, reps, completed: true, ...extra };
}

function mkWorkout(date: string, name: string, exercises: Workout['exercises']): Workout {
  return { id: `w-${n++}`, name, date, exercises };
}

const squat = mkExercise('squat', 'Squat');
const bench = mkExercise('bench', 'Développé couché');
const exercises = [squat, bench];

// Exercice en durée (planche) pour vérifier que le contexte IA « voit » les maintiens.
const plank: Exercise = { ...mkExercise('plank', 'Planche'), metric: 'duration' };
const exercisesWithPlank = [squat, bench, plank];
const mkHold = (durationSeconds: number) => mkSet(0, 0, { durationSeconds });

// ─── formatRecentWorkouts ─────────────────────────────────────────────────────

describe('formatRecentWorkouts', () => {
  it('renvoie un message dédié sans séance', () => {
    expect(formatRecentWorkouts([], exercises)).toBe('Aucune séance enregistrée.');
  });

  it('résume les séances avec charge max et nombre de séries', () => {
    const workouts = [
      mkWorkout('2026-01-08', 'Jambes', [{ exerciseId: 'squat', sets: [mkSet(100, 5), mkSet(110, 3)] }]),
    ];
    const out = formatRecentWorkouts(workouts, exercises);
    expect(out).toContain('Jambes');
    expect(out).toContain('Squat');
    expect(out).toContain('max 110 kg');
    expect(out).toContain('2 série(s)');
  });

  it('inclut le RPE moyen quand présent', () => {
    const workouts = [
      mkWorkout('2026-01-08', 'Jambes', [
        { exerciseId: 'squat', sets: [mkSet(100, 5, { rpe: 8 }), mkSet(100, 5, { rpe: 9 })] },
      ]),
    ];
    expect(formatRecentWorkouts(workouts, exercises)).toContain('RPE 8.5');
  });

  it('respecte la limite du nombre de séances', () => {
    const workouts = Array.from({ length: 8 }, (_, i) =>
      mkWorkout(`2026-01-0${i + 1}`, `S${i}`, [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }]),
    );
    const out = formatRecentWorkouts(workouts, exercises, 3);
    // 3 lignes de titre "• S..." attendues
    expect(out.match(/• S/g)).toHaveLength(3);
  });

  it('ignore les exercices sans série valide', () => {
    const workouts = [
      mkWorkout('2026-01-08', 'Jambes', [{ exerciseId: 'squat', sets: [mkSet(0, 0)] }]),
    ];
    const out = formatRecentWorkouts(workouts, exercises);
    expect(out).toContain('Jambes');
    expect(out).not.toContain('Squat :');
  });

  it('résume les exercices en durée en secondes (pas en kg)', () => {
    const workouts = [
      mkWorkout('2026-01-08', 'Gainage', [{ exerciseId: 'plank', sets: [mkHold(30), mkHold(45)] }]),
    ];
    const out = formatRecentWorkouts(workouts, exercisesWithPlank);
    expect(out).toContain('Planche : maintien max 45 s × 2 série(s)');
    expect(out).not.toContain('kg');
  });
});

// ─── formatPRSummary ──────────────────────────────────────────────────────────

describe('formatPRSummary', () => {
  it('renvoie un message dédié sans record', () => {
    expect(formatPRSummary([], exercises)).toBe('Aucun record enregistré.');
  });

  it('liste les records des exercices pratiqués', () => {
    const workouts = [
      mkWorkout('2026-01-08', 'Jambes', [{ exerciseId: 'squat', sets: [mkSet(120, 3)] }]),
    ];
    const out = formatPRSummary(workouts, exercises);
    expect(out).toContain('Squat');
    expect(out).toContain('120 kg');
    expect(out).toContain('1RM estimé');
    // bench jamais pratiqué -> absent
    expect(out).not.toContain('Développé couché');
  });

  it('affiche le meilleur maintien pour un exercice en durée', () => {
    const workouts = [
      mkWorkout('2026-01-08', 'Gainage', [{ exerciseId: 'plank', sets: [mkHold(50)] }]),
    ];
    const out = formatPRSummary(workouts, exercisesWithPlank);
    expect(out).toContain('Planche : meilleur maintien 50 s');
    expect(out).not.toMatch(/Planche.*kg/);
  });
});

// ─── formatNextTargets ────────────────────────────────────────────────────────

describe('formatNextTargets', () => {
  it('propose un objectif chiffré par exercice pratiqué', () => {
    const workouts = [
      mkWorkout('2026-01-08', 'Jambes', [{ exerciseId: 'squat', sets: [mkSet(60, 8)] }]),
      mkWorkout('2026-01-09', 'Gainage', [{ exerciseId: 'plank', sets: [mkHold(30)] }]),
    ];
    const out = formatNextTargets(workouts, exercisesWithPlank);
    expect(out).toContain('Squat : viser 9 reps (actuel 8)');
    expect(out).toContain('Planche : viser 35 s (actuel 30 s)');
  });
});

// ─── formatProgressionSummary ─────────────────────────────────────────────────

describe('formatProgressionSummary', () => {
  it('renvoie un message dédié sans donnée', () => {
    expect(formatProgressionSummary([], exercises)).toBe('Aucune donnée de progression.');
  });

  it('affiche un statut par exercice pratiqué', () => {
    const workouts = [
      mkWorkout('2026-01-01', 'A', [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }]),
      mkWorkout('2026-01-08', 'B', [{ exerciseId: 'squat', sets: [mkSet(110, 5)] }]),
    ];
    const out = formatProgressionSummary(workouts, exercises);
    expect(out).toContain('Squat');
    expect(out).toMatch(/Progression positive|Stable|Stagnation|Données insuffisantes/);
  });
});

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('assemble toutes les sections attendues', () => {
    const workouts = [
      mkWorkout('2026-01-08', 'Jambes', [{ exerciseId: 'squat', sets: [mkSet(100, 5)] }]),
    ];
    const prompt = buildSystemPrompt(workouts, exercises);
    expect(prompt).toContain('coach sportif personnel');
    expect(prompt).toContain('STATISTIQUES GÉNÉRALES');
    expect(prompt).toContain('RECORDS PERSONNELS');
    expect(prompt).toContain('PROGRESSION PAR EXERCICE');
    expect(prompt).toContain('OBJECTIFS SUGGÉRÉS');
    expect(prompt).toContain('DERNIÈRES SÉANCES');
    expect(prompt).toContain('Séances totales : 1');
  });

  it('le mock détecte l\'absence de données via "Séances totales : 0"', () => {
    // buildSystemPrompt sur historique vide doit contenir le marqueur exploité par MockAIService
    const prompt = buildSystemPrompt([], exercises);
    expect(prompt).toContain('Aucune séance');
  });
});
