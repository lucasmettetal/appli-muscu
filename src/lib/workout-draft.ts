import type { WorkoutExercise } from '../context/WorkoutContext';
import { scopedKey } from './profiles';

// ─── Brouillon de séance en cours ─────────────────────────────────────────────
// Une séance en cours n'est enregistrée définitivement qu'au moment de
// « Terminer la séance ». Pour éviter de tout perdre en quittant l'onglet ou en
// rafraîchissant, on sauvegarde en continu un brouillon dans le localStorage.
// Le brouillon est isolé par profil actif (cf. scopedKey).

const DRAFT_BASE = 'muscu_workout_draft';
const draftKey = () => scopedKey(DRAFT_BASE);

export interface WorkoutDraft {
  name: string;
  exercises: WorkoutExercise[];
  startedAt: number; // epoch ms — sert à reprendre le chrono
  updatedAt: number; // epoch ms — dernière modification
}

export function loadDraft(): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(draftKey());
    if (!raw) return null;

    const d = JSON.parse(raw) as Partial<WorkoutDraft>;
    if (!d || typeof d !== 'object' || !Array.isArray(d.exercises)) return null;

    return {
      name: typeof d.name === 'string' ? d.name : '',
      exercises: d.exercises as WorkoutExercise[],
      startedAt: Number.isFinite(d.startedAt) ? (d.startedAt as number) : Date.now(),
      updatedAt: Number.isFinite(d.updatedAt) ? (d.updatedAt as number) : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<WorkoutDraft, 'updatedAt'>): void {
  try {
    const payload: WorkoutDraft = { ...draft, updatedAt: Date.now() };
    localStorage.setItem(draftKey(), JSON.stringify(payload));
  } catch {
    // Quota dépassé ou localStorage indisponible : on ignore silencieusement.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(draftKey());
  } catch {
    // ignore
  }
}

// Un brouillon n'est « significatif » (donc digne d'être repris) que s'il
// contient au moins un exercice.
export function isDraftMeaningful(draft: WorkoutDraft | null): boolean {
  return !!draft && draft.exercises.length > 0;
}
