import { useState, useMemo } from 'react';
import { useWorkout } from '../context/WorkoutContext';
import { sortByDate, getBodyWeightStats } from '../lib/bodyweight-utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Scale, Plus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';

function todayInput(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function BodyWeightTracker() {
  const { bodyWeights, addBodyWeight, deleteBodyWeight } = useWorkout();

  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(todayInput());

  const sorted = useMemo(() => sortByDate(bodyWeights), [bodyWeights]);
  const stats = useMemo(() => getBodyWeightStats(bodyWeights), [bodyWeights]);

  const chartData = sorted.map(b => ({
    date: new Date(b.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    weight: b.weight,
  }));

  const handleAdd = () => {
    const w = parseFloat(weight.replace(',', '.'));
    if (!Number.isFinite(w) || w <= 0) return;
    const iso = new Date(`${date}T12:00:00`).toISOString();
    addBodyWeight(w, iso);
    setWeight('');
    setDate(todayInput());
  };

  const DeltaBadge = () => {
    if (stats.deltaFromPrevious === null) return null;
    const d = stats.deltaFromPrevious;
    const Icon = d < 0 ? TrendingDown : d > 0 ? TrendingUp : Minus;
    const color = d < 0 ? 'text-green-600' : d > 0 ? 'text-orange-500' : 'text-gray-400';
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        {d > 0 ? '+' : ''}{d} kg
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
      {/* En-tête + poids actuel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-700">Poids de corps</h3>
        </div>
        {stats.latest !== null && (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-900">{stats.latest} kg</span>
            <DeltaBadge />
          </div>
        )}
      </div>

      {/* Formulaire d'ajout */}
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="Poids (kg)"
          className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
        />
        <input
          type="date"
          value={date}
          max={todayInput()}
          onChange={e => setDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:border-blue-400 text-gray-600"
        />
        <button
          onClick={handleAdd}
          disabled={!weight.trim()}
          className="shrink-0 inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 rounded-lg disabled:opacity-40 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {chartData.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-6">
          Ajoute ta première pesée pour suivre l'évolution de ton poids.
        </p>
      ) : (
        <>
          {/* Graphique */}
          {chartData.length > 1 && (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#d1d5db" />
                <YAxis tick={{ fontSize: 10 }} stroke="#d1d5db" domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`${value} kg`, 'Poids']}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563eb' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Historique (5 dernières pesées) */}
          <div className="divide-y divide-gray-100 -mx-1">
            {[...sorted].reverse().slice(0, 5).map(b => (
              <div key={b.id} className="flex items-center justify-between px-1 py-2">
                <span className="text-sm text-gray-500">
                  {new Date(b.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">{b.weight} kg</span>
                  <button
                    onClick={() => deleteBodyWeight(b.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
