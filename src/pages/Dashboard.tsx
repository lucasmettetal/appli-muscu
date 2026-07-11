import { useMemo } from 'react';
import { useWorkout } from '../context/WorkoutContext';
import { getExercisePR } from '@/lib/pr-utils';
import { Calendar, Dumbbell, TrendingUp, Award, Trophy } from 'lucide-react';
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
    { label: 'Séances cette semaine', value: thisWeekWorkouts.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total séances', value: workouts.length, icon: Dumbbell, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Exercices dispo', value: exercises.length, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total séries', value: totalSets, icon: Award, color: 'text-orange-600', bg: 'bg-orange-50' },
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

      <Link
        to="/workout/new"
        className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-center transition-colors"
      >
        + Démarrer une séance
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-2`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Records récents */}
      {recentPRs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h3 className="text-base font-semibold text-gray-900">Records personnels</h3>
          </div>
          <div className="space-y-2">
            {recentPRs.map(pr => (
              <Link
                key={pr.exerciseId}
                to={`/exercise/${pr.exerciseId}`}
                className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-yellow-50 hover:border-yellow-200 border border-transparent transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{pr.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(pr.prDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {pr.maxWeightReps > 0 && ` · ${pr.maxWeightReps} reps`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-yellow-600">{pr.maxWeight} kg</p>
                  {pr.estimated1RM > 0 && (
                    <p className="text-xs text-gray-400">~{pr.estimated1RM} kg 1RM</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-gray-900">Séances récentes</h3>
          <Link to="/workouts" className="text-sm text-blue-600 hover:text-blue-700">
            Voir tout
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Dumbbell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucune séance enregistrée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.map(workout => (
              <Link
                key={workout.id}
                to={`/workout/${workout.id}`}
                className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm">{workout.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {workout.exercises.length} exercice(s) ·{' '}
                      {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)} série(s)
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(workout.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
