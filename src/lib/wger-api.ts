import type { Exercise } from '../context/WorkoutContext';

const BASE = 'https://wger.de/api/v2';

// ─── Types bruts wger ─────────────────────────────────────────────────────────

export interface WgerSuggestion {
  value: string;
  data: {
    id: number;       // translation id
    base_id: number;  // exercise id (stable, used for detail fetch)
    category: string;
    image: string | null;
    image_thumbnail: string | null;
  };
}

export interface WgerExerciseInfo {
  id: number;
  category: { id: number; name: string };
  muscles: Array<{ id: number; name_en: string; name: string }>;
  muscles_secondary: Array<{ id: number; name_en: string; name: string }>;
  equipment: Array<{ id: number; name: string }>;
  translations: Array<{ language: number; name: string; description: string }>;
}

// ─── Mapping wger → notre format ─────────────────────────────────────────────

const CATEGORY_MAP: Record<string, Exercise['category']> = {
  Abs:       'core',
  Arms:      'arms',
  Back:      'back',
  Calves:    'legs',
  Chest:     'chest',
  Legs:      'legs',
  Shoulders: 'shoulders',
};

const EQUIPMENT_MAP: Record<string, string> = {
  Barbell:       'barbell',
  'SZ-Bar':      'barbell',
  Dumbbell:      'dumbbell',
  Kettlebell:    'kettlebell',
  Cables:        'cable',
  Machine:       'machine',
  'Pull-up bar': 'pull-up-bar',
  'Body weight': 'bodyweight',
  Bench:         'bench',
};

export function mapWgerToExercise(
  info: WgerExerciseInfo,
  name: string,
): Omit<Exercise, 'id' | 'custom'> {
  const englishTranslation = info.translations.find(t => t.language === 2);
  const nameEn = englishTranslation?.name ?? name;

  const category: Exercise['category'] = CATEGORY_MAP[info.category?.name] ?? 'full-body';
  const muscleGroup = info.category?.name ?? '';

  const musclesPrimary   = info.muscles.map(m => m.name_en.toLowerCase());
  const musclesSecondary = info.muscles_secondary.map(m => m.name_en.toLowerCase());

  const equipment = info.equipment
    .map(e => EQUIPMENT_MAP[e.name])
    .filter((e): e is string => !!e);

  const isBodyweight = info.equipment.some(e => e.name === 'Body weight');

  return {
    name: nameEn,
    nameEn,
    category,
    muscleGroup,
    musclesPrimary,
    musclesSecondary,
    equipment: isBodyweight ? [] : equipment,
    type: musclesPrimary.length > 1 ? 'compound' : 'isolation',
    difficulty: 'intermediate',
    unilateral: false,
    bodyweight: isBodyweight,
    tags: [],
    imageStart: null,
    imageEnd: null,
  };
}

// ─── Appels API ───────────────────────────────────────────────────────────────

export async function searchWgerExercises(term: string): Promise<WgerSuggestion[]> {
  const url = `${BASE}/exercise/search/?term=${encodeURIComponent(term)}&language=english&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wger search error: ${res.status}`);
  const data = await res.json();
  return (data.suggestions ?? []) as WgerSuggestion[];
}

export async function fetchWgerExerciseInfo(baseId: number): Promise<WgerExerciseInfo> {
  const url = `${BASE}/exerciseinfo/${baseId}/?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wger detail error: ${res.status}`);
  return res.json();
}
