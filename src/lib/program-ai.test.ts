import { describe, it, expect } from 'vitest';
import { parseProgramResponse, mockGenerateProgram } from './program-ai';
import type { Exercise } from '../context/WorkoutContext';

function ex(id: string, name: string, category: Exercise['category'], type: Exercise['type'] = 'compound'): Exercise {
  return {
    id, name, category, type, muscleGroup: category,
    musclesPrimary: [], musclesSecondary: [], equipment: [],
    difficulty: 'intermediate', unilateral: false, bodyweight: false,
    tags: [], imageStart: null, imageEnd: null,
  };
}

const catalog: Exercise[] = [
  ex('squat', 'Squat', 'legs'),
  ex('bench', 'Développé couché', 'chest'),
  ex('row', 'Rowing', 'back'),
  ex('curl', 'Curl biceps', 'arms', 'isolation'),
];

// ─── parseProgramResponse ─────────────────────────────────────────────────────

describe('parseProgramResponse', () => {
  it('parse un JSON valide', () => {
    const json = JSON.stringify({
      name: 'Full Body',
      description: '3 jours',
      days: [{ name: 'Jour A', exercises: [{ exerciseId: 'squat', sets: 5, reps: 5 }] }],
    });
    const prog = parseProgramResponse(json, catalog);
    expect(prog).not.toBeNull();
    expect(prog!.name).toBe('Full Body');
    expect(prog!.days[0].exercises[0]).toEqual({ exerciseId: 'squat', sets: 5, reps: 5 });
  });

  it('extrait le JSON même entouré de texte et de balises Markdown', () => {
    const text = 'Voici ton programme :\n```json\n' +
      JSON.stringify({ days: [{ name: 'J1', exercises: [{ exerciseId: 'bench', sets: 4 }] }] }) +
      '\n```\nBon entraînement !';
    const prog = parseProgramResponse(text, catalog);
    expect(prog).not.toBeNull();
    expect(prog!.days[0].exercises[0].exerciseId).toBe('bench');
  });

  it('filtre les exerciseId inconnus et supprime les jours vides', () => {
    const json = JSON.stringify({
      days: [
        { name: 'Valide', exercises: [{ exerciseId: 'squat', sets: 3 }, { exerciseId: 'inexistant', sets: 3 }] },
        { name: 'Vide', exercises: [{ exerciseId: 'inexistant', sets: 3 }] },
      ],
    });
    const prog = parseProgramResponse(json, catalog);
    expect(prog!.days).toHaveLength(1);
    expect(prog!.days[0].exercises).toHaveLength(1);
    expect(prog!.days[0].exercises[0].exerciseId).toBe('squat');
  });

  it('borne sets et reps dans des limites raisonnables', () => {
    const json = JSON.stringify({
      days: [{ name: 'J', exercises: [{ exerciseId: 'squat', sets: 99, reps: 999 }] }],
    });
    const prog = parseProgramResponse(json, catalog);
    expect(prog!.days[0].exercises[0].sets).toBe(10);
    expect(prog!.days[0].exercises[0].reps).toBe(30);
  });

  it('renvoie null si pas de JSON', () => {
    expect(parseProgramResponse('désolé, je ne peux pas', catalog)).toBeNull();
  });

  it('renvoie null si aucun exercice valide', () => {
    const json = JSON.stringify({ days: [{ name: 'J', exercises: [{ exerciseId: 'xxx', sets: 3 }] }] });
    expect(parseProgramResponse(json, catalog)).toBeNull();
  });
});

// ─── mockGenerateProgram ──────────────────────────────────────────────────────

describe('mockGenerateProgram', () => {
  it('génère le nombre de jours demandé avec des exerciseId valides', () => {
    const validIds = new Set(catalog.map(e => e.id));
    const prog = mockGenerateProgram('un programme sur 4 jours', catalog);
    expect(prog.days).toHaveLength(4);
    for (const day of prog.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
      for (const e of day.exercises) {
        expect(validIds.has(e.exerciseId)).toBe(true);
      }
    }
  });

  it('défaut à 3 jours sans nombre dans la demande', () => {
    expect(mockGenerateProgram('fais-moi un programme', catalog).days).toHaveLength(3);
  });
});
