import { beforeEach, describe, it, expect } from 'vitest';
import { loadDraft, saveDraft, clearDraft, isDraftMeaningful } from './workout-draft';
import type { WorkoutExercise } from '../context/WorkoutContext';

// ─── Mock localStorage (env node de Vitest) ───────────────────────────────────

function mockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

beforeEach(() => {
  globalThis.localStorage = mockStorage();
});

const exercises: WorkoutExercise[] = [
  { exerciseId: 'squat', sets: [{ id: 's1', weight: 100, reps: 5, completed: true }] },
];

// ─── loadDraft / saveDraft ────────────────────────────────────────────────────

describe('workout-draft', () => {
  it('renvoie null quand aucun brouillon', () => {
    expect(loadDraft()).toBeNull();
  });

  it('sauvegarde puis recharge un brouillon (roundtrip)', () => {
    saveDraft({ name: 'Séance jambes', exercises, startedAt: 1000 });
    const d = loadDraft();
    expect(d).not.toBeNull();
    expect(d!.name).toBe('Séance jambes');
    expect(d!.exercises).toHaveLength(1);
    expect(d!.exercises[0].exerciseId).toBe('squat');
    expect(d!.startedAt).toBe(1000);
    expect(Number.isFinite(d!.updatedAt)).toBe(true);
  });

  it('clearDraft supprime le brouillon', () => {
    saveDraft({ name: 'X', exercises, startedAt: 1 });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it('renvoie null si le JSON est corrompu', () => {
    localStorage.setItem('muscu_workout_draft', '{pas du json');
    expect(loadDraft()).toBeNull();
  });

  it('renvoie null si la structure est invalide (exercises absent)', () => {
    localStorage.setItem('muscu_workout_draft', JSON.stringify({ name: 'X' }));
    expect(loadDraft()).toBeNull();
  });

  it('complète les champs manquants avec des valeurs par défaut', () => {
    localStorage.setItem('muscu_workout_draft', JSON.stringify({ exercises: [] }));
    const d = loadDraft();
    expect(d).not.toBeNull();
    expect(d!.name).toBe('');
    expect(Number.isFinite(d!.startedAt)).toBe(true);
  });
});

// ─── isDraftMeaningful ────────────────────────────────────────────────────────

describe('isDraftMeaningful', () => {
  it('false pour null ou brouillon sans exercice', () => {
    expect(isDraftMeaningful(null)).toBe(false);
    expect(isDraftMeaningful({ name: '', exercises: [], startedAt: 0, updatedAt: 0 })).toBe(false);
  });

  it('true dès qu\'il y a au moins un exercice', () => {
    expect(isDraftMeaningful({ name: '', exercises, startedAt: 0, updatedAt: 0 })).toBe(true);
  });
});
