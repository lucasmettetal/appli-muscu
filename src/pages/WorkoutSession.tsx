import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useWorkout, STORAGE_KEYS, type WorkoutExercise, type WorkoutSet, type ProgramExercise } from '../context/WorkoutContext';
import { detectNewPRs, getExercisePR, epley1RM, getLastPerformance, type NewPR, PR_TYPE_LABEL, PR_TYPE_UNIT } from '@/lib/pr-utils';
import { loadDraft, saveDraft, clearDraft } from '@/lib/workout-draft';
import { scopedKey } from '@/lib/profiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { matchesExerciseSearch, exerciseSetUnit, exerciseMetric, formatExerciseTarget } from '@/lib/exercise-utils';
import { Plus, Check, Trash2, ChevronLeft, Timer, ChevronDown, Trophy, SkipForward, X, Play, Pause, RotateCcw } from 'lucide-react';

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const RIR_VALUES = [0, 1, 2, 3, 4];
const REST_PRESETS = [45, 60, 90, 120, 180, 240];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function rpeDescription(rpe: number): string {
  if (rpe <= 6)    return 'Très facile — 4+ reps en réserve';
  if (rpe === 6.5) return 'Facile — 3-4 reps en réserve';
  if (rpe === 7)   return 'Modéré — 3 reps en réserve';
  if (rpe === 7.5) return 'Modéré-difficile — 2-3 reps en réserve';
  if (rpe === 8)   return 'Difficile — 2 reps en réserve';
  if (rpe === 8.5) return 'Très difficile — 1-2 reps en réserve';
  if (rpe === 9)   return 'Proche du max — 1 rep en réserve';
  if (rpe === 9.5) return 'Presque maximal — peut-être 1 rep';
  if (rpe === 10)  return 'Effort maximal — aucune rep possible';
  return '';
}

function playBeep() {
  try {
    const ctx = new AudioContext();

    // Deux bips courts puis un long
    const beeps = [
      { start: 0,    dur: 0.12, freq: 880 },
      { start: 0.18, dur: 0.12, freq: 880 },
      { start: 0.36, dur: 0.4,  freq: 1046 },
    ];
    beeps.forEach(({ start, dur, freq }) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      g.gain.setValueAtTime(0.25, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.01);
    });
  } catch {
    // Web Audio non supporté : on ignore
  }
}

function createWorkoutSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    weight: 0,
    reps: 0,
    completed: false,
    ...overrides,
  };
}

// ─── Timer de repos ───────────────────────────────────────────────────────────

function RestTimerBar({
  remaining,
  duration,
  onSkip,
  onAdjust,
  onChangeDuration,
}: {
  remaining: number;
  duration: number;
  onSkip: () => void;
  onAdjust: (delta: number) => void;
  onChangeDuration: (d: number) => void;
}) {
  const progress = Math.max(0, remaining / duration);
  const urgent   = remaining <= 10;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2">
      <div className={`max-w-lg mx-auto rounded-2xl shadow-xl overflow-hidden transition-colors ${
        urgent ? 'bg-red-600' : 'bg-gray-900'
      }`}>

        {/* Barre de progression */}
        <div className="h-1 bg-white/20">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${urgent ? 'bg-red-200' : 'bg-blue-400'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-3">

          {/* Icône + label */}
          <div className="shrink-0">
            <Timer className="w-5 h-5 text-white/70" />
          </div>

          {/* Décompte */}
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className={`font-mono font-bold tabular-nums text-2xl ${urgent ? 'text-white' : 'text-white'}`}>
                {formatDuration(remaining)}
              </span>
              <span className="text-white/50 text-xs">repos</span>
            </div>

            {/* Presets */}
            <div className="flex gap-1 mt-1.5">
              {REST_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => onChangeDuration(p)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    duration === p
                      ? 'bg-white text-gray-900 border-white font-semibold'
                      : 'border-white/30 text-white/60 hover:border-white/60'
                  }`}
                >
                  {p < 60 ? `${p}s` : `${p / 60}min`}
                </button>
              ))}
            </div>
          </div>

          {/* Contrôles */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onAdjust(-15)}
              className="text-white/70 hover:text-white text-xs px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors font-mono"
            >
              −15
            </button>
            <button
              onClick={() => onAdjust(+15)}
              className="text-white/70 hover:text-white text-xs px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors font-mono"
            >
              +15
            </button>
            <button
              onClick={onSkip}
              className="ml-1 flex items-center gap-1 text-white/70 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Modal de célébration PR ──────────────────────────────────────────────────

function PRCelebrationModal({ prs, onClose }: { prs: NewPR[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full rounded-t-2xl p-6 space-y-5 max-h-[80vh] overflow-y-auto">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-500/30 mb-3">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {prs.length > 1 ? 'Nouveaux Records !' : 'Nouveau Record !'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Tu as battu {prs.length > 1 ? `${prs.length} records` : 'un record'} aujourd'hui
          </p>
        </div>
        <div className="space-y-3">
          {prs.map((pr, i) => (
            <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="font-semibold text-gray-900 text-sm">{pr.exerciseName}</p>
              <p className="text-xs text-yellow-700 mt-0.5">{PR_TYPE_LABEL[pr.type]}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-yellow-600">
                  {pr.type === 'duration'
                    ? formatExerciseTarget(pr.value, 'duration')
                    : `${pr.value} ${PR_TYPE_UNIT[pr.type]}`}
                </span>
                {pr.previousValue > 0 && (
                  <span className="text-xs text-gray-400">
                    (avant : {pr.type === 'duration'
                      ? formatExerciseTarget(pr.previousValue, 'duration')
                      : `${pr.previousValue} ${PR_TYPE_UNIT[pr.type]}`})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full" size="lg" onClick={onClose}>
          Continuer
        </Button>
      </div>
    </div>
  );
}

// ─── Badge PR inline ──────────────────────────────────────────────────────────

function PRBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs bg-yellow-400 text-yellow-900 font-bold px-1.5 py-0.5 rounded-full">
      <Trophy className="w-2.5 h-2.5" />
      PR
    </span>
  );
}

// ─── Chronomètre d'une série en durée (maintien) ─────────────────────────────
// Compte le temps écoulé (démarrer/pause/reprendre/réinitialiser). La durée
// réelle reste éditable à la main avant validation. Le décompte s'arrête à la
// fermeture (il ne tourne jamais en arrière-plan une fois la page quittée).

function DurationTimerModal({
  exerciseName,
  initialSeconds,
  onValidate,
  onClose,
}: {
  exerciseName: string;
  initialSeconds: number;
  onValidate: (seconds: number) => void;
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(Math.max(0, Math.round(initialSeconds)));
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseRef = useRef(seconds);   // secondes accumulées avant le segment courant
  const startRef = useRef(0);        // horodatage du début du segment courant

  const stopInterval = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // Nettoyage : jamais de timer résiduel après fermeture / démontage.
  useEffect(() => () => stopInterval(), []);

  const start = () => {
    if (running) return;
    baseRef.current = seconds;
    startRef.current = Date.now();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setSeconds(baseRef.current + Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
  };
  const pause = () => { stopInterval(); setRunning(false); };
  const reset = () => { stopInterval(); setRunning(false); setSeconds(0); };

  const handleValidate = () => {
    stopInterval();
    onValidate(Math.max(0, Math.round(seconds)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-2xl p-6 space-y-5 max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Maintien</p>
          <h2 className="text-base font-bold text-gray-900 mt-0.5">{exerciseName}</h2>
        </div>

        {/* Décompte */}
        <div className="text-center">
          <span className="font-mono font-bold tabular-nums text-5xl text-gray-900">
            {formatDuration(seconds)}
          </span>
        </div>

        {/* Contrôles chrono */}
        <div className="flex items-center justify-center gap-3">
          {running ? (
            <button
              onClick={pause}
              className="flex items-center gap-1.5 bg-gray-900 text-white font-medium px-5 py-2.5 rounded-full"
            >
              <Pause className="w-4 h-4" /> Pause
            </button>
          ) : (
            <button
              onClick={start}
              className="flex items-center gap-1.5 bg-blue-600 text-white font-medium px-5 py-2.5 rounded-full"
            >
              <Play className="w-4 h-4" /> {seconds > 0 ? 'Reprendre' : 'Démarrer'}
            </button>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-gray-500 border border-gray-200 px-4 py-2.5 rounded-full hover:border-gray-300"
          >
            <RotateCcw className="w-4 h-4" /> Réinit.
          </button>
        </div>

        {/* Ajustement manuel de la durée réelle */}
        <div className="flex items-center justify-center gap-2">
          <label className="text-xs text-gray-400">Durée réelle</label>
          <Input
            type="number"
            min="0"
            inputMode="numeric"
            value={seconds || ''}
            onChange={e => { pause(); setSeconds(Math.max(0, parseInt(e.target.value) || 0)); }}
            className="h-9 w-20 text-center text-sm"
          />
          <span className="text-xs text-gray-400">s</span>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" onClick={handleValidate} disabled={seconds <= 0}>
            <Check className="w-4 h-4 mr-1.5" /> Valider
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function WorkoutSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { exercises, workouts, addWorkout } = useWorkout();

  const exerciseById = useMemo(() => new Map(exercises.map(ex => [ex.id, ex])), [exercises]);

  const isNew = id === 'new';
  const existingWorkout = isNew ? null : workouts.find(w => w.id === id);

  const navState = location.state as {
    program?: { name: string; exercises: ProgramExercise[] };
    repeat?: { name: string; exercises: WorkoutExercise[] };
  } | null;

  // Séance lancée depuis un programme : sets = cibles, poids pré-rempli avec la
  // dernière performance quand elle existe.
  const programStart = navState?.program ?? null;
  const initialFromProgram = useMemo<WorkoutExercise[] | null>(() => {
    if (!isNew || !programStart) return null;
    return programStart.exercises.map(pe => {
      const last = getLastPerformance(workouts, pe.exerciseId)?.[0];
      const isTimed = exerciseMetric(exerciseById.get(pe.exerciseId)) === 'duration';
      return {
        exerciseId: pe.exerciseId,
        sets: Array.from({ length: Math.max(1, pe.sets) }, () => createWorkoutSet(
          isTimed
            // Cible en durée (legacy : ancienne valeur stockée dans reps).
            ? { durationSeconds: pe.durationSeconds ?? pe.reps ?? 0, side: last?.side }
            : { weight: last?.weight ?? 0, reps: pe.reps ?? 0, side: last?.side }
        )),
      };
    });
  }, [isNew, programStart, workouts, exerciseById]);

  // Séance dupliquée depuis une séance passée : reprend exercices + charges/reps/durées.
  const repeatStart = navState?.repeat ?? null;
  const initialFromRepeat = useMemo<WorkoutExercise[] | null>(() => {
    if (!isNew || !repeatStart) return null;
    return repeatStart.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets.map(s => createWorkoutSet({ weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds, side: s.side })),
    }));
  }, [isNew, repeatStart]);

  const fromNav = !!programStart || !!repeatStart;

  // Brouillon d'une séance en cours (uniquement pour une nouvelle séance),
  // lu une seule fois au montage pour restaurer ce qui n'avait pas été terminé.
  const initialDraft = useMemo(() => (isNew ? loadDraft() : null), [isNew]);

  const [name, setName] = useState(
    isNew
      ? repeatStart?.name ?? programStart?.name ?? initialDraft?.name ?? `Séance du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
      : existingWorkout?.name ?? ''
  );
  const [sessionExercises, setSessionExercises] = useState<WorkoutExercise[]>(
    isNew ? (initialFromRepeat ?? initialFromProgram ?? initialDraft?.exercises ?? []) : existingWorkout?.exercises ?? []
  );
  const [elapsed, setElapsed]               = useState(
    isNew && initialDraft && !fromNav ? Math.max(0, Math.floor((Date.now() - initialDraft.startedAt) / 1000)) : 0
  );
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [expandedSets, setExpandedSets]     = useState<Set<string>>(new Set());
  const [newPRs, setNewPRs]                 = useState<NewPR[]>([]);
  const [showPRModal, setShowPRModal]       = useState(false);
  const [timerTarget, setTimerTarget]       = useState<{ exIdx: number; setIdx: number } | null>(null);

  // ─── Timer de repos ─────────────────────────────────────────────────────────
  const [restDuration, setRestDuration] = useState<number>(() => {
    const saved = localStorage.getItem(scopedKey(STORAGE_KEYS.REST_DURATION));
    return saved ? Number(saved) : 90;
  });
  const [restRemaining, setRestRemaining] = useState(0);
  const [restActive, setRestActive]       = useState(false);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRest = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestActive(false);
    setRestRemaining(0);
  }, []);

  const startRest = useCallback((duration: number) => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestRemaining(duration);
    setRestActive(true);
    restIntervalRef.current = setInterval(() => {
      setRestRemaining(prev => {
        if (prev <= 1) {
          clearInterval(restIntervalRef.current!);
          setRestActive(false);
          playBeep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const adjustRest = useCallback((delta: number) => {
    setRestRemaining(prev => {
      const next = Math.max(5, prev + delta);
      return next;
    });
  }, []);

  const handleChangeDuration = useCallback((d: number) => {
    setRestDuration(d);
    localStorage.setItem(scopedKey(STORAGE_KEYS.REST_DURATION), String(d));
    startRest(d);
  }, [startRest]);

  // Nettoyage à l'unmount
  useEffect(() => () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); }, []);

  // ─── Timer de séance ─────────────────────────────────────────────────────────
  const startTimeRef = useRef<number>(
    isNew && !fromNav ? initialDraft?.startedAt ?? Date.now() : Date.now()
  );

  useEffect(() => {
    if (!isNew) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, [isNew]);

  // ─── Sauvegarde automatique du brouillon ─────────────────────────────────────
  // À chaque modification, on persiste la séance en cours pour qu'elle survive à
  // un changement d'onglet, un rafraîchissement ou une mise en veille.
  useEffect(() => {
    if (!isNew) return;
    if (sessionExercises.length === 0) {
      clearDraft(); // rien de significatif à conserver
      return;
    }
    saveDraft({ name, exercises: sessionExercises, startedAt: startTimeRef.current });
  }, [isNew, name, sessionExercises]);

  // ─── Records actuels (snapshot au démarrage) ─────────────────────────────────
  // On conserve charge max ET meilleur maintien pour signaler le bon type de PR.
  const currentPRs = useMemo(() => {
    const map = new Map<string, { maxWeight: number; maxDuration: number }>();
    for (const ex of exercises) {
      const pr = getExercisePR(workouts, ex.id);
      if (pr) map.set(ex.id, { maxWeight: pr.maxWeight, maxDuration: pr.maxDuration });
    }
    return map;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const toggleSetExpand = (setId: string) => {
    setExpandedSets(prev => {
      const next = new Set(prev);
      next.has(setId) ? next.delete(setId) : next.add(setId);
      return next;
    });
  };

  const addExerciseToSession = (exerciseId: string) => {
    // Pré-remplit avec la dernière performance (charges/reps) si elle existe.
    const last = getLastPerformance(workouts, exerciseId);
    const sets = last && last.length > 0
      ? last.map(s => createWorkoutSet({ weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds, side: s.side }))
      : [createWorkoutSet()];
    setSessionExercises(prev => [...prev, { exerciseId, sets }]);
    setDialogOpen(false);
    setExerciseSearch('');
  };

  const addSet = (exerciseIdx: number) => {
    setSessionExercises(prev =>
      prev.map((ex, i) =>
        i === exerciseIdx
          ? { ...ex, sets: [...ex.sets, createWorkoutSet({ side: ex.sets[ex.sets.length - 1]?.side })] }
          : ex
      )
    );
  };

  type SetValue = number | boolean | string | undefined;

  const updateSet = (exerciseIdx: number, setIdx: number, field: keyof WorkoutSet, value: SetValue) => {
    setSessionExercises(prev =>
      prev.map((ex, i) =>
        i === exerciseIdx
          ? { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)) }
          : ex
      )
    );
    // Démarrer le timer de repos quand une série est validée
    if (field === 'completed' && value === true && isNew) {
      startRest(restDuration);
    }
    // Arrêter le timer si on dévalide la série
    if (field === 'completed' && value === false && restActive) {
      stopRest();
    }
  };

  const removeSet = (exerciseIdx: number, setIdx: number) => {
    setSessionExercises(prev =>
      prev.map((ex, i) =>
        i === exerciseIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
      )
    );
  };

  const removeExercise = (exerciseIdx: number) => {
    setSessionExercises(prev => prev.filter((_, i) => i !== exerciseIdx));
  };

  // Validation du chronomètre : enregistre la durée réelle puis valide la série
  // (ce qui déclenche aussi le timer de repos, comme une validation manuelle).
  const handleTimerValidate = (seconds: number) => {
    if (!timerTarget) return;
    const { exIdx, setIdx } = timerTarget;
    updateSet(exIdx, setIdx, 'durationSeconds', seconds);
    updateSet(exIdx, setIdx, 'completed', true);
    setTimerTarget(null);
  };

  const finishWorkout = () => {
    if (sessionExercises.length === 0) {
      alert('Ajoutez au moins un exercice avant de terminer.');
      return;
    }
    stopRest();
    const workout = {
      name,
      date: new Date().toISOString(),
      exercises: sessionExercises,
      duration: elapsed,
    };
    const exerciseNames = new Map(exercises.map(e => [e.id, e.name]));
    const prs = detectNewPRs(workouts, workout, exerciseNames);
    addWorkout(workout);
    clearDraft(); // la séance est enregistrée : plus besoin du brouillon
    if (prs.length > 0) {
      setNewPRs(prs);
      setShowPRModal(true);
    } else {
      navigate('/workouts');
    }
  };

  const abandonWorkout = () => {
    if (
      sessionExercises.length > 0 &&
      !window.confirm('Abandonner cette séance ? Les données non enregistrées seront perdues.')
    ) {
      return;
    }
    stopRest();
    clearDraft();
    navigate('/workouts');
  };

  const filteredExercises = exercises.filter(e => matchesExerciseSearch(e, exerciseSearch));
  const alreadyAdded = new Set(sessionExercises.map(e => e.exerciseId));

  if (!isNew && !existingWorkout) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>Séance introuvable.</p>
        <Button variant="link" onClick={() => navigate('/workouts')}>Retour</Button>
      </div>
    );
  }

  return (
    <>
      {showPRModal && <PRCelebrationModal prs={newPRs} onClose={() => navigate('/workouts')} />}

      {timerTarget && (() => {
        const wEx = sessionExercises[timerTarget.exIdx];
        const tSet = wEx?.sets[timerTarget.setIdx];
        const tExercise = wEx ? exerciseById.get(wEx.exerciseId) : undefined;
        return (
          <DurationTimerModal
            exerciseName={tExercise?.name ?? 'Maintien'}
            initialSeconds={tSet?.durationSeconds ?? 0}
            onValidate={handleTimerValidate}
            onClose={() => setTimerTarget(null)}
          />
        );
      })()}

      {/* Timer de repos flottant */}
      {restActive && isNew && (
        <RestTimerBar
          remaining={restRemaining}
          duration={restDuration}
          onSkip={stopRest}
          onAdjust={adjustRest}
          onChangeDuration={handleChangeDuration}
        />
      )}

      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            {isNew ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nom de la séance"
                className="text-xl font-bold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-400 focus:outline-none w-full pb-0.5 transition-colors"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-900">{name}</h2>
            )}
            {!isNew && existingWorkout && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(existingWorkout.date).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
                {existingWorkout.duration ? ` · ${Math.round(existingWorkout.duration / 60)} min` : ''}
              </p>
            )}
          </div>
          {isNew && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Bouton démarrage manuel du timer */}
              <button
                onClick={() => restActive ? stopRest() : startRest(restDuration)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  restActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
                title="Timer de repos"
              >
                {restActive ? <X className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
                {restActive ? formatDuration(restRemaining) : formatDuration(restDuration)}
              </button>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span className="font-mono text-xs">{formatDuration(elapsed)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Exercices */}
        <div className="space-y-4">
          {sessionExercises.map((workoutEx, exIdx) => {
            const exercise       = exerciseById.get(workoutEx.exerciseId);
            const completedCount = workoutEx.sets.filter(s => s.completed).length;
            const exercisePR     = currentPRs.get(workoutEx.exerciseId);
            const prevMaxWeight  = exercisePR?.maxWeight ?? 0;
            const prevMaxDuration = exercisePR?.maxDuration ?? 0;
            const isTimedExercise = exerciseMetric(exercise) === 'duration';
            const isUnilateral = !!exercise?.unilateral;
            // Colonne de valeur élargie en mode durée (input + bouton chrono).
            const valueCol = isTimedExercise ? '1.6fr' : '1fr';
            const gridTemplate = isUnilateral
              ? `1.5rem 1fr ${valueCol} 4.5rem 2rem 1.5rem`
              : `1.5rem 1fr ${valueCol} 2rem 1.5rem`;

            return (
              <div key={workoutEx.exerciseId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                <div className="flex justify-between items-center px-4 pt-4 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{exercise?.name ?? 'Exercice'}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{exercise?.muscleGroup}</span>
                      {isTimedExercise
                        ? prevMaxDuration > 0 && (
                            <span className="text-xs text-gray-300">· record : {formatExerciseTarget(prevMaxDuration, 'duration')}</span>
                          )
                        : prevMaxWeight > 0 && (
                            <span className="text-xs text-gray-300">· record : {prevMaxWeight} kg</span>
                          )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {completedCount}/{workoutEx.sets.length}
                    </span>
                    {isNew && (
                      <button
                        onClick={() => removeExercise(exIdx)}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-4 pt-2">
                  <div className="grid gap-2 mb-1.5 px-0.5" style={{ gridTemplateColumns: gridTemplate }}>
                    <span className="text-xs text-gray-400">#</span>
                    <span className="text-xs text-gray-400 text-center">kg</span>
                    <span className="text-xs text-gray-400 text-center">{exerciseSetUnit(exercise?.metric)}</span>
                    {isUnilateral && <span className="text-xs text-gray-400 text-center">côté</span>}
                    <span />
                    <span />
                  </div>

                  <div className="space-y-1 pb-3">
                    {workoutEx.sets.map((set, setIdx) => {
                      const isExpanded  = expandedSets.has(set.id);
                      const hasExtra    = set.rpe !== undefined || set.rir !== undefined || !!set.notes?.trim();
                      const isWeightPR  = isNew && !isTimedExercise && set.weight > 0 && set.weight > prevMaxWeight;
                      const isDurationPR = isNew && isTimedExercise && (set.durationSeconds ?? 0) > 0 && (set.durationSeconds ?? 0) > prevMaxDuration;
                      const est1RM      = !isTimedExercise && set.weight > 0 && set.reps > 0 ? epley1RM(set.weight, set.reps) : 0;

                      return (
                        <div key={set.id} className="space-y-1">
                          <div
                            className={`grid gap-2 items-center rounded-lg transition-colors ${
                              (isWeightPR || isDurationPR) && set.completed ? 'bg-yellow-50' : ''
                            }`}
                            style={{ gridTemplateColumns: gridTemplate }}
                          >
                            <span className={`text-xs font-medium text-center ${set.completed ? 'text-green-600' : 'text-gray-400'}`}>
                              {setIdx + 1}
                            </span>
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={set.weight || ''}
                                onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className={`h-8 text-center text-sm ${isWeightPR ? 'border-yellow-400 bg-yellow-50' : ''}`}
                                readOnly={!isNew}
                              />
                            </div>
                            {isTimedExercise ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  inputMode="numeric"
                                  value={set.durationSeconds || ''}
                                  onChange={e => updateSet(exIdx, setIdx, 'durationSeconds', parseInt(e.target.value) || 0)}
                                  placeholder="0 s"
                                  className="h-8 text-center text-sm flex-1 min-w-0"
                                  readOnly={!isNew}
                                />
                                {isNew && (
                                  <button
                                    type="button"
                                    onClick={() => setTimerTarget({ exIdx, setIdx })}
                                    className="shrink-0 w-8 h-8 rounded-md border border-gray-200 text-blue-600 flex items-center justify-center hover:border-blue-300 transition-colors"
                                    aria-label="Chronométrer ce maintien"
                                    title="Chronométrer ce maintien"
                                  >
                                    <Timer className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min="0"
                                value={set.reps || ''}
                                onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="h-8 text-center text-sm"
                                readOnly={!isNew}
                              />
                            )}
                            {isUnilateral && (
                              <div className="flex items-center justify-center gap-1">
                                {([
                                  { value: 'left' as const, label: 'G', title: 'Gauche' },
                                  { value: 'right' as const, label: 'D', title: 'Droite' },
                                ]).map(option => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => isNew && updateSet(exIdx, setIdx, 'side', set.side === option.value ? undefined : option.value)}
                                    disabled={!isNew}
                                    title={option.title}
                                    className={`w-8 h-8 rounded-md border text-xs font-semibold transition-colors ${
                                      set.side === option.value
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 disabled:cursor-default'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => isNew && updateSet(exIdx, setIdx, 'completed', !set.completed)}
                              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                                set.completed
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : isNew
                                  ? 'border-gray-300 text-transparent hover:border-green-400'
                                  : 'border-gray-200'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => toggleSetExpand(set.id)}
                              className={`flex items-center justify-center transition-colors ${
                                hasExtra ? 'text-blue-400' : 'text-gray-300 hover:text-gray-500'
                              }`}
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          {!isExpanded && (isWeightPR || isDurationPR || hasExtra) && (
                            <div className="flex flex-wrap items-center gap-2 pl-7 pb-0.5">
                              {(isWeightPR || isDurationPR) && set.completed && <PRBadge />}
                              {isWeightPR && est1RM > 0 && (
                                <span className="text-xs text-gray-400">1RM estimé : {est1RM} kg</span>
                              )}
                              {set.side && (
                                <span className="text-xs text-gray-400">{set.side === 'left' ? 'Gauche' : 'Droite'}</span>
                              )}
                              {set.rpe !== undefined && (
                                <span className="text-xs text-blue-600 font-medium">RPE {set.rpe}</span>
                              )}
                              {set.rir !== undefined && (
                                <span className="text-xs text-purple-600 font-medium">RIR {set.rir}</span>
                              )}
                              {set.notes && (
                                <span className="text-xs text-gray-400 italic truncate max-w-[160px]">"{set.notes}"</span>
                              )}
                            </div>
                          )}

                          {isExpanded && (
                            <div className="ml-7 bg-gray-50 rounded-lg p-3 space-y-3 border border-gray-100">
                              {set.side && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Côté</span>
                                  <span className="font-semibold text-gray-700">{set.side === 'left' ? 'Gauche' : 'Droite'}</span>
                                </div>
                              )}
                              {est1RM > 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">1RM estimé (Epley)</span>
                                  <span className={`inline-flex items-center gap-1 font-semibold ${isWeightPR ? 'text-yellow-600' : 'text-gray-700'}`}>
                                    {est1RM} kg {isWeightPR && <Trophy className="w-3 h-3" />}
                                  </span>
                                </div>
                              )}

                              <div>
                                <div className="flex justify-between items-center mb-1.5">
                                  <p className="text-xs font-semibold text-gray-500">
                                    RPE <span className="font-normal text-gray-400">(effort perçu)</span>
                                  </p>
                                  {set.rpe !== undefined && (
                                    <button onClick={() => updateSet(exIdx, setIdx, 'rpe', undefined)} className="text-xs text-gray-400 hover:text-red-400">
                                      Effacer
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {RPE_VALUES.map(v => (
                                    <button
                                      key={v}
                                      onClick={() => isNew && updateSet(exIdx, setIdx, 'rpe', set.rpe === v ? undefined : v)}
                                      disabled={!isNew}
                                      className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                                        set.rpe === v
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 disabled:cursor-default'
                                      }`}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                                {set.rpe !== undefined && (
                                  <p className="text-xs text-gray-400 mt-1">{rpeDescription(set.rpe)}</p>
                                )}
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-1.5">
                                  <p className="text-xs font-semibold text-gray-500">
                                    RIR <span className="font-normal text-gray-400">(reps en réserve)</span>
                                  </p>
                                  {set.rir !== undefined && (
                                    <button onClick={() => updateSet(exIdx, setIdx, 'rir', undefined)} className="text-xs text-gray-400 hover:text-red-400">
                                      Effacer
                                    </button>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  {RIR_VALUES.map(v => (
                                    <button
                                      key={v}
                                      onClick={() => isNew && updateSet(exIdx, setIdx, 'rir', set.rir === v ? undefined : v)}
                                      disabled={!isNew}
                                      className={`text-xs px-3 py-1 rounded border font-medium transition-colors ${
                                        set.rir === v
                                          ? 'bg-purple-600 text-white border-purple-600'
                                          : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 disabled:cursor-default'
                                      }`}
                                    >
                                      {v === 4 ? '4+' : v}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1.5">Note</p>
                                <input
                                  type="text"
                                  value={set.notes ?? ''}
                                  onChange={e => updateSet(exIdx, setIdx, 'notes', e.target.value || undefined)}
                                  placeholder="ex: dos qui tire, prise en supination…"
                                  readOnly={!isNew}
                                  className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 placeholder:text-gray-300 focus:outline-none focus:border-blue-400 bg-white"
                                />
                              </div>

                              {isNew && workoutEx.sets.length > 1 && (
                                <button
                                  onClick={() => { removeSet(exIdx, setIdx); toggleSetExpand(set.id); }}
                                  className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 pt-0.5"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Supprimer cette série
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isNew && (
                  <div className="px-4 pb-3 border-t border-gray-50 pt-2">
                    <button
                      onClick={() => addSet(exIdx)}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une série
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        {isNew && (
          <div className="space-y-3">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un exercice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Choisir un exercice</DialogTitle>
                </DialogHeader>
                <Input
                  placeholder="Rechercher…"
                  value={exerciseSearch}
                  onChange={e => setExerciseSearch(e.target.value)}
                  className="mb-3"
                  autoFocus
                />
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {filteredExercises.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => addExerciseToSession(ex.id)}
                      disabled={alreadyAdded.has(ex.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900">{ex.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{ex.muscleGroup}</span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Button className="w-full" size="lg" onClick={finishWorkout}>
              Terminer la séance
            </Button>

            <button
              onClick={abandonWorkout}
              className="w-full text-sm text-gray-400 hover:text-red-500 transition-colors py-1"
            >
              Abandonner la séance
            </button>
          </div>
        )}
      </div>
    </>
  );
}
