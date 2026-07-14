import { Target } from 'lucide-react';
import type { Workout } from '../context/WorkoutContext';

interface WeeklyGoalsCardProps {
  workouts: Workout[];
}

interface RingProps {
  value: number;
  max: number;
  color: string; // classe text-* pour la couleur de l'anneau
  label: string;
  display: string;
}

function Ring({ value, max, color, label, display }: RingProps) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[72px] h-[72px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-gray-100" />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className={color.replace('text-', 'stroke-')}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900 tabular-nums">
          {display}
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] font-semibold text-gray-700">{label}</div>
        <div className="text-[10px] text-gray-400 tabular-nums">
          {value}/{max}
        </div>
      </div>
    </div>
  );
}

/**
 * Objectifs hebdomadaires sous forme d'anneaux de progression. Inspiré de
 * l'Activity Card de 21st.dev (kokonutd), réimplémenté à la main.
 */
export function WeeklyGoalsCard({ workouts }: WeeklyGoalsCardProps) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = workouts.filter(w => new Date(w.date).getTime() >= weekAgo);

  const sessions = thisWeek.length;
  const sets = thisWeek.reduce(
    (sum, w) => sum + w.exercises.reduce((s, ex) => s + ex.sets.length, 0),
    0
  );
  const volume = thisWeek.reduce(
    (sum, w) =>
      sum +
      w.exercises.reduce(
        (s, ex) => s + ex.sets.reduce((v, set) => v + (set.weight || 0) * (set.reps || 0), 0),
        0
      ),
    0
  );

  // Objectifs cibles (valeurs par défaut, ajustables plus tard)
  const SESSION_GOAL = 4;
  const SET_GOAL = 60;
  const VOLUME_GOAL = 12000;

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-600">
          <Target className="w-4 h-4" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Objectifs de la semaine</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Ring value={sessions} max={SESSION_GOAL} color="text-blue-500" label="Séances" display={String(sessions)} />
        <Ring value={sets} max={SET_GOAL} color="text-emerald-500" label="Séries" display={String(sets)} />
        <Ring
          value={volume}
          max={VOLUME_GOAL}
          color="text-violet-500"
          label="Volume"
          display={`${Math.round(volume / 1000)}k`}
        />
      </div>
    </div>
  );
}
