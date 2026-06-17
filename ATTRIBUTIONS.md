import { useState } from 'react';
import { useWorkout } from '../context/WorkoutContext';
import { Plus, Trash2, Calendar, Timer, FileText } from 'lucide-react';
import { Link } from 'react-router';

export function Workouts() {
  const { workouts, deleteWorkout } = useWorkout();
  const [showNewWorkoutModal, setShowNewWorkoutModal] = useState(false);

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer la séance "${name}" ?`)) {
      deleteWorkout(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mes séances</h2>
          <p className="text-gray-600">{workouts.length} séance(s) enregistrée(s)</p>
        </div>
        <Link
          to="/workout/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouvelle séance
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune séance</h3>
          <p className="text-gray-600 mb-4">
            Commencez à suivre vos entraînements dès maintenant
          </p>
          <Link
            to="/workout/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Créer ma première séance
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((workout) => {
            const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
            const completedSets = workout.exercises.reduce(
              (sum, ex) => sum + ex.sets.filter(s => s.completed).length,
              0
            );

            return (
              <div
                key={workout.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{workout.name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(workout.date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </div>
                      {workout.duration && (
                        <div className="flex items-center gap-1">
                          <Timer className="w-4 h-4" />
                          {workout.duration} min
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(workout.id, workout.name)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progression</span>
                    <span className="font-medium text-gray-900">
                      {completedSets}/{totalSets} séries
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(completedSets / totalSets) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-sm text-gray-600">
                    {workout.exercises.length} exercice(s)
                  </div>
                  <Link
                    to={`/workout/${workout.id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Voir détails →
                  </Link>
                </div>

                {workout.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <FileText className="w-4 h-4 mt-0.5" />
                      <p>{workout.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
