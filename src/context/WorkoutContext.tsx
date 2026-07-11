import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import exercisesData from '../data/exercises.json';
import { scopedKey } from '../lib/profiles';

export interface Exercise {
  id: string;
  name: string;
  nameEn?: string;
  category: 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full-body';
  muscleGroup: string;
  musclesPrimary: string[];
  musclesSecondary: string[];
  equipment: string[];
  type: 'compound' | 'isolation' | 'cardio' | 'plyometric' | 'mobility';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  unilateral: boolean;
  bodyweight: boolean;
  tags: string[];
  imageStart: string | null;
  imageEnd: string | null;
  custom?: boolean;
}

export interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
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

// ─── Format d'export / import ────────────────────────────────────────────────

export interface AppData {
  version: number;
  exportedAt: string;
  workouts: Workout[];
  customExercises: Exercise[];
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
  REST_DURATION:     'muscu_rest_duration',
  CLAUDE_KEY:        'muscu_claude_key',
} as const;

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
  workouts: Workout[];
  addExercise: (exercise: Omit<Exercise, 'id' | 'custom'>) => void;
  addWorkout: (workout: Omit<Workout, 'id'>) => void;
  updateWorkout: (id: string, workout: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  exportData: () => AppData;
  importData: (data: AppData) => ImportResult;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

const baseExercises = exercisesData.exercises as Exercise[];

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [customExercises, setCustomExercises] = useState<Exercise[]>(() =>
    safeJSONParse<Exercise[]>(scopedKey(STORAGE_KEYS.CUSTOM_EXERCISES), [])
  );

  const [workouts, setWorkouts] = useState<Workout[]>(() =>
    safeJSONParse<Workout[]>(scopedKey(STORAGE_KEYS.WORKOUTS), [])
  );

  useEffect(() => {
    localStorage.setItem(scopedKey(STORAGE_KEYS.CUSTOM_EXERCISES), JSON.stringify(customExercises));
  }, [customExercises]);

  useEffect(() => {
    localStorage.setItem(scopedKey(STORAGE_KEYS.WORKOUTS), JSON.stringify(workouts));
  }, [workouts]);

  const exercises: Exercise[] = [...baseExercises, ...customExercises];

  const addExercise = (exercise: Omit<Exercise, 'id' | 'custom'>) => {
    setCustomExercises(prev => [...prev, { ...exercise, id: crypto.randomUUID(), custom: true }]);
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

  const exportData = (): AppData => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts,
    customExercises,
    settings: {
      restDuration: safeJSONParse<number>(scopedKey(STORAGE_KEYS.REST_DURATION), 90),
    },
  });

  const importData = (data: AppData): ImportResult => {
    const validation = validateImport(data);
    if (!validation.success) return validation;

    setWorkouts(data.workouts);
    setCustomExercises(data.customExercises.map(e => ({ ...e, custom: true })));

    const rd = Number(data.settings?.restDuration);
    if (Number.isFinite(rd) && rd > 0) {
      localStorage.setItem(scopedKey(STORAGE_KEYS.REST_DURATION), String(rd));
    }

    return validation;
  };

  return (
    <WorkoutContext.Provider value={{
      exercises, workouts,
      addExercise, addWorkout, updateWorkout, deleteWorkout,
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
