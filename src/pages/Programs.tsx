import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useWorkout } from '../context/WorkoutContext';
import { generateProgram, type GeneratedProgram } from '../lib/program-ai';
import { Sparkles, Loader2, ClipboardList, ChevronRight, Check, RefreshCw, X } from 'lucide-react';
import { formatExerciseTarget } from '@/lib/exercise-utils';

const SUGGESTIONS = [
  'Full body sur 3 jours',
  'Push / Pull / Legs',
  '4 jours haut / bas',
  'Prise de masse débutant',
];

export function Programs() {
  const { programs, exercises, addProgram } = useWorkout();
  const navigate = useNavigate();

  const exerciseById = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises]);

  const [request, setRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<GeneratedProgram | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError('');
    setPreview(null);
    try {
      const program = await generateProgram(request, exercises);
      setPreview(program);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La génération a échoué.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!preview) return;
    const created = addProgram({
      name: preview.name,
      description: preview.description,
      days: preview.days.map(d => ({
        id: crypto.randomUUID(),
        name: d.name,
        exercises: d.exercises,
      })),
    });
    setPreview(null);
    setRequest('');
    navigate(`/program/${created.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Programmes</h2>
        <p className="text-gray-500 text-sm mt-0.5">Génère un programme avec l'IA, puis lance tes séances à partir de lui.</p>
      </div>

      {/* Générateur IA */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">Générer avec l'IA</h3>
        </div>

        <textarea
          value={request}
          onChange={e => setRequest(e.target.value)}
          placeholder="Décris ce que tu veux : nombre de jours, objectif, niveau… (ex : « 4 jours, prise de masse, intermédiaire »)"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
        />

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => setRequest(s)}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Génération…' : 'Générer un programme'}
        </button>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* Aperçu du programme généré */}
      {preview && (
        <div className="bg-blue-50/50 rounded-xl border border-blue-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">{preview.name}</h3>
              {preview.description && <p className="text-xs text-gray-500 mt-0.5">{preview.description}</p>}
            </div>
            <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {preview.days.map((day, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-900 mb-1.5">{day.name}</p>
                <ul className="space-y-0.5">
                  {day.exercises.map((ex, j) => (
                    <li key={j} className="text-xs text-gray-600 flex justify-between">
                      <span>{exerciseById.get(ex.exerciseId)?.name ?? ex.exerciseId}</span>
                      <span className="text-gray-400">
                        {ex.sets} × {ex.reps != null ? formatExerciseTarget(ex.reps, exerciseById.get(ex.exerciseId)?.metric) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Enregistrer
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center justify-center gap-1.5 px-4 border border-gray-300 text-gray-600 rounded-lg hover:bg-white transition-colors disabled:opacity-60"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Programmes enregistrés */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Mes programmes</h3>
        {programs.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucun programme enregistré</p>
          </div>
        ) : (
          programs.map(p => (
            <Link
              key={p.id}
              to={`/program/${p.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.days.length} jour(s) · {p.days.reduce((s, d) => s + d.exercises.length, 0)} exercice(s)
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
