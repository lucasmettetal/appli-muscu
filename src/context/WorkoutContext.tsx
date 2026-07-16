import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import exercisesData from '../data/exercises.json';
import { scopedKey } from '../lib/profiles';
import { supabase } from '../lib/supabase';
import { fetchExerciseLibrary, legacyCanonicalId, localizeExerciseMedia, remapLegacyId } from '../lib/exercise-db';
import { useAuth } from './AuthContext';

export interface Exercise {
  id: string;
  name: string;
  nameFr?: string;
  nameEn?: string;
  aliases?: string[];
  category: 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full-body';
  muscleGroup: string;
  musclesPrimary: string[];
  musclesSecondary: string[];
  equipment: string[];
  type: 'compound' | 'isolation' | 'cardio' | 'plyometric' | 'mobility';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  unilateral: boolean;
  bodyweight: boolean;
  metric?: 'reps' | 'duration';
  tags: string[];
  searchTerms?: string[];
  imageStart: string | null;
  imageEnd: string | null;
  thumbnail?: string | null;
  instructions?: string[];
  instructionsFr?: string[];
  instructionsEn?: string[];
  force?: string | null;
  mechanic?: string | null;
  source?: 'free-exercise-db' | 'local';
  custom?: boolean;
}

export interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;                 // utilisé pour les exercices en répétitions
  durationSeconds?: number;     // utilisé pour les exercices en durée (maintiens)
  completed: boolean;
  side?: 'left' | 'right';
  rpe?: number;
  rir?: number;
  notes?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string;
  date: string;
  exercises: WorkoutExercise[];
  duration?: number;
  notes?: string;
}

export interface BodyWeight {
  id: string;
  date: string;   // ISO
  weight: number; // kg
  note?: string;
}

// ─── Programmes (modèles de séances réutilisables) ───────────────────────────

export interface ProgramExercise {
  exerciseId: string;
  sets: number;              // nombre de séries cible
  reps?: number;             // reps cible (exercices en répétitions)
  durationSeconds?: number;  // durée cible en secondes (exercices en durée)
  notes?: string;
}

export interface ProgramDay {
  id: string;
  name: string;
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  days: ProgramDay[];
  createdAt: string;
}

// ─── Format d'export / import ────────────────────────────────────────────────

export interface AppData {
  version: number;
  exportedAt: string;
  workouts: Workout[];
  customExercises: Exercise[];
  bodyWeights?: BodyWeight[];
  programs?: Program[];
  settings: {
    restDuration: number;
  };
}

export interface ImportResult {
  success: boolean;
  error?: string;
  stats?: { workouts: number; customExercises: number };
}

// ─── Helpers localStorage ─────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  WORKOUTS:          'muscu_workouts',
  CUSTOM_EXERCISES:  'muscu_custom_exercises',
  BODYWEIGHTS:       'muscu_bodyweights',
  PROGRAMS:          'muscu_programs',
  REST_DURATION:     'muscu_rest_duration',
  GEMINI_KEY:        'muscu_gemini_key',
} as const;

// Dédoublonnage : redirige les références d'exercices « legacy » (anciennes
// entrées locales) vers leur équivalent canonique de la banque, qui porte les
// images et la bonne métrique. Idempotent — s'applique sans risque à chaque
// chargement.
function migrateWorkoutRefs(workout: Workout): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map(ex => ({ ...ex, exerciseId: remapLegacyId(ex.exerciseId) })),
  };
}

function migrateProgramRefs(program: Program): Program {
  return {
    ...program,
    days: program.days.map(day => ({
      ...day,
      exercises: day.exercises.map(pe => ({ ...pe, exerciseId: remapLegacyId(pe.exerciseId) })),
    })),
  };
}

function safeJSONParse<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    console.warn(`[muscu] Données corrompues pour la clé "${key}", réinitialisation.`);
    return fallback;
  }
}

// ─── Validation de la structure d'import ─────────────────────────────────────

function validateImport(data: unknown): ImportResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { success: false, error: 'Le fichier n\'est pas un objet JSON valide.' };
  }

  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.workouts)) {
    return { success: false, error: 'Champ "workouts" manquant ou invalide.' };
  }
  if (!Array.isArray(d.customExercises)) {
    return { success: false, error: 'Champ "customExercises" manquant ou invalide.' };
  }

  // Validation minimale de chaque séance
  for (const w of d.workouts as unknown[]) {
    if (!w || typeof w !== 'object') {
      return { success: false, error: 'Une séance a un format invalide.' };
    }
    const workout = w as Record<string, unknown>;
    if (typeof workout.id !== 'string' || !workout.id) {
      return { success: false, error: 'Une séance n\'a pas de champ "id" valide.' };
    }
    if (typeof workout.name !== 'string') {
      return { success: false, error: 'Une séance n\'a pas de champ "name" valide.' };
    }
    if (typeof workout.date !== 'string') {
      return { success: false, error: 'Une séance n\'a pas de champ "date" valide.' };
    }
    if (!Array.isArray(workout.exercises)) {
      return { success: false, error: 'Une séance a un champ "exercises" invalide.' };
    }
  }

  // Validation minimale de chaque exercice personnalisé
  for (const e of d.customExercises as unknown[]) {
    if (!e || typeof e !== 'object') {
      return { success: false, error: 'Un exercice personnalisé a un format invalide.' };
    }
    const ex = e as Record<string, unknown>;
    if (typeof ex.id !== 'string' || !ex.id) {
      return { success: false, error: 'Un exercice personnalisé n\'a pas de champ "id" valide.' };
    }
    if (typeof ex.name !== 'string') {
      return { success: false, error: 'Un exercice personnalisé n\'a pas de champ "name" valide.' };
    }
  }

  return {
    success: true,
    stats: {
      workouts: (d.workouts as unknown[]).length,
      customExercises: (d.customExercises as unknown[]).length,
    },
  };
}

// ─── Contexte ─────────────────────────────────────────────────────────────────

interface WorkoutContextType {
  exercises: Exercise[];
  exerciseLibraryLoading: boolean;
  exerciseLibraryError: string | null;
  workouts: Workout[];
  bodyWeights: BodyWeight[];
  programs: Program[];
  addExercise: (exercise: Omit<Exercise, 'id' | 'custom'>) => void;
  addWorkout: (workout: Omit<Workout, 'id'>) => void;
  updateWorkout: (id: string, workout: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  addBodyWeight: (weight: number, date?: string, note?: string) => void;
  deleteBodyWeight: (id: string) => void;
  addProgram: (program: Omit<Program, 'id' | 'createdAt'>) => Program;
  updateProgram: (id: string, program: Partial<Program>) => void;
  deleteProgram: (id: string) => void;
  exportData: () => AppData;
  importData: (data: AppData) => ImportResult;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

const baseExercises = exercisesData.exercises as Exercise[];

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const { configured, session } = useAuth();
  // Id du compte cloud si connecté ; sinon null → persistance locale par profil.
  const cloudUserId = configured && session ? session.user.id : null;

  const [customExercises, setCustomExercises] = useState<Exercise[]>(() =>
    cloudUserId
      ? []
      : safeJSONParse<Exercise[]>(scopedKey(STORAGE_KEYS.CUSTOM_EXERCISES), []).map(localizeExerciseMedia)
  );

  const [workouts, setWorkouts] = useState<Workout[]>(() =>
    cloudUserId ? [] : safeJSONParse<Workout[]>(scopedKey(STORAGE_KEYS.WORKOUTS), []).map(migrateWorkoutRefs)
  );

  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>(() =>
    cloudUserId ? [] : safeJSONParse<BodyWeight[]>(scopedKey(STORAGE_KEYS.BODYWEIGHTS), [])
  );

  const [programs, setPrograms] = useState<Program[]>(() =>
    cloudUserId ? [] : safeJSONParse<Program[]>(scopedKey(STORAGE_KEYS.PROGRAMS), []).map(migrateProgramRefs)
  );

  const [libraryExercises, setLibraryExercises] = useState<Exercise[]>([]);
  const [exerciseLibraryLoading, setExerciseLibraryLoading] = useState(true);
  const [exerciseLibraryError, setExerciseLibraryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExerciseLibrary()
      .then(exercises => {
        if (!cancelled) setLibraryExercises(exercises);
      })
      .catch(error => {
        if (!cancelled) {
          setExerciseLibraryError(error instanceof Error ? error.message : 'Bibliothèque locale indisponible');
        }
      })
      .finally(() => {
        if (!cancelled) setExerciseLibraryLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // En mode cloud, on attend le premier chargement distant avant d'autoriser les
  // écritures cloud (pour ne pas écraser les données existantes avec du vide).
  const [cloudLoaded, setCloudLoaded] = useState<boolean>(!cloudUserId);

  // ─── Chargement + migration (mode cloud) ─────────────────────────────────────
  useEffect(() => {
    if (!cloudUserId || !supabase) return;
    let cancelled = false;

    (async () => {
      const { data: row } = await supabase!
        .from('user_data')
        .select('data')
        .eq('user_id', cloudUserId)
        .maybeSingle();
      if (cancelled) return;

      const cloud = (row?.data ?? {}) as {
        workouts?: Workout[];
        customExercises?: Exercise[];
        bodyWeights?: BodyWeight[];
        programs?: Program[];
      };
      const hasCloud =
        (cloud.workouts?.length ?? 0) > 0 ||
        (cloud.customExercises?.length ?? 0) > 0 ||
        (cloud.bodyWeights?.length ?? 0) > 0 ||
        (cloud.programs?.length ?? 0) > 0;

      if (hasCloud) {
        setWorkouts((cloud.workouts ?? []).map(migrateWorkoutRefs));
        setCustomExercises((cloud.customExercises ?? []).map(e => localizeExerciseMedia({ ...e, custom: true })));
        setBodyWeights(cloud.bodyWeights ?? []);
        setPrograms((cloud.programs ?? []).map(migrateProgramRefs));
      } else {
        // Aucune donnée cloud : migration des données locales (profil actif) vers le compte.
        const localWorkouts = safeJSONParse<Workout[]>(scopedKey(STORAGE_KEYS.WORKOUTS), []).map(migrateWorkoutRefs);
        const localCustom = safeJSONParse<Exercise[]>(scopedKey(STORAGE_KEYS.CUSTOM_EXERCISES), []);
        const localBodyWeights = safeJSONParse<BodyWeight[]>(scopedKey(STORAGE_KEYS.BODYWEIGHTS), []);
        const localPrograms = safeJSONParse<Program[]>(scopedKey(STORAGE_KEYS.PROGRAMS), []).map(migrateProgramRefs);
        if (localWorkouts.length > 0 || localCustom.length > 0 || localBodyWeights.length > 0 || localPrograms.length > 0) {
          setWorkouts(localWorkouts);
          setCustomExercises(localCustom.map(e => localizeExerciseMedia({ ...e, custom: true })));
          setBodyWeights(localBodyWeights);
          setPrograms(localPrograms);
          await supabase!
            .from('user_data')
            .upsert({ user_id: cloudUserId, data: { workouts: localWorkouts, customExercises: localCustom, bodyWeights: localBodyWeights, programs: localPrograms } });
        }
      }
      if (!cancelled) setCloudLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [cloudUserId]);

  // ─── Persistance locale (mode local uniquement) ──────────────────────────────
  useEffect(() => {
    if (cloudUserId) return;
    localStorage.setItem(scopedKey(STORAGE_KEYS.CUSTOM_EXERCISES), JSON.stringify(customExercises));
  }, [customExercises, cloudUserId]);

  useEffect(() => {
    if (cloudUserId) return;
    localStorage.setItem(scopedKey(STORAGE_KEYS.WORKOUTS), JSON.stringify(workouts));
  }, [workouts, cloudUserId]);

  useEffect(() => {
    if (cloudUserId) return;
    localStorage.setItem(scopedKey(STORAGE_KEYS.BODYWEIGHTS), JSON.stringify(bodyWeights));
  }, [bodyWeights, cloudUserId]);

  useEffect(() => {
    if (cloudUserId) return;
    localStorage.setItem(scopedKey(STORAGE_KEYS.PROGRAMS), JSON.stringify(programs));
  }, [programs, cloudUserId]);

  // ─── Persistance cloud (débounce) ────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!cloudUserId || !supabase || !cloudLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase!
        .from('user_data')
        .upsert({ user_id: cloudUserId, data: { workouts, customExercises, bodyWeights, programs } })
        .then(({ error }) => {
          if (error) console.warn('[muscu] Échec de la sauvegarde cloud :', error.message);
        });
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [workouts, customExercises, bodyWeights, programs, cloudUserId, cloudLoaded]);

  const referencedExerciseIds = useMemo(() => {
    const ids = new Set<string>();
    workouts.forEach(workout => workout.exercises.forEach(exercise => ids.add(exercise.exerciseId)));
    programs.forEach(program => program.days.forEach(day => day.exercises.forEach(exercise => ids.add(exercise.exerciseId))));
    return ids;
  }, [workouts, programs]);

  const exercises = useMemo<Exercise[]>(() => {
    const localizedBase = baseExercises.map(exercise => localizeExerciseMedia({ ...exercise, source: 'local' }));
    if (libraryExercises.length === 0) return [...localizedBase, ...customExercises];

    // Les exercices sans équivalent Free Exercise DB constituent la bibliothèque
    // complémentaire. Les anciennes entrées équivalentes ne sont ajoutées que si
    // un historique/programme les référence encore.
    const complementary = localizedBase.filter(exercise => !legacyCanonicalId(exercise.id));
    const legacyCompatibility = localizedBase.filter(exercise =>
      !!legacyCanonicalId(exercise.id) && referencedExerciseIds.has(exercise.id)
    );
    return [...libraryExercises, ...complementary, ...legacyCompatibility, ...customExercises];
  }, [libraryExercises, customExercises, referencedExerciseIds]);

  const addExercise = (exercise: Omit<Exercise, 'id' | 'custom'>) => {
    setCustomExercises(prev => [...prev, {
      ...exercise,
      id: `custom-${crypto.randomUUID()}`,
      source: 'local',
      custom: true,
    }]);
  };

  const addWorkout = (workout: Omit<Workout, 'id'>) => {
    setWorkouts(prev => [{ ...workout, id: crypto.randomUUID() }, ...prev]);
  };

  const updateWorkout = (id: string, updates: Partial<Workout>) => {
    setWorkouts(prev => prev.map(w => (w.id === id ? { ...w, ...updates } : w)));
  };

  const deleteWorkout = (id: string) => {
    setWorkouts(prev => prev.filter(w => w.id !== id));
  };

  const addBodyWeight = (weight: number, date?: string, note?: string) => {
    const entry: BodyWeight = {
      id: crypto.randomUUID(),
      date: date ?? new Date().toISOString(),
      weight,
      ...(note?.trim() ? { note: note.trim() } : {}),
    };
    setBodyWeights(prev => [...prev, entry]);
  };

  const deleteBodyWeight = (id: string) => {
    setBodyWeights(prev => prev.filter(b => b.id !== id));
  };

  const addProgram = (program: Omit<Program, 'id' | 'createdAt'>): Program => {
    const created: Program = { ...program, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setPrograms(prev => [created, ...prev]);
    return created;
  };

  const updateProgram = (id: string, updates: Partial<Program>) => {
    setPrograms(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deleteProgram = (id: string) => {
    setPrograms(prev => prev.filter(p => p.id !== id));
  };

  const exportData = (): AppData => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts,
    customExercises,
    bodyWeights,
    programs,
    settings: {
      restDuration: safeJSONParse<number>(scopedKey(STORAGE_KEYS.REST_DURATION), 90),
    },
  });

  const importData = (data: AppData): ImportResult => {
    const validation = validateImport(data);
    if (!validation.success) return validation;

    setWorkouts(data.workouts);
    setCustomExercises(data.customExercises.map(e => localizeExerciseMedia({ ...e, custom: true })));
    setBodyWeights(Array.isArray(data.bodyWeights) ? data.bodyWeights : []);
    setPrograms(Array.isArray(data.programs) ? data.programs : []);

    const rd = Number(data.settings?.restDuration);
    if (Number.isFinite(rd) && rd > 0) {
      localStorage.setItem(scopedKey(STORAGE_KEYS.REST_DURATION), String(rd));
    }

    return validation;
  };

  return (
    <WorkoutContext.Provider value={{
      exercises, exerciseLibraryLoading, exerciseLibraryError,
      workouts, bodyWeights, programs,
      addExercise, addWorkout, updateWorkout, deleteWorkout,
      addBodyWeight, deleteBodyWeight,
      addProgram, updateProgram, deleteProgram,
      exportData, importData,
    }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (context === undefined) throw new Error('useWorkout must be used within a WorkoutProvider');
  return context;
}
