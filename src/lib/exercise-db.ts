import type { Exercise } from '../context/WorkoutContext';
import translationsData from '../data/exercise-translations.fr.json';
import { normalizeSearchText } from './exercise-utils';

// La base anglaise originale et les médias sont servis par Vite depuis `public`.
// BASE_URL garde les chemins valides si l'application est déployée sous un sous-chemin.
const BASE_URL = import.meta.env.BASE_URL || '/';
const DB_URL = staticUrl('data/free-exercise-db/exercises.json');

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

export interface ExerciseTranslation {
  nameFr?: string;
  instructionsFr?: string[];
  aliases?: string[];
  legacyIds?: string[];
}

const TRANSLATIONS = translationsData as Record<string, ExerciseTranslation>;

export const MUSCLE_LABEL: Record<string, string> = {
  abdominals: 'Abdominaux', abductors: 'Abducteurs', adductors: 'Adducteurs',
  biceps: 'Biceps', calves: 'Mollets', chest: 'Pectoraux', forearms: 'Avant-bras',
  glutes: 'Fessiers', hamstrings: 'Ischio-jambiers', lats: 'Grand dorsal',
  'lower back': 'Bas du dos', 'middle back': 'Milieu du dos', neck: 'Cou',
  quadriceps: 'Quadriceps', shoulders: 'Épaules', traps: 'Trapèzes', triceps: 'Triceps',
};

export const DB_EQUIPMENT_LABEL: Record<string, string> = {
  'body only': 'Poids du corps', machine: 'Machine', kettlebells: 'Kettlebells',
  dumbbell: 'Haltères', cable: 'Poulie', barbell: 'Barre', bands: 'Élastiques',
  'medicine ball': 'Médecine-ball', 'exercise ball': 'Swiss ball',
  'e-z curl bar': 'Barre EZ', 'foam roll': 'Rouleau de massage', other: 'Autre',
};

export const FORCE_LABEL: Record<string, string> = {
  push: 'Poussée', pull: 'Tirage', static: 'Statique',
};

export const MECHANIC_LABEL: Record<string, string> = {
  compound: 'Polyarticulaire', isolation: 'Isolation',
};

const CATEGORY_BY_MUSCLE: Record<string, Exercise['category']> = {
  abdominals: 'core', chest: 'chest', shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back', neck: 'back',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
  abductors: 'legs', adductors: 'legs',
};

function staticUrl(path: string): string {
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  const encoded = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${base}${encoded}`;
}

// Approche hybride : le JSON de la banque est servi en local (léger), mais les
// ~1 700 images sont chargées depuis le CDN gratuit jsDelivr — pas embarquées
// dans le dépôt (elles pèsent ~100 Mo). Chargement en lazy côté <img>.
const CDN_IMAGES = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';

export function imageUrl(relativePath: string): string {
  return `${CDN_IMAGES}${relativePath}`;
}

// Pas de miniatures optimisées sur le CDN : on réutilise l'image (lazy-load).
export function thumbnailUrl(relativePath: string): string {
  return imageUrl(relativePath);
}

export const exercisePlaceholderUrl = staticUrl('exercises/placeholder.svg');

export function formatMuscle(value: string): string {
  return MUSCLE_LABEL[value.toLowerCase()] ?? value;
}

export function formatEquipment(value: string): string {
  return DB_EQUIPMENT_LABEL[value.toLowerCase()] ?? value;
}

let cache: ExerciseDbEntry[] | null = null;

export async function fetchExerciseDb(): Promise<ExerciseDbEntry[]> {
  if (cache) return cache;
  const response = await fetch(DB_URL);
  if (!response.ok) throw new Error(`Chargement de la banque locale impossible (${response.status})`);
  cache = (await response.json()) as ExerciseDbEntry[];
  return cache;
}

export function mapDbEntry(entry: ExerciseDbEntry): Exercise {
  const translation = TRANSLATIONS[entry.id];
  const primary = entry.primaryMuscles ?? [];
  const instructionsEn = entry.instructions ?? [];
  const instructionsFr = translation?.instructionsFr;

  let type: Exercise['type'] = entry.mechanic === 'compound' ? 'compound' : 'isolation';
  if (entry.category === 'cardio') type = 'cardio';
  if (entry.category === 'stretching') type = 'mobility';
  if (entry.category === 'plyometrics') type = 'plyometric';

  return {
    id: entry.id,
    name: translation?.nameFr ?? entry.name,
    nameFr: translation?.nameFr,
    nameEn: entry.name,
    aliases: translation?.aliases ?? [],
    category: CATEGORY_BY_MUSCLE[primary[0]] ?? 'full-body',
    muscleGroup: primary[0] ?? '',
    musclesPrimary: primary,
    musclesSecondary: entry.secondaryMuscles ?? [],
    equipment: entry.equipment ? [entry.equipment] : [],
    type,
    difficulty: entry.level === 'beginner' ? 'beginner' : entry.level === 'expert' ? 'advanced' : 'intermediate',
    unilateral: /(?:one[- ]arm|one[- ]leg|single[- ]arm|single[- ]leg)/i.test(entry.name),
    bodyweight: entry.equipment === 'body only',
    metric: entry.force === 'static' ? 'duration' : 'reps',
    tags: [entry.category, entry.force, entry.mechanic].filter((value): value is string => !!value),
    searchTerms: [
      ...primary.map(formatMuscle),
      ...(entry.secondaryMuscles ?? []).map(formatMuscle),
      entry.equipment ? formatEquipment(entry.equipment) : '',
    ].filter(Boolean),
    imageStart: entry.images?.[0] ? imageUrl(entry.images[0]) : null,
    imageEnd: entry.images?.[1] ? imageUrl(entry.images[1]) : null,
    thumbnail: entry.images?.[0] ? thumbnailUrl(entry.images[0]) : null,
    instructions: instructionsFr ?? instructionsEn,
    instructionsFr,
    instructionsEn,
    force: entry.force,
    mechanic: entry.mechanic,
    source: 'free-exercise-db',
  };
}

export async function fetchExerciseLibrary(): Promise<Exercise[]> {
  return (await fetchExerciseDb()).map(mapDbEntry);
}

export function searchDb(all: ExerciseDbEntry[], term: string, limit = 40): ExerciseDbEntry[] {
  const query = normalizeSearchText(term);
  if (!query) return [];
  return all.filter(entry => {
    const translation = TRANSLATIONS[entry.id];
    const values = [
      entry.name,
      translation?.nameFr,
      ...(translation?.aliases ?? []),
      ...(entry.primaryMuscles ?? []).map(formatMuscle),
      ...(entry.secondaryMuscles ?? []).map(formatMuscle),
      entry.equipment ? formatEquipment(entry.equipment) : '',
    ];
    return values.some(value => normalizeSearchText(value).includes(query));
  }).slice(0, limit);
}

export function entrySubtitle(entry: ExerciseDbEntry): string {
  return [formatMuscle(entry.primaryMuscles?.[0] ?? ''), entry.equipment ? formatEquipment(entry.equipment) : '']
    .filter(Boolean)
    .join(' · ');
}

export function legacyCanonicalId(legacyId: string): string | undefined {
  return Object.entries(TRANSLATIONS)
    .find(([, translation]) => translation.legacyIds?.includes(legacyId))?.[0];
}

export function localizeExerciseMedia(exercise: Exercise): Exercise {
  const localize = (url: string | null): string | null => {
    if (url?.startsWith('free-exercise-db:')) return imageUrl(url.slice('free-exercise-db:'.length));
    if (!url || !/(?:cdn\.jsdelivr\.net|raw\.githubusercontent\.com|github\.com)/i.test(url)) return url;
    const match = url.match(/\/exercises\/(.+?\/[01]\.jpg)(?:[?#].*)?$/i);
    return match ? imageUrl(decodeURIComponent(match[1])) : url;
  };

  return {
    ...exercise,
    imageStart: localize(exercise.imageStart),
    imageEnd: localize(exercise.imageEnd),
  };
}
