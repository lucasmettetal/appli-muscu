import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useWorkout, type ProgramExercise } from '../context/WorkoutContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Play, Trash2, Pencil, Check } from 'lucide-react';

export function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { programs, exercises, updateProgram, deleteProgram } = useWorkout();

  const program = programs.find(p => p.id === id);
  const exerciseName = useMemo(() => new Map(exercises.map(e => [e.id, e.name])), [exercises]);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(program?.name ?? '');

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

  // Lance une nouvelle séance pré-remplie à partir d'un jour du programme.
  const startDay = (dayName: string, programExercises: ProgramExercise[]) => {
    navigate('/workout/new', {
      state: {
        program: {
          name: `${program.name} — ${dayName}`,
          exercises: programExercises,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
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
              {day.exercises.map((ex, i) => (
                <li key={i} className="px-4 py-2.5 flex justify-between items-center">
                  <span className="text-sm text-gray-800">{exerciseName.get(ex.exerciseId) ?? 'Exercice inconnu'}</span>
                  <span className="text-xs text-gray-400">{ex.sets} série(s){ex.reps ? ` × ${ex.reps} reps` : ''}</span>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3">
              <Button className="w-full" onClick={() => startDay(day.name, day.exercises)}>
                <Play className="w-4 h-4 mr-1.5" />
                Démarrer cette séance
              </Button>
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
