import { Dumbbell, Layers, Weight, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Workout } from '../context/WorkoutContext';

interface WorkoutSummaryCardProps {
  workout: Workout;
}

/**
 * Carte « résumé de séance » : activité principale, stats détaillées et action
 * en en-tête. Inspirée du Workout Summary Card de 21st.dev, réimplémentée à la
 * main dans le style de l'app.
 */
export function WorkoutSummaryCard({ workout }: WorkoutSummaryCardProps) {
  const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  const totalVolume = workout.exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0),
    0
  );

  const dateLabel = new Date(workout.date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const stats = [
    { label: 'Exercices', value: workout.exercises.length, icon: Dumbbell },
    { label: 'Séries', value: totalSets, icon: Layers },
    { label: 'Volume', value: `${totalVolume.toLocaleString('fr-FR')} kg`, icon: Weight },
    ...(workout.duration
      ? [{ label: 'Durée', value: `${workout.duration} min`, icon: Clock }]
      : []),
  ];

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* En-tête coloré : activité principale + action */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-500 px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-blue-100">
              Dernière séance
            </p>
            <h3 className="text-lg font-bold truncate mt-0.5">{workout.name}</h3>
            <p className="text-xs text-blue-100 capitalize mt-0.5">{dateLabel}</p>
          </div>
          <Link
            to={`/workout/${workout.id}`}
            className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1.5 text-xs font-semibold transition-colors active:scale-95"
          >
            Voir
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Stats détaillées */}
      <div className={`grid ${stats.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} divide-x divide-gray-50`}>
        {stats.map(stat => (
          <div key={stat.label} className="px-2 py-3.5 text-center">
            <stat.icon className="w-4 h-4 mx-auto text-blue-500 mb-1.5" />
            <div className="text-sm font-bold text-gray-900 tabular-nums leading-none">
              {stat.value}
            </div>
            <div className="text-[11px] font-medium text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
