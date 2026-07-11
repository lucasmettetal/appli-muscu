import { useState } from 'react';
import { Link } from 'react-router';
import { Dumbbell, ChevronRight } from 'lucide-react';
import { loadDraft, isDraftMeaningful } from '../lib/workout-draft';

// Bandeau affiché sur l'accueil et l'onglet Séances quand une séance en cours
// (non terminée) existe, pour la reprendre en un clic.
export function WorkoutDraftBanner() {
  const [draft] = useState(loadDraft);

  if (!isDraftMeaningful(draft)) return null;

  const exerciseCount = draft!.exercises.length;
  const setCount = draft!.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <Link
      to="/workout/new"
      className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 shadow-sm transition-colors"
    >
      <div className="shrink-0 bg-white/20 rounded-lg p-2">
        <Dumbbell className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          Séance en cours{draft!.name ? ` · ${draft!.name}` : ''}
        </p>
        <p className="text-xs text-white/80 mt-0.5">
          {exerciseCount} exercice(s) · {setCount} série(s) — appuie pour reprendre
        </p>
      </div>
      <ChevronRight className="w-5 h-5 shrink-0 text-white/80" />
    </Link>
  );
}
