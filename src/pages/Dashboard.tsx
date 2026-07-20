import { useMemo, lazy, Suspense } from 'react';
import { useWorkout } from '../context/WorkoutContext';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { getExercisePR } from '@/lib/pr-utils';
import { exerciseMetric, formatExerciseTarget } from '@/lib/exercise-utils';
import { Calendar, Dumbbell, TrendingUp, Award, Trophy, Plus, ChevronRight, Layers } from 'lucide-react';
import { Link } from 'react-router';
import { WorkoutDraftBanner } from '../components/WorkoutDraftBanner';
import { WorkoutSummaryCard } from '../components/WorkoutSummaryCard';
import { WeeklyGoalsCard } from '../components/WeeklyGoalsCard';
// recharts (~540 Ko) est isolé dans ce composant : on le charge en différé pour
// qu'il ne pèse pas sur le premier affichage du tableau de bord.
const TrendMetricCard = lazy(() =>
  import('../components/TrendMetricCard').then(m => ({ default: m.TrendMetricCard }))
);
import { MuscleBreakdownCard } from '../components/MuscleBreakdownCard';
import { StreakStrip } from '../components/StreakStrip';
import { CountUp } from '../components/CountUp';

export function Dashboard() {
  const { workouts, exercises } = useWorkout();
  const { activeProfile } = useProfile();
  const { configured, session, user } = useAuth();

  // Nom affiché : profil local, sinon préfixe de l'email en mode cloud.
  const displayName =
    configured && session
      ? (user?.email?.split('@')[0] ?? 'toi')
      : (activeProfile?.name ?? 'toi');

  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon aprem' : 'Bonsoir';
  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const avatarInitial = displayName.charAt(0).toUpperCase() || 'M';

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
    { label: 'Séances cette semaine', value: thisWeekWorkouts.length, icon: Calendar,   bg: 'bg-blue-50',    ring: 'ring-blue-100',    chip: 'bg-blue-600 shadow-blue-600/30' },
    { label: 'Total séances',         value: workouts.length,          icon: Dumbbell,   bg: 'bg-emerald-50', ring: 'ring-emerald-100', chip: 'bg-emerald-500 shadow-emerald-500/30' },
    { label: 'Exercices dispo',       value: exercises.length,         icon: TrendingUp, bg: 'bg-violet-50',  ring: 'ring-violet-100',  chip: 'bg-violet-500 shadow-violet-500/30' },
    { label: 'Total séries',          value: totalSets,                icon: Award,      bg: 'bg-amber-50',   ring: 'ring-amber-100',   chip: 'bg-amber-500 shadow-amber-500/30' },
  ];

  const recentWorkouts = workouts.slice(0, 5);

  // Tendances : 8 dernières séances, du plus ancien au plus récent (pour le graphe)
  const trend = useMemo(() => {
    const last = workouts.slice(0, 8).reverse();
    const volume = last.map(w =>
      w.exercises.reduce(
        (s, ex) => s + ex.sets.reduce((v, set) => v + (set.weight || 0) * (set.reps || 0), 0),
        0
      )
    );
    const sets = last.map(w => w.exercises.reduce((s, ex) => s + ex.sets.length, 0));
    return { volume, sets };
  }, [workouts]);

  const lastVolume = trend.volume[trend.volume.length - 1] ?? 0;
  const lastSets = trend.sets[trend.sets.length - 1] ?? 0;

  // Top PRs : exercices avec le meilleur record, triés par date du PR (les plus récents d'abord)
  const recentPRs = useMemo(() => {
    return exercises
      .map(ex => {
        const pr = getExercisePR(workouts, ex.id);
        return pr ? { name: ex.name, id: ex.id, metric: exerciseMetric(ex), ...pr } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => new Date(b.prDate).getTime() - new Date(a.prDate).getTime())
      .slice(0, 5);
  }, [workouts, exercises]);

  return (
    <div className="space-y-6 stagger-children">
      {/* En-tête app : salutation + avatar */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 capitalize">{todayLabel}</p>
          <h2 className="text-2xl font-bold text-gray-900 truncate">
            {greeting}, <span className="capitalize">{displayName}</span>
          </h2>
        </div>
        <div className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white text-lg font-bold shadow-md shadow-blue-600/20">
          {avatarInitial}
        </div>
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

      {/* Régularité (7 jours + streak) */}
      <StreakStrip workouts={workouts} />

      {/* Objectifs de la semaine (anneaux) */}
      <WeeklyGoalsCard workouts={workouts} />

      {/* Résumé de la dernière séance */}
      {recentWorkouts.length > 0 && <WorkoutSummaryCard workout={recentWorkouts[0]} />}

      {/* Tendances (KPI + mini-graphes) — recharts chargé en différé */}
      <Suspense fallback={
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      }>
        <div className="grid grid-cols-2 gap-3">
          <TrendMetricCard
            label="Volume / séance"
            value={`${lastVolume.toLocaleString('fr-FR')} kg`}
            icon={TrendingUp}
            data={trend.volume}
            color="#3b82f6"
            gradientId="trend-volume"
          />
          <TrendMetricCard
            label="Séries / séance"
            value={String(lastSets)}
            icon={Layers}
            data={trend.sets}
            color="#8b5cf6"
            gradientId="trend-sets"
          />
        </div>
      </Suspense>

      {/* Répartition par groupe musculaire */}
      <MuscleBreakdownCard workouts={workouts} exercises={exercises} />

      {/* Tuiles de stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`rounded-2xl ${stat.bg} ring-1 ${stat.ring} p-4 shadow-sm transition-shadow hover:shadow-md`}
          >
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-white shadow-md ${stat.chip} mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tabular-nums leading-none">
              <CountUp value={stat.value} />
            </div>
            <div className="text-xs font-medium text-gray-500 mt-2">{stat.label}</div>
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
                    {pr.metric === 'duration'
                      ? ' · maintien'
                      : pr.maxWeightReps > 0 && ` · ${pr.maxWeightReps} reps`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {pr.metric === 'duration' ? (
                    <p className="text-sm font-bold text-amber-600">{formatExerciseTarget(pr.maxDuration, 'duration')}</p>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-amber-600">{pr.maxWeight} kg</p>
                      {pr.estimated1RM > 0 && (
                        <p className="text-xs text-gray-400">~{pr.estimated1RM} kg 1RM</p>
                      )}
                    </>
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
