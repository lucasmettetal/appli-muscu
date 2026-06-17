import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { useWorkout, type Exercise } from '../context/WorkoutContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EQUIPMENT_LABEL as EQ_LABEL, DIFFICULTY_LABEL, DIFFICULTY_STYLE } from '@/lib/exercise-utils';
import {
  searchWgerExercises,
  fetchWgerExerciseInfo,
  mapWgerToExercise,
  type WgerSuggestion,
} from '@/lib/wger-api';
import { Plus, Search, SlidersHorizontal, X, ChevronRight, Globe, Loader2, CheckCircle2 } from 'lucide-react';

const CATEGORIES: { value: Exercise['category'] | 'all'; label: string }[] = [
  { value: 'all',       label: 'Tous' },
  { value: 'chest',     label: 'Pectoraux' },
  { value: 'back',      label: 'Dos' },
  { value: 'shoulders', label: 'Épaules' },
  { value: 'arms',      label: 'Bras' },
  { value: 'legs',      label: 'Jambes' },
  { value: 'core',      label: 'Abdos' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'all',             label: 'Tout matériel' },
  { value: 'barbell',         label: 'Barre' },
  { value: 'dumbbell',        label: 'Haltères' },
  { value: 'cable',           label: 'Poulie' },
  { value: 'machine',         label: 'Machine' },
  { value: 'pull-up-bar',     label: 'Barre de traction' },
  { value: 'kettlebell',      label: 'Kettlebell' },
  { value: 'resistance-band', label: 'Élastique' },
];

const TYPE_OPTIONS = [
  { value: 'all',       label: 'Tous types' },
  { value: 'compound',  label: 'Polyarticulaire' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'cardio',    label: 'Cardio' },
  { value: 'mobility',  label: 'Mobilité' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'all',          label: 'Tous niveaux' },
  { value: 'beginner',     label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced',     label: 'Avancé' },
];


// ─── Dialog de recherche API wger ────────────────────────────────────────────

type ImportStatus = 'idle' | 'loading' | 'done' | 'exists';

function WgerSearchDialog({
  open,
  onOpenChange,
  existingNames,
  onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingNames: Set<string>;
  onImport: (exercise: Omit<Exercise, 'id' | 'custom'>) => void;
}) {
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState<WgerSuggestion[]>([]);
  const [searching, setSearching]     = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<Map<number, ImportStatus>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const suggestions = await searchWgerExercises(q.trim());
        setResults(suggestions.slice(0, 15));
      } catch {
        setSearchError('Impossible de joindre la base wger. Vérifie ta connexion.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleImport = async (suggestion: WgerSuggestion) => {
    const baseId = suggestion.data.base_id;
    setImportStatus(prev => new Map(prev).set(baseId, 'loading'));
    try {
      const info     = await fetchWgerExerciseInfo(baseId);
      const exercise = mapWgerToExercise(info, suggestion.value);
      onImport(exercise);
      setImportStatus(prev => new Map(prev).set(baseId, 'done'));
    } catch {
      setImportStatus(prev => new Map(prev).set(baseId, 'idle'));
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setQuery('');
      setResults([]);
      setSearchError(null);
      setImportStatus(new Map());
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            Chercher un exercice en ligne
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-gray-400 -mt-1">Base wger.de — +800 exercices</p>

        {/* Champ de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="ex: bench press, squat, curl…"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            className="pl-9"
            autoFocus
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Erreur réseau */}
        {searchError && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{searchError}</p>
        )}

        {/* Résultats */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
          {results.length === 0 && query.trim().length >= 2 && !searching && !searchError && (
            <p className="text-sm text-gray-400 text-center py-6">Aucun résultat pour « {query} »</p>
          )}
          {query.trim().length < 2 && !searching && (
            <p className="text-xs text-gray-400 text-center py-6">Tape au moins 2 caractères…</p>
          )}

          {results.map(s => {
            const baseId  = s.data.base_id;
            const status  = importStatus.get(baseId) ?? 'idle';
            const alreadyLocal = existingNames.has(s.value.toLowerCase());
            const effectiveStatus = alreadyLocal ? 'exists' : status;

            return (
              <div
                key={baseId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-gray-200 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.data.category}</p>
                </div>

                {effectiveStatus === 'idle' && (
                  <button
                    onClick={() => handleImport(s)}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-2.5 py-1 rounded-full transition-colors"
                  >
                    Importer
                  </button>
                )}
                {effectiveStatus === 'loading' && (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                )}
                {effectiveStatus === 'done' && (
                  <span className="shrink-0 flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ajouté
                  </span>
                )}
                {effectiveStatus === 'exists' && (
                  <span className="shrink-0 text-xs text-gray-400">Déjà présent</span>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function Exercises() {
  const { exercises, addExercise } = useWorkout();

  const [search, setSearch]         = useState('');
  const [category, setCategory]     = useState<string>('all');
  const [equipment, setEquipment]   = useState('all');
  const [type, setType]             = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [dialogOpen, setDialogOpen]         = useState(false);
  const [wgerOpen, setWgerOpen]             = useState(false);
  const [newName, setNewName]               = useState('');
  const [newCategory, setNewCategory]       = useState<Exercise['category']>('chest');
  const [newMuscleGroup, setNewMuscleGroup] = useState('');

  const existingNames = useMemo(
    () => new Set(exercises.map(e => e.name.toLowerCase())),
    [exercises]
  );

  const activeAdvancedCount = [equipment, type, difficulty].filter(v => v !== 'all').length;

  const filtered = useMemo(() => {
    return exercises.filter(ex => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          ex.name.toLowerCase().includes(q) ||
          ex.muscleGroup.toLowerCase().includes(q) ||
          ex.musclesPrimary.some(m => m.toLowerCase().includes(q)) ||
          ex.tags.some(t => t.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (category !== 'all' && ex.category !== category) return false;
      if (equipment !== 'all' && !ex.equipment.includes(equipment)) return false;
      if (type !== 'all' && ex.type !== type) return false;
      if (difficulty !== 'all' && ex.difficulty !== difficulty) return false;
      return true;
    });
  }, [exercises, search, category, equipment, type, difficulty]);

  const hasAnyFilter = search || category !== 'all' || equipment !== 'all' || type !== 'all' || difficulty !== 'all';

  const clearAllFilters = () => {
    setSearch('');
    setCategory('all');
    setEquipment('all');
    setType('all');
    setDifficulty('all');
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const categoryLabel = CATEGORIES.find(c => c.value === newCategory)?.label ?? '';
    addExercise({
      name: newName.trim(),
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
    });
    setNewName('');
    setNewMuscleGroup('');
    setNewCategory('chest');
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">

      {/* Dialog API wger */}
      <WgerSearchDialog
        open={wgerOpen}
        onOpenChange={setWgerOpen}
        existingNames={existingNames}
        onImport={addExercise}
      />

      {/* En-tête */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Exercices</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setWgerOpen(true)}>
            <Globe className="w-4 h-4 mr-1" />En ligne
          </Button>
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
                  placeholder="ex: Développé incliné haltères"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={newCategory} onValueChange={v => setNewCategory(v as Exercise['category'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Groupe musculaire <span className="text-gray-400 font-normal">(optionnel)</span></Label>
                <Input
                  placeholder="ex: Grand pectoral"
                  value={newMuscleGroup}
                  onChange={e => setNewMuscleGroup(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleAdd}>Créer l&apos;exercice</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Nom, muscle, tag…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pills catégorie */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              category === c.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Filtres avancés */}
      <div>
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtres avancés
          {activeAdvancedCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {activeAdvancedCount}
            </span>
          )}
        </button>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTY_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Barre résultats */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{filtered.length}</span> exercice{filtered.length !== 1 ? 's' : ''}
        </span>
        {hasAnyFilter && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">Aucun exercice trouvé</p>
          <p className="text-xs text-gray-400 mt-1">Essaie d&apos;autres termes ou efface les filtres</p>
        </div>
      ) : (
        <div className="space-y-2 pb-2">
          {filtered.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ exercise: ex }: { exercise: Exercise }) {
  const primaryEquipment = ex.bodyweight
    ? 'Poids du corps'
    : ex.equipment.length > 0
    ? (EQ_LABEL[ex.equipment[0]] ?? ex.equipment[0])
    : null;

  return (
    <Link
      to={`/exercise/${ex.id}`}
      className="block bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">{ex.name}</p>
            {ex.custom && (
              <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">
                Perso
              </span>
            )}
            {ex.unilateral && (
              <span className="text-xs text-gray-400">↔</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{ex.muscleGroup}</p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {primaryEquipment && (
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                {primaryEquipment}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              ex.type === 'compound' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {ex.type === 'compound' ? 'Polyarticulaire' : 'Isolation'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_STYLE[ex.difficulty] ?? ''}`}>
            {DIFFICULTY_LABEL[ex.difficulty] ?? ex.difficulty}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>
    </Link>
  );
}
