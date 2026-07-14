import { useState, useMemo } from 'react';
import { useWorkout } from '../context/WorkoutContext';
import { getExerciseHistory } from '@/lib/pr-utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Award, Dumbbell } from 'lucide-react';
import { BodyWeightTracker } from '../components/BodyWeightTracker';

export function Progress() {
  const { exercises, workouts } = useWorkout();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);

  const sortedExercises = useMemo(() => {
    const lastPracticed = new Map<string, number>();
    for (const w of workouts) {
      const t = new Date(w.date).getTime();
      for (const e of w.exercises) {
        if (!lastPracticed.has(e.exerciseId) || lastPracticed.get(e.exerciseId)! < t) {
          lastPracticed.set(e.exerciseId, t);
        }
      }
    }
    return [...exercises].sort((a, b) => {
      const ta = lastPracticed.get(a.id) ?? 0;
      const tb = lastPracticed.get(b.id) ?? 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [exercises, workouts]);

  // Réutilise getExerciseHistory (déjà testé, filtre les sets invalides)
  const history = useMemo(
    () => selectedExerciseId ? getExerciseHistory(workouts, selectedExerciseId) : [],
    [selectedExerciseId, workouts]
  );

  const chartData = history.map(s => ({
    date:        new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    maxWeight:   s.maxWeight,
    totalVolume: s.totalVolume,
    sets:        s.setCount,
  }));

  const pr         = history.length > 0 ? Math.max(...history.map(s => s.maxWeight)) : 0;
  const lastWeight = history.length > 0 ? history[history.length - 1].maxWeight : 0;
  const prevWeight = history.length > 1 ? history[history.length - 2].maxWeight : null;
  const progression = prevWeight !== null ? lastWeight - prevWeight : null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Progression</h2>

      <BodyWeightTracker />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Choisir un exercice</label>
        <Select value={selectedExerciseId} onValueChange={setSelectedExerciseId}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un exercice..." />
          </SelectTrigger>
          <SelectContent>
            {sortedExercises.map(ex => (
              <SelectItem key={ex.id} value={ex.id}>
                {ex.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedExerciseId ? (
        <div className="text-center py-16 text-gray-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Sélectionne un exercice pour voir ta progression</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Dumbbell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Aucune donnée pour {selectedExercise?.name}</p>
          <p className="text-xs mt-1">Lance une séance avec cet exercice</p>
        </div>
      ) : (
        <>
          {/* Stats rapides */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
              <div className="flex justify-center mb-1">
                <Award className="w-4 h-4 text-yellow-500" />
              </div>
              <p className="text-xl font-bold text-gray-900">{pr} kg</p>
              <p className="text-xs text-gray-400">Record</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
              <div className="flex justify-center mb-1">
                <TrendingUp className={`w-4 h-4 ${progression && progression > 0 ? 'text-green-500' : 'text-red-400'}`} />
              </div>
              <p className="text-xl font-bold text-gray-900">
                {progression !== null ? `${progression > 0 ? '+' : ''}${progression} kg` : '-'}
              </p>
              <p className="text-xs text-gray-400">Progression</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
              <div className="flex justify-center mb-1">
                <Dumbbell className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-gray-900">{chartData.length}</p>
              <p className="text-xs text-gray-400">Séances</p>
            </div>
          </div>

          {/* Graphique */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Poids max par séance (kg)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#d1d5db" />
                <YAxis tick={{ fontSize: 10 }} stroke="#d1d5db" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`${value} kg`, 'Poids max']}
                />
                <Line
                  type="monotone"
                  dataKey="maxWeight"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#2563eb' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Historique détaillé */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            <div className="px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">Historique</h3>
            </div>
            {[...chartData].reverse().map((d, i) => (
              <div key={i} className="px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.date}</p>
                  <p className="text-xs text-gray-400">{d.sets} série(s)</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{d.maxWeight} kg</p>
                  <p className="text-xs text-gray-400">vol. {d.totalVolume} kg</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
