import { useState } from 'react';
import { Link } from 'react-router';
import { useWorkout } from '../context/WorkoutContext';
import { Dumbbell, Trash2, Plus, ClipboardList, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkoutDraftBanner } from '../components/WorkoutDraftBanner';

function DeleteConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-white w-full rounded-t-2xl p-6 space-y-5 max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-bold text-gray-900">Supprimer cette séance ?</h2>
          <p className="text-sm text-gray-500 mt-1">Cette action est définitive.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Annuler</Button>
          <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={onConfirm}>Supprimer</Button>
        </div>
      </div>
    </div>
  );
}

export function Workouts() {
  const { workouts, exercises, deleteWorkout } = useWorkout();
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);

  const getExerciseName = (id: string) =>
    exercises.find(e => e.id === id)?.name ?? 'Exercice inconnu';

  return (
    <>
    {workoutToDelete && (
      <DeleteConfirmModal
        onConfirm={() => { deleteWorkout(workoutToDelete); setWorkoutToDelete(null); }}
        onCancel={() => setWorkoutToDelete(null)}
      />
    )}
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Séances</h2>
        <Button asChild size="sm">
          <Link to="/workout/new">
            <Plus className="w-4 h-4 mr-1" />
            Nouvelle
          </Link>
        </Button>
      </div>

      <WorkoutDraftBanner />

      <Link
        to="/programs"
        className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors"
      >
        <div className="shrink-0 bg-blue-50 rounded-lg p-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Programmes</p>
          <p className="text-xs text-gray-400 mt-0.5">Génère un programme avec l'IA et lance tes séances</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
      </Link>

      {workouts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Dumbbell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Aucune séance</p>
          <p className="text-sm mt-1">Lance ton premier entraînement</p>
          <Button asChild className="mt-4">
            <Link to="/workout/new">Démarrer une séance</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map(workout => {
            const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
            const completedSets = workout.exercises.reduce(
              (sum, ex) => sum + ex.sets.filter(s => s.completed).length,
              0
            );

            return (
              <div
                key={workout.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <Link to={`/workout/${workout.id}`} className="block p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{workout.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(workout.date).toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {workout.duration ? (
                        <span className="block text-xs">{Math.round(workout.duration / 60)} min</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-3 text-sm">
                    <span className="text-gray-600">
                      <strong className="text-gray-900">{workout.exercises.length}</strong> exercice(s)
                    </span>
                    <span className="text-gray-600">
                      <strong className="text-gray-900">{completedSets}</strong>/{totalSets} séries
                    </span>
                  </div>

                  {workout.exercises.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {workout.exercises.slice(0, 3).map(ex => (
                        <span
                          key={ex.exerciseId}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                        >
                          {getExerciseName(ex.exerciseId)}
                        </span>
                      ))}
                      {workout.exercises.length > 3 && (
                        <span className="text-xs text-gray-400">+{workout.exercises.length - 3}</span>
                      )}
                    </div>
                  )}
                </Link>

                <div className="px-4 pb-3 flex justify-end">
                  <button
                    onClick={() => setWorkoutToDelete(workout.id)}
                    className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
