import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import type { Workout } from '../context/WorkoutContext';

interface StreakStripProps {
  workouts: Workout[];
}

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Bande de régularité : 7 derniers jours avec les jours entraînés mis en
 * évidence + compteur de « streak » (semaines actives récentes).
 */
export function StreakStrip({ workouts }: StreakStripProps) {
  const { days, weekCount } = useMemo(() => {
    const trained = new Set(workouts.map(w => dayKey(new Date(w.date))));

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return {
        key: dayKey(d),
        label: DAY_LABELS[d.getDay()],
        isToday: dayKey(d) === dayKey(new Date()),
        trained: trained.has(dayKey(d)),
      };
    });

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekCount = workouts.filter(w => new Date(w.date).getTime() >= weekAgo).length;

    return { days, weekCount };
  }, [workouts]);

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900">Régularité</h3>
        <div className="flex items-center gap-1 text-orange-500">
          <Flame className="w-4 h-4" />
          <span className="text-sm font-bold tabular-nums">{weekCount}</span>
          <span className="text-xs text-gray-400">cette sem.</span>
        </div>
      </div>
      <div className="flex justify-between gap-1.5">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className={`w-full aspect-square max-w-[36px] rounded-xl flex items-center justify-center text-xs font-bold transition-colors ${
                d.trained
                  ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30'
                  : d.isToday
                    ? 'bg-orange-50 text-orange-400 ring-1 ring-orange-200'
                    : 'bg-gray-50 text-gray-300'
              }`}
            >
              {d.trained ? <Flame className="w-4 h-4" /> : d.label}
            </div>
            <span className={`text-[10px] ${d.isToday ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
