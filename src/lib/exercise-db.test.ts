import { describe, expect, it } from 'vitest';
import type { ExerciseDbEntry } from './exercise-db';
import {
  imageUrl,
  legacyCanonicalId,
  mapDbEntry,
  remapLegacyId,
  thumbnailUrl,
} from './exercise-db';
import { matchesExerciseSearch, normalizeSearchText } from './exercise-utils';

const dumbbellBench: ExerciseDbEntry = {
  id: 'Dumbbell_Bench_Press',
  name: 'Dumbbell Bench Press',
  force: 'push',
  level: 'beginner',
  mechanic: 'compound',
  equipment: 'dumbbell',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  instructions: ['Lie on a flat bench.', 'Press the dumbbells upward.'],
  category: 'strength',
  images: ['Dumbbell_Bench_Press/0.jpg', 'Dumbbell_Bench_Press/1.jpg'],
};

describe('bibliothèque locale Free Exercise DB', () => {
  it('conserve l’identifiant original et fusionne la traduction séparée', () => {
    const exercise = mapDbEntry(dumbbellBench);

    expect(exercise.id).toBe('Dumbbell_Bench_Press');
    expect(exercise.name).toBe('Développé couché avec haltères');
    expect(exercise.nameEn).toBe('Dumbbell Bench Press');
    expect(exercise.instructionsEn).toEqual(dumbbellBench.instructions);
    expect(exercise.equipment).toEqual(['dumbbell']);
  });

  it.each([
    'developpe couche halteres',
    'développé   couché avec haltères',
    'dumbbell-bench-press',
    'db bench',
    'pectoraux',
  ])('retrouve le même exercice avec la recherche bilingue : %s', query => {
    expect(matchesExerciseSearch(mapDbEntry(dumbbellBench), query)).toBe(true);
  });

  it('normalise accents, tirets et espaces superflus', () => {
    expect(normalizeSearchText('  Développé---couché  ')).toBe('developpe couche');
  });

  it('sert les images depuis le CDN jsDelivr (approche hybride)', () => {
    expect(imageUrl('Dumbbell_Bench_Press/0.jpg'))
      .toBe('https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dumbbell_Bench_Press/0.jpg');
    // Faute de miniatures optimisées sur le CDN, on réutilise l'image.
    expect(thumbnailUrl('Dumbbell_Bench_Press/0.jpg')).toBe(imageUrl('Dumbbell_Bench_Press/0.jpg'));
  });

  it('maintient la correspondance des anciens identifiants', () => {
    expect(legacyCanonicalId('push-up')).toBe('Pushups');
    expect(legacyCanonicalId('bench-press-barbell')).toBe('Barbell_Bench_Press_-_Medium_Grip');
    // Gainage latéral : ancien exercice local redirigé vers la banque (avec image).
    expect(legacyCanonicalId('side-plank')).toBe('Side_Bridge');
  });

  it('redirige (remapLegacyId) les références legacy et laisse le reste intact', () => {
    expect(remapLegacyId('push-up')).toBe('Pushups');
    expect(remapLegacyId('side-plank')).toBe('Side_Bridge');
    expect(remapLegacyId('Pushups')).toBe('Pushups');             // déjà canonique → inchangé
    expect(remapLegacyId('scapular-push-up')).toBe('scapular-push-up'); // exercice maison unique → inchangé
  });

  it('classe les maintiens statiques en durée et les mouvements en répétitions', () => {
    const base: Omit<ExerciseDbEntry, 'id' | 'name' | 'force'> = {
      level: 'beginner', mechanic: 'isolation', equipment: 'body only',
      primaryMuscles: ['abdominals'], secondaryMuscles: [], instructions: [],
      category: 'strength', images: [],
    };

    // force "static" → durée (planche, gainage latéral, wall sit…)
    expect(mapDbEntry({ ...base, id: 'Plank', name: 'Plank', force: 'static' }).metric).toBe('duration');
    // nom de maintien sans terme de répétition → durée
    expect(mapDbEntry({ ...base, id: 'Wall_Sit', name: 'Wall Sit', force: null }).metric).toBe('duration');
    // vrais mouvements → répétitions, même en poids du corps
    expect(mapDbEntry({ ...base, id: 'Pushups', name: 'Pushups', force: 'push' }).metric).toBe('reps');
    expect(mapDbEntry({ ...base, id: 'Glute_Bridge', name: 'Glute Bridge', force: 'push' }).metric).toBe('reps');
    // "Superman Pull" contient un terme de répétition → reps (pas un maintien)
    expect(mapDbEntry({ ...base, id: 'Superman_Pull', name: 'Superman Pull', force: 'pull' }).metric).toBe('reps');
  });
});
