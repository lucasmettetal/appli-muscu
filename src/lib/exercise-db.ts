import type { Exercise } from '../context/WorkoutContext';

// ─── Banque d'exercices (Free Exercise DB, MIT) ──────────────────────────────
// ~870 exercices avec 2 images (départ / fin) et des instructions (en anglais).
// Chargée à la demande depuis le CDN jsDelivr (pas embarquée → aucun impact au
// démarrage). Voir https://github.com/yuhonas/free-exercise-db

const DB_URL = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json';
const IMG_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';

export interface ExerciseDbEntry {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

// ─── Traductions FR (vocabulaire fixe → fiable) ──────────────────────────────

const MUSCLE_FR: Record<string, string> = {
  abdominals: 'Abdominaux', abductors: 'Abducteurs', adductors: 'Adducteurs',
  biceps: 'Biceps', calves: 'Mollets', chest: 'Pectoraux', forearms: 'Avant-bras',
  glutes: 'Fessiers', hamstrings: 'Ischio-jambiers', lats: 'Grand dorsal',
  'lower back': 'Bas du dos', 'middle back': 'Milieu du dos', neck: 'Cou',
  quadriceps: 'Quadriceps', shoulders: 'Épaules', traps: 'Trapèzes', triceps: 'Triceps',
};

const EQUIP_FR: Record<string, string> = {
  'body only': 'Poids du corps', machine: 'Machine', kettlebells: 'Kettlebell',
  dumbbell: 'Haltères', cable: 'Poulie', barbell: 'Barre', bands: 'Élastique',
  'medicine ball': 'Médecine ball', 'exercise ball': 'Swiss ball',
  'e-z curl bar': 'Barre EZ', 'foam roll': 'Rouleau', other: 'Autre',
};

const CATEGORY_BY_MUSCLE: Record<string, Exercise['category']> = {
  abdominals: 'core', chest: 'chest', shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back', neck: 'back',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
  abductors: 'legs', adductors: 'legs',
};

const frMuscle = (m: string) => MUSCLE_FR[m] ?? m;

// ─── Chargement (mémoire, une fois par session) ──────────────────────────────

let cache: ExerciseDbEntry[] | null = null;

export async function fetchExerciseDb(): Promise<ExerciseDbEntry[]> {
  if (cache) return cache;
  const res = await fetch(DB_URL);
  if (!res.ok) throw new Error(`Chargement de la banque impossible (${res.status})`);
  cache = (await res.json()) as ExerciseDbEntry[];
  return cache;
}

export function searchDb(all: ExerciseDbEntry[], term: string, limit = 40): ExerciseDbEntry[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  return all.filter(e => e.name.toLowerCase().includes(t)).slice(0, limit);
}

// Sous-titre FR pour l'aperçu dans la liste d'import (ex: « Pectoraux · Barre »).
export function entrySubtitle(e: ExerciseDbEntry): string {
  const muscle = frMuscle(e.primaryMuscles?.[0] ?? '');
  const equip = e.equipment ? EQUIP_FR[e.equipment] ?? e.equipment : '';
  return [muscle, equip].filter(Boolean).join(' · ');
}

// ─── Mapping banque → notre format Exercise ──────────────────────────────────

export function imageUrl(rel: string): string {
  return IMG_BASE + rel;
}

export function mapDbEntry(e: ExerciseDbEntry): Omit<Exercise, 'id' | 'custom'> {
  const primary = e.primaryMuscles ?? [];
  const category = CATEGORY_BY_MUSCLE[primary[0]] ?? 'full-body';

  return {
    name: e.name, // anglais (standard en muscu)
    nameEn: e.name,
    category,
    muscleGroup: frMuscle(primary[0] ?? ''),
    musclesPrimary: primary.map(frMuscle),
    musclesSecondary: (e.secondaryMuscles ?? []).map(frMuscle),
    equipment: e.equipment ? [EQUIP_FR[e.equipment] ?? e.equipment] : [],
    type: e.mechanic === 'compound' ? 'compound' : 'isolation',
    difficulty: e.level === 'beginner' ? 'beginner' : e.level === 'expert' ? 'advanced' : 'intermediate',
    unilateral: false,
    bodyweight: e.equipment === 'body only',
    tags: [],
    imageStart: e.images?.[0] ? imageUrl(e.images[0]) : null,
    imageEnd: e.images?.[1] ? imageUrl(e.images[1]) : e.images?.[0] ? imageUrl(e.images[0]) : null,
    instructions: e.instructions ?? [],
  };
}
