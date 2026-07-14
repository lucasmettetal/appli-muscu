import { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import type { Workout, Exercise } from '../context/WorkoutContext';
import { CATEGORY_LABEL } from '../lib/exercise-utils';

interface MuscleBreakdownCardProps {
  workouts: Workout[];
  exercises: Exercise[];
}

// Couleurs par groupe musculaire (barre + point).
const CATEGORY_COLOR: Record<string, string> = {
  chest: 'bg-rose-500',
  back: 'bg-blue-500',
  shoulders: 'bg-amber-500',
  arms: 'bg-violet-500',
  legs: 'bg-emerald-500',
  core: 'bg-orange-500',
  'full-body': 'bg-slate-500',
};

/**
 * Répartition des séries de la semaine par groupe musculaire (barres
 * horizontales). Widget signature des trackers type Hevy.
 */
export function MuscleBreakdownCard({ workouts, exercises }: MuscleBreakdownCardProps) {
  const { rows, totalSets } = useMemo(() => {
    const catById = new Map(exercises.map(e => [e.id, e.category]));
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const counts: Record<string, number> = {};

    for (const w of workouts) {
      if (new Date(w.date).getTime() < weekAgo) continue;
      for (const ex of w.exercises) {
        const cat = catById.get(ex.exerciseId);
        if (!cat) continue;
        counts[cat] = (counts[cat] || 0) + ex.sets.length;
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(counts)
      .map(([cat, sets]) => ({ cat, sets }))
      .sort((a, b) => b.sets - a.sets);

    return { rows: sorted, totalSets: total };
  }, [workouts, exercises]);

  const max = rows[0]?.sets ?? 1;

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 text-rose-600">
            <PieChart className="w-4 h-4" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">Groupes musculaires</h3>
        </div>
        <span className="text-xs text-gray-400">7 derniers jours</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Aucune série cette semaine. Lance une séance pour voir la répartition.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ cat, sets }) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {CATEGORY_LABEL[cat] ?? cat}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {sets} série{sets > 1 ? 's' : ''} · {Math.round((sets / totalSets) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${CATEGORY_COLOR[cat] ?? 'bg-gray-400'}`}
                  style={{ width: `${Math.max((sets / max) * 100, 6)}%`, transition: 'width 0.6s ease' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
