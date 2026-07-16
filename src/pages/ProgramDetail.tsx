import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useWorkout, type ProgramExercise, type ProgramDay } from '../context/WorkoutContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Play, Trash2, Pencil, Check, ChevronRight, Plus, Search, X } from 'lucide-react';
import { formatProgramTarget, programTargetValue, exerciseMetric } from '@/lib/exercise-utils';

export function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { programs, exercises, updateProgram, deleteProgram } = useWorkout();

  const program = programs.find(p => p.id === id);
  const exerciseById = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises]);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(program?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);

  if (!program) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>Programme introuvable.</p>
        <Button variant="link" onClick={() => navigate('/programs')}>Retour aux programmes</Button>
      </div>
    );
  }

  const saveName = () => {
    if (nameDraft.trim()) updateProgram(program.id, { name: nameDraft.trim() });
    setEditingName(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Supprimer le programme « ${program.name} » ?`)) {
      deleteProgram(program.id);
      navigate('/programs');
    }
  };

  const startDay = (dayName: string, programExercises: ProgramExercise[]) => {
    navigate('/workout/new', {
      state: { program: { name: `${program.name} — ${dayName}`, exercises: programExercises } },
    });
  };

  // ─── Édition ────────────────────────────────────────────────────────────────
  const setDays = (days: ProgramDay[]) => updateProgram(program.id, { days });

  const patchExercise = (dayId: string, idx: number, patch: Partial<ProgramExercise>) => {
    setDays(program.days.map(d =>
      d.id === dayId
        ? { ...d, exercises: d.exercises.map((ex, i) => (i === idx ? { ...ex, ...patch } : ex)) }
        : d
    ));
  };
  const removeExercise = (dayId: string, idx: number) => {
    setDays(program.days.map(d =>
      d.id === dayId ? { ...d, exercises: d.exercises.filter((_, i) => i !== idx) } : d
    ));
  };
  const addExerciseToDay = (dayId: string, exerciseId: string) => {
    const newExercise: ProgramExercise = exerciseMetric(exerciseById.get(exerciseId)) === 'duration'
      ? { exerciseId, sets: 3, durationSeconds: 30 }
      : { exerciseId, sets: 3, reps: 10 };
    setDays(program.days.map(d =>
      d.id === dayId ? { ...d, exercises: [...d.exercises, newExercise] } : d
    ));
    setPickerDayId(null);
  };

  return (
    <div className="space-y-6">
      {pickerDayId && (
        <ExercisePicker
          onClose={() => setPickerDayId(null)}
          onPick={exId => addExerciseToDay(pickerDayId, exId)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/programs')} className="text-gray-400 hover:text-gray-600 shrink-0">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex gap-2">
              <input
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); }}
                className="flex-1 text-xl font-bold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-400 focus:outline-none"
                autoFocus
              />
              <button onClick={saveName} className="text-blue-600"><Check className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 truncate">{program.name}</h2>
              <button onClick={() => { setNameDraft(program.name); setEditingName(true); }} className="text-gray-300 hover:text-gray-500 shrink-0">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
          {program.description && <p className="text-xs text-gray-400 mt-0.5">{program.description}</p>}
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          className={`shrink-0 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
            editing
              ? 'bg-blue-600 text-white border-blue-600'
              : 'text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          {editing ? 'Terminer' : 'Modifier'}
        </button>
      </div>

      {/* Jours du programme */}
      <div className="space-y-3">
        {program.days.map(day => (
          <div key={day.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">{day.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{day.exercises.length} exercice(s)</p>
            </div>

            <ul className="divide-y divide-gray-50">
              {day.exercises.map((ex, i) => {
                const exercise = exerciseById.get(ex.exerciseId);
                const name = exercise?.name ?? 'Exercice inconnu';
                const metric = exerciseMetric(exercise);
                const target = programTargetValue(ex, exercise);
                const meta = `${ex.sets} série(s)${target ? ` × ${formatProgramTarget(ex, exercise)}` : ''}`;

                // ─── Ligne en mode édition ───────────────────────────────────
                if (editing) {
                  return (
                    <li key={i} className="px-4 py-2.5 flex items-center gap-2">
                      <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{name}</span>
                      <input
                        type="number" min="1" inputMode="numeric"
                        value={ex.sets}
                        onChange={e => patchExercise(day.id, i, { sets: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-11 text-center text-sm border border-gray-200 rounded-md py-1 focus:outline-none focus:border-blue-400"
                        aria-label="Séries"
                      />
                      <span className="text-xs text-gray-400">×</span>
                      {metric === 'duration' ? (
                        <>
                          <input
                            type="number" min="1" inputMode="numeric"
                            value={ex.durationSeconds ?? ''}
                            onChange={e => patchExercise(day.id, i, { durationSeconds: parseInt(e.target.value) || undefined, reps: undefined })}
                            className="w-14 text-center text-sm border border-gray-200 rounded-md py-1 focus:outline-none focus:border-blue-400"
                            aria-label="Durée (secondes)"
                          />
                          <span className="text-xs text-gray-400">s</span>
                        </>
                      ) : (
                        <>
                          <input
                            type="number" min="1" inputMode="numeric"
                            value={ex.reps ?? ''}
                            onChange={e => patchExercise(day.id, i, { reps: parseInt(e.target.value) || undefined, durationSeconds: undefined })}
                            className="w-11 text-center text-sm border border-gray-200 rounded-md py-1 focus:outline-none focus:border-blue-400"
                            aria-label="Répétitions"
                          />
                          <span className="text-xs text-gray-400">reps</span>
                        </>
                      )}
                      <button
                        onClick={() => removeExercise(day.id, i)}
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0 ml-1"
                        aria-label="Retirer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                }

                // ─── Ligne normale (cliquable vers la fiche) ─────────────────
                if (!exercise) {
                  return (
                    <li key={i} className="px-4 py-2.5 flex justify-between items-center gap-2">
                      <span className="text-sm text-gray-400">{name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{meta}</span>
                    </li>
                  );
                }
                return (
                  <li key={i}>
                    <Link
                      to={`/exercise/${ex.exerciseId}`}
                      className="px-4 py-2.5 flex justify-between items-center gap-2 hover:bg-blue-50/50 transition-colors"
                    >
                      <span className="text-sm text-gray-800 truncate">{name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{meta}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="px-4 py-3">
              {editing ? (
                <button
                  onClick={() => setPickerDayId(day.id)}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-blue-600 border border-dashed border-gray-300 hover:border-blue-400 rounded-lg py-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un exercice
                </button>
              ) : (
                <Button className="w-full" onClick={() => startDay(day.name, day.exercises)}>
                  <Play className="w-4 h-4 mr-1.5" />
                  Démarrer cette séance
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleDelete}
        className="w-full flex items-center justify-center gap-1.5 text-sm text-red-400 hover:text-red-600 transition-colors py-2"
      >
        <Trash2 className="w-4 h-4" />
        Supprimer ce programme
      </button>
    </div>
  );
}

// ─── Sélecteur d'exercice (feuille de recherche) ─────────────────────────────

function ExercisePicker({ onClose, onPick }: { onClose: () => void; onPick: (exerciseId: string) => void }) {
  const { exercises } = useWorkout();
  const [search, setSearch] = useState('');

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return exercises
      .filter(e => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q))
      .slice(0, 40);
  }, [exercises, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-2xl p-5 space-y-3 max-w-lg mx-auto max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Ajouter un exercice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un exercice…"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-1">
          {search.trim().length < 2 ? (
            <p className="text-xs text-gray-400 text-center py-8">Tape au moins 2 caractères…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun exercice trouvé</p>
          ) : (
            results.map(ex => (
              <button
                key={ex.id}
                onClick={() => onPick(ex.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900">{ex.name}</span>
                <span className="text-xs text-gray-400 ml-2">{ex.muscleGroup}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
