import type { Workout, Exercise } from '../context/WorkoutContext';
import { getExercisePR, getProgressionStatus, getExerciseHistory } from './pr-utils';

// ─── Sérialisation du contexte utilisateur ────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Résumé des N dernières séances (exercices + charges + RPE)
export function formatRecentWorkouts(
  workouts: Workout[],
  exercises: Exercise[],
  limit = 5,
): string {
  if (workouts.length === 0) return 'Aucune séance enregistrée.';

  const exerciseMap = new Map(exercises.map(e => [e.id, e.name]));
  const recent = workouts.slice(0, limit);

  return recent.map(w => {
    const lines: string[] = [`• ${w.name} (${fmtShort(w.date)})`];
    for (const ex of w.exercises) {
      const name = exerciseMap.get(ex.exerciseId) ?? ex.exerciseId;
      const validSets = ex.sets.filter(s => s.weight > 0 && s.reps > 0);
      if (validSets.length === 0) continue;
      const maxW   = Math.max(...validSets.map(s => s.weight));
      const avgRpe = ex.sets.filter(s => s.rpe !== undefined).reduce((a, s, _, arr) => a + (s.rpe ?? 0) / arr.length, 0);
      const rpeStr = avgRpe > 0 ? ` RPE ${avgRpe.toFixed(1)}` : '';
      lines.push(`  - ${name} : max ${maxW} kg × ${validSets.length} série(s)${rpeStr}`);
    }
    return lines.join('\n');
  }).join('\n');
}

const MAX_EXERCISES_IN_CONTEXT = 15;

// Exercices pratiqués, plafonnés, triés par date de dernier usage
function practicedExercises(workouts: Workout[], exercises: Exercise[]): Exercise[] {
  const lastSeen = new Map<string, number>();
  for (const w of workouts) {
    const t = new Date(w.date).getTime();
    for (const e of w.exercises) {
      if (!lastSeen.has(e.exerciseId) || lastSeen.get(e.exerciseId)! < t) {
        lastSeen.set(e.exerciseId, t);
      }
    }
  }
  return exercises
    .filter(e => lastSeen.has(e.id))
    .sort((a, b) => (lastSeen.get(b.id) ?? 0) - (lastSeen.get(a.id) ?? 0))
    .slice(0, MAX_EXERCISES_IN_CONTEXT);
}

// Résumé des records personnels pour les exercices pratiqués (max 15)
export function formatPRSummary(
  workouts: Workout[],
  exercises: Exercise[],
): string {
  const practiced = practicedExercises(workouts, exercises);
  if (practiced.length === 0) return 'Aucun record enregistré.';

  return practiced.map(ex => {
    const pr = getExercisePR(workouts, ex.id);
    if (!pr) return null;
    return `• ${ex.name} : ${pr.maxWeight} kg (${pr.maxWeightReps} reps) — 1RM estimé ${pr.estimated1RM} kg`;
  }).filter(Boolean).join('\n');
}

// Statuts de progression par exercice (max 15)
export function formatProgressionSummary(
  workouts: Workout[],
  exercises: Exercise[],
): string {
  const STATUS_FR: Record<string, string> = {
    positive:     'Progression positive',
    stable:       'Stable',
    stagnation:   'Stagnation possible',
    insufficient: 'Données insuffisantes',
  };

  const practiced = practicedExercises(workouts, exercises);
  if (practiced.length === 0) return 'Aucune donnée de progression.';

  return practiced.map(ex => {
    const history = getExerciseHistory(workouts, ex.id);
    const prog    = getProgressionStatus(history);
    return `• ${ex.name} : ${STATUS_FR[prog.status]}${prog.delta !== null ? ` (${prog.delta > 0 ? '+' : ''}${prog.delta}%)` : ''}`;
  }).filter(Boolean).join('\n');
}

// Statistiques générales
function buildGeneralStats(workouts: Workout[]): string {
  if (workouts.length === 0) return 'Aucune séance.';

  const totalSets = workouts.reduce((acc, w) => acc + w.exercises.reduce((a, e) => a + e.sets.length, 0), 0);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeek = workouts.filter(w => new Date(w.date).getTime() >= weekAgo).length;
  const firstDate = workouts[workouts.length - 1]?.date;
  const weeksSince = firstDate
    ? Math.max(1, Math.round((Date.now() - new Date(firstDate).getTime()) / (7 * 24 * 3600 * 1000)))
    : 1;
  const avgPerWeek = (workouts.length / weeksSince).toFixed(1);

  return [
    `Séances totales : ${workouts.length} (depuis le ${fmtDate(firstDate ?? new Date().toISOString())})`,
    `Fréquence moyenne : ${avgPerWeek} séance(s)/semaine`,
    `Cette semaine : ${thisWeek} séance(s)`,
    `Total séries effectuées : ${totalSets}`,
  ].join('\n');
}

// ─── Prompt système complet ───────────────────────────────────────────────────

export function buildSystemPrompt(workouts: Workout[], exercises: Exercise[]): string {
  return `Tu es un coach sportif personnel expert en musculation. Tu aides l'utilisateur à analyser ses performances, optimiser ses entraînements et progresser de façon intelligente.

Réponds toujours en français. Sois bienveillant et pratique, et base tes réponses sur les données réelles de l'utilisateur ci-dessous.

Format des réponses : va droit au but (une phrase d'intro maximum, pas de pavé). Utilise du Markdown aéré et lisible — titres courts (## ou ###), **gras** pour les points clés, listes à puces plutôt que de longs paragraphes. Termine par une seule question ou proposition si c'est utile.

═══ DONNÉES DE L'UTILISATEUR ═══

STATISTIQUES GÉNÉRALES
${buildGeneralStats(workouts)}

RECORDS PERSONNELS
${formatPRSummary(workouts, exercises)}

PROGRESSION PAR EXERCICE
${formatProgressionSummary(workouts, exercises)}

DERNIÈRES SÉANCES (5 plus récentes)
${formatRecentWorkouts(workouts, exercises, 5)}

═══════════════════════════════`;
}
