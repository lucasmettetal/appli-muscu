import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useWorkout, type Exercise } from '../context/WorkoutContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  EQUIPMENT_LABEL,
  DIFFICULTY_LABEL,
  DIFFICULTY_STYLE,
  TYPE_LABEL,
  matchesExerciseSearch,
} from '@/lib/exercise-utils';
import { exercisePlaceholderUrl, formatEquipment, formatMuscle } from '@/lib/exercise-db';
import { ChevronRight, Loader2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';

const CATEGORIES: { value: Exercise['category'] | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'chest', label: 'Pectoraux' },
  { value: 'back', label: 'Dos' },
  { value: 'shoulders', label: 'Épaules' },
  { value: 'arms', label: 'Bras' },
  { value: 'legs', label: 'Jambes' },
  { value: 'core', label: 'Abdos' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'all', label: 'Tout matériel' },
  { value: 'barbell', label: 'Barre' },
  { value: 'dumbbell', label: 'Haltères' },
  { value: 'cable', label: 'Poulie' },
  { value: 'machine', label: 'Machine' },
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'kettlebells', label: 'Kettlebells' },
  { value: 'bands', label: 'Élastiques' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tous types' },
  { value: 'compound', label: 'Polyarticulaire' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'plyometric', label: 'Pliométrie' },
  { value: 'mobility', label: 'Mobilité' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'Tous niveaux' },
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
];

export function Exercises() {
  const {
    exercises,
    addExercise,
    exerciseLibraryLoading,
    exerciseLibraryError,
  } = useWorkout();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [equipment, setEquipment] = useState('all');
  const [type, setType] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Exercise['category']>('chest');
  const [newMuscleGroup, setNewMuscleGroup] = useState('');

  const activeAdvancedCount = [equipment, type, difficulty].filter(value => value !== 'all').length;

  const filtered = useMemo(() => exercises.filter(exercise => {
    if (search && !matchesExerciseSearch(exercise, search)) return false;
    if (category !== 'all' && exercise.category !== category) return false;
    if (equipment !== 'all' && !(equipment === 'bodyweight' ? exercise.bodyweight : exercise.equipment.includes(equipment))) return false;
    if (type !== 'all' && exercise.type !== type) return false;
    if (difficulty !== 'all' && exercise.difficulty !== difficulty) return false;
    return true;
  }), [exercises, search, category, equipment, type, difficulty]);

  const hasAnyFilter = !!search || category !== 'all' || equipment !== 'all' || type !== 'all' || difficulty !== 'all';

  const clearAllFilters = () => {
    setSearch('');
    setCategory('all');
    setEquipment('all');
    setType('all');
    setDifficulty('all');
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const categoryLabel = CATEGORIES.find(item => item.value === newCategory)?.label ?? '';
    addExercise({
      name: newName.trim(),
      nameFr: newName.trim(),
      nameEn: '',
      category: newCategory,
      muscleGroup: newMuscleGroup.trim() || categoryLabel,
      musclesPrimary: [],
      musclesSecondary: [],
      equipment: [],
      type: 'isolation',
      difficulty: 'beginner',
      unilateral: false,
      bodyweight: false,
      tags: [],
      imageStart: null,
      imageEnd: null,
      source: 'local',
    });
    setNewName('');
    setNewMuscleGroup('');
    setNewCategory('chest');
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Exercices</h2>
          <p className="text-xs text-gray-400 mt-0.5">Bibliothèque locale Free Exercise DB</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvel exercice</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input
                  placeholder="ex : Développé incliné haltères"
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && handleAdd()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={newCategory} onValueChange={value => setNewCategory(value as Exercise['category'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter(item => item.value !== 'all').map(item => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Groupe musculaire <span className="text-gray-400 font-normal">(optionnel)</span></Label>
                <Input
                  placeholder="ex : Grand pectoral"
                  value={newMuscleGroup}
                  onChange={event => setNewMuscleGroup(event.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleAdd}>Créer l&apos;exercice</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {exerciseLibraryLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement de la bibliothèque locale…
        </div>
      )}
      {exerciseLibraryError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{exerciseLibraryError}</p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Nom français ou anglais, muscle, matériel…"
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(item => (
          <button
            key={item.value}
            onClick={() => setCategory(item.value)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              category === item.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div>
        <button onClick={() => setShowAdvanced(value => !value)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <SlidersHorizontal className="w-4 h-4" />
          Filtres avancés
          {activeAdvancedCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">{activeAdvancedCount}</span>
          )}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <FilterSelect value={equipment} onChange={setEquipment} options={EQUIPMENT_OPTIONS} />
            <FilterSelect value={type} onChange={setType} options={TYPE_OPTIONS} />
            <FilterSelect value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} />
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{filtered.length}</span> exercice{filtered.length !== 1 ? 's' : ''}
        </span>
        {hasAnyFilter && (
          <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Effacer les filtres
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">Aucun exercice trouvé</p>
          <p className="text-xs text-gray-400 mt-1">Essaie d&apos;autres termes ou efface les filtres</p>
        </div>
      ) : (
        <div className="space-y-2 pb-2">
          {filtered.map(exercise => <ExerciseCard key={exercise.id} exercise={exercise} />)}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const primaryEquipment = exercise.bodyweight
    ? 'Poids du corps'
    : exercise.equipment.length > 0
      ? (EQUIPMENT_LABEL[exercise.equipment[0]] ?? formatEquipment(exercise.equipment[0]))
      : null;

  return (
    <Link
      to={`/exercise/${exercise.id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
    >
      <div className="flex items-start gap-3">
        <img
          src={exercise.thumbnail ?? exercise.imageStart ?? exercisePlaceholderUrl}
          onError={event => { event.currentTarget.src = exercisePlaceholderUrl; }}
          loading="lazy"
          decoding="async"
          alt=""
          className="w-16 h-16 rounded-xl object-cover bg-gray-100 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{exercise.name}</p>
            {exercise.custom && <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">Perso</span>}
            {exercise.unilateral && <span className="text-xs text-gray-400">↔</span>}
          </div>
          {exercise.nameEn && exercise.nameEn !== exercise.name && (
            <p className="text-xs text-gray-400 truncate">{exercise.nameEn}</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5 truncate">{formatMuscle(exercise.muscleGroup)}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {primaryEquipment && <span className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">{primaryEquipment}</span>}
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{TYPE_LABEL[exercise.type] ?? exercise.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_STYLE[exercise.difficulty] ?? ''}`}>
            {DIFFICULTY_LABEL[exercise.difficulty] ?? exercise.difficulty}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>
    </Link>
  );
}
