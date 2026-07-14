import { useMemo } from 'react';
import { useWorkout } from '../context/WorkoutContext';
import { getExercisePR } from '@/lib/pr-utils';
import { Calendar, Dumbbell, TrendingUp, Award, Trophy, Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { WorkoutDraftBanner } from '../components/WorkoutDraftBanner';

export function Dashboard() {
  const { workouts, exercises } = useWorkout();

  const thisWeekWorkouts = workouts.filter(w => {
    const workoutDate = new Date(w.date);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return workoutDate >= weekAgo;
  });

  const totalSets = workouts.reduce(
    (acc, w) => acc + w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    0
  );

  const stats = [
    { label: 'Séances cette semaine', value: thisWeekWorkouts.length, icon: Calendar,   gradient: 'from-blue-50',   chip: 'bg-blue-600 shadow-blue-600/25' },
    { label: 'Total séances',         value: workouts.length,          icon: Dumbbell,   gradient: 'from-emerald-50', chip: 'bg-emerald-500 shadow-emerald-500/25' },
    { label: 'Exercices dispo',       value: exercises.length,         icon: TrendingUp, gradient: 'from-violet-50',  chip: 'bg-violet-500 shadow-violet-500/25' },
    { label: 'Total séries',          value: totalSets,                icon: Award,      gradient: 'from-amber-50',   chip: 'bg-amber-500 shadow-amber-500/25' },
  ];

  const recentWorkouts = workouts.slice(0, 5);

  // Top PRs : exercices avec le meilleur record, triés par date du PR (les plus récents d'abord)
  const recentPRs = useMemo(() => {
    return exercises
      .map(ex => {
        const pr = getExercisePR(workouts, ex.id);
        return pr ? { name: ex.name, id: ex.id, ...pr } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => new Date(b.prDate).getTime() - new Date(a.prDate).getTime())
      .slice(0, 5);
  }, [workouts, exercises]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Tableau de bord</h2>
        <p className="text-gray-500 text-sm">Bienvenue dans ton suivi de musculation</p>
      </div>

      <WorkoutDraftBanner />

      {/* CTA démarrer une séance */}
      <Link
        to="/workout/new"
        className="flex items-center justify-center gap-2 w-full bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.99]"
      >
        <Plus className="w-5 h-5" />
        Démarrer une séance
      </Link>

      {/* Tuiles de stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`rounded-2xl border border-gray-100 bg-gradient-to-br ${stat.gradient} to-white p-4 shadow-sm transition-shadow hover:shadow-md`}
          >
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-white shadow-md ${stat.chip} mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Records personnels */}
      {recentPRs.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-50">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
              <Trophy className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Records personnels</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentPRs.map(pr => (
              <Link
                key={pr.exerciseId}
                to={`/exercise/${pr.exerciseId}`}
                className="flex justify-between items-center gap-3 px-4 py-3 hover:bg-amber-50/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{pr.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(pr.prDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {pr.maxWeightReps > 0 && ` · ${pr.maxWeightReps} reps`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-amber-600">{pr.maxWeight} kg</p>
                  {pr.estimated1RM > 0 && (
                    <p className="text-xs text-gray-400">~{pr.estimated1RM} kg 1RM</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Séances récentes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3.5 border-b border-gray-50">
          <h3 className="text-base font-semibold text-gray-900">Séances récentes</h3>
          <Link to="/workouts" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Voir tout
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Dumbbell className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">Aucune séance enregistrée</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentWorkouts.map(workout => (
              <Link
                key={workout.id}
                to={`/workout/${workout.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 text-sm truncate">{workout.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {workout.exercises.length} exercice(s) ·{' '}
                    {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)} série(s)
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(workout.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
