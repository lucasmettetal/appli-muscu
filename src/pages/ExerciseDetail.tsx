import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useWorkout } from '../context/WorkoutContext';
import { EQUIPMENT_LABEL, DIFFICULTY_LABEL, DIFFICULTY_STYLE, TYPE_LABEL, CATEGORY_LABEL } from '@/lib/exercise-utils';
import { exercisePlaceholderUrl, FORCE_LABEL, formatEquipment, formatMuscle } from '@/lib/exercise-db';
import {
  getExercisePR,
  getExerciseHistory,
  getProgressionStatus,
  type SessionSnapshot,
  type ProgressionResult,
} from '@/lib/pr-utils';
import instructionsData from '../data/exercise-instructions.json';
import { geminiKeyName, GeminiAIService } from '@/lib/ai-service';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ChevronLeft, Award, Dumbbell, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, Minus, Languages, Loader2,
} from 'lucide-react';

type InstructionKey = keyof typeof instructionsData;

// ─── Sous-composants génériques ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ImageSlot({ src, label }: { src: string | null; label: string }) {
  return (
    <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      <img
        src={src ?? exercisePlaceholderUrl}
        onError={event => { event.currentTarget.src = exercisePlaceholderUrl; }}
        alt={label}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
      <span className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-0.5 rounded-full">
        {label}
      </span>
    </div>
  );
}

// ─── Instructions (banque : anglais + traduction Gemini à la demande) ────────

const TR_KEY = 'muscu_instr_fr';
function loadAllTr(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(TR_KEY) || '{}'); } catch { return {}; }
}
function saveTranslation(id: string, steps: string[]) {
  const m = loadAllTr();
  m[id] = steps;
  try { localStorage.setItem(TR_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

async function translateSteps(steps: string[]): Promise<string[]> {
  const key = localStorage.getItem(geminiKeyName());
  if (!key) throw new Error('Clé Gemini absente');
  const svc = new GeminiAIService(key);
  const numbered = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const system =
    "Tu es un traducteur spécialisé en musculation. Traduis en français chaque étape ci-dessous. " +
    "Renvoie UNIQUEMENT les étapes traduites, une par ligne, dans le même ordre, sans numéro ni commentaire.";
  const out = await svc.chat([{ role: 'user', content: numbered }], system);
  const lines = out.split('\n').map(l => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  return lines.length ? lines : [out.trim()];
}

function StepsList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
        </li>
      ))}
    </ol>
  );
}

function InstructionsBlock({
  exerciseId,
  builtinSteps,
  frenchSteps,
  englishSteps,
}: {
  exerciseId: string;
  builtinSteps?: string[];
  frenchSteps?: string[];
  englishSteps?: string[];
}) {
  const [translated, setTranslated] = useState<string[] | null>(() => loadAllTr()[exerciseId] ?? null);
  const [translating, setTranslating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Priorité aux instructions françaises intégrées (les 30 de base).
  const integratedFrench = builtinSteps?.length ? builtinSteps : frenchSteps;
  if (integratedFrench && integratedFrench.length > 0) {
    return <Section title="Instructions"><StepsList steps={integratedFrench} /></Section>;
  }
  if (!englishSteps || englishSteps.length === 0) return null;

  const steps = translated ?? englishSteps;
  const isEnglish = !translated;
  const hasKey = !!localStorage.getItem(geminiKeyName());

  const handleTranslate = async () => {
    setTranslating(true);
    setErr(null);
    try {
      const fr = await translateSteps(englishSteps);
      setTranslated(fr);
      saveTranslation(exerciseId, fr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Traduction impossible');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <Section title="Instructions">
      {isEnglish && (
        <div className="mb-3">
          {hasKey ? (
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
              {translating ? 'Traduction…' : 'Traduire en français'}
            </button>
          ) : (
            <p className="text-xs text-gray-400">
              Instructions en anglais. Ajoute ta clé Gemini (onglet <span className="font-medium">Coach IA</span>) pour les traduire.
            </p>
          )}
          {err && <p className="text-xs text-red-500 mt-1.5">{err}</p>}
        </div>
      )}
      <StepsList steps={steps} />
    </Section>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      {icon && <div className="flex justify-center mb-1">{icon}</div>}
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

// ─── Section Progression ──────────────────────────────────────────────────────

type ChartMetric = '1RM' | 'Charge max' | 'Volume';

const STATUS_STYLE: Record<string, { pill: string; icon: React.ReactNode }> = {
  positive:     { pill: 'bg-green-50 text-green-700 border-green-200',    icon: <TrendingUp   className="w-3.5 h-3.5" /> },
  stable:       { pill: 'bg-blue-50  text-blue-700  border-blue-200',     icon: <Minus        className="w-3.5 h-3.5" /> },
  stagnation:   { pill: 'bg-orange-50 text-orange-700 border-orange-200', icon: <TrendingDown className="w-3.5 h-3.5" /> },
  insufficient: { pill: 'bg-gray-50  text-gray-500  border-gray-200',     icon: <Minus        className="w-3.5 h-3.5" /> },
};

const METRIC_COLOR: Record<ChartMetric, string> = {
  '1RM':        '#3b82f6',
  'Charge max': '#f59e0b',
  'Volume':     '#8b5cf6',
};

function ProgressionSection({
  snapshots,
  progression,
}: {
  snapshots: SessionSnapshot[];
  progression: ProgressionResult;
}) {
  const [metric, setMetric] = useState<ChartMetric>('1RM');
  const style = STATUS_STYLE[progression.status] ?? STATUS_STYLE.insufficient;

  const chartData = snapshots.map(s => ({
    date:         new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    '1RM':        s.estimated1RM,
    'Charge max': s.maxWeight,
    'Volume':     s.totalVolume,
  }));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Progression</h3>

      {/* Badge statut */}
      <div>
        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${style.pill}`}>
          {style.icon}
          {progression.label}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">{progression.description}</p>
      </div>

      {/* Graphique (seulement si ≥ 2 séances) */}
      {snapshots.length >= 2 && (
        <>
          <div className="flex gap-1 flex-wrap">
            {(['1RM', 'Charge max', 'Volume'] as ChartMetric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  metric === m
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {m === 'Volume' ? 'Volume (kg)' : m}
              </button>
            ))}
          </div>

          <div className="h-44 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', padding: '6px 10px' }}
                  formatter={(val: number) => [`${val} kg`, metric]}
                  labelStyle={{ color: '#6b7280', marginBottom: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke={METRIC_COLOR[metric]}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: METRIC_COLOR[metric], strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Timeline chronologique inversée (plus récent en premier) */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Historique par séance</p>
        {[...snapshots].reverse().map((snap, i) => {
          // snap à i=0 est la dernière séance ; la précédente est snapshots[length-2]
          const prevIndex = snapshots.length - 1 - i - 1;
          const prev = prevIndex >= 0 ? snapshots[prevIndex] : null;
          const trend = prev
            ? snap.estimated1RM > prev.estimated1RM ? 'up'
            : snap.estimated1RM < prev.estimated1RM ? 'down'
            : 'eq'
            : null;
          const isLatest = i === 0;

          return (
            <div
              key={snap.date + i}
              className={`rounded-lg border px-3 py-2.5 ${isLatest ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100'}`}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-400">
                  {new Date(snap.date).toLocaleDateString('fr-FR', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </span>
                <div className="flex items-center gap-1">
                  {trend === 'up'   && <TrendingUp   className="w-3.5 h-3.5 text-green-500" />}
                  {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-orange-400" />}
                  {trend === 'eq'   && <Minus        className="w-3.5 h-3.5 text-gray-400" />}
                  <span className={`text-xs font-bold ${isLatest ? 'text-blue-700' : 'text-gray-700'}`}>
                    1RM ~{snap.estimated1RM} kg
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                <span>Max <strong className="text-gray-900">{snap.maxWeight} kg</strong></span>
                <span>
                  Meilleur set{' '}
                  <strong className="text-gray-900">{snap.bestSetWeight}×{snap.bestSetReps}</strong>
                </span>
                <span>Vol. <strong className="text-gray-900">{snap.totalVolume} kg</strong></span>
                <span className="text-gray-400">{snap.setCount} série{snap.setCount > 1 ? 's' : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { exercises, workouts } = useWorkout();

  const exercise = exercises.find(e => e.id === id);

  if (!exercise) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>Exercice introuvable.</p>
        <button onClick={() => navigate('/exercises')} className="text-blue-600 text-sm mt-2">
          Retour aux exercices
        </button>
      </div>
    );
  }

  // Contenu éditorial
  const content = id && id in instructionsData
    ? instructionsData[id as InstructionKey]
    : null;

  // Historique pour les cards récentes (vue séance)
  const history = workouts
    .filter(w => w.exercises.some(e => e.exerciseId === id))
    .map(w => {
      const ex = w.exercises.find(e => e.exerciseId === id)!;
      const weights = ex.sets.map(s => s.weight).filter(Boolean);
      const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
      const totalVolume = ex.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      const completedSets = ex.sets.filter(s => s.completed).length;
      const rpeSets = ex.sets.filter(s => s.rpe !== undefined);
      const avgRpe = rpeSets.length > 0
        ? rpeSets.reduce((sum, s) => sum + (s.rpe ?? 0), 0) / rpeSets.length
        : null;
      return { workoutId: w.id, date: w.date, workoutName: w.name, maxWeight, totalVolume, sets: ex.sets.length, completedSets, avgRpe };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const prData    = id ? getExercisePR(workouts, id) : null;
  const snapshots = id ? getExerciseHistory(workouts, id) : [];
  const progression = getProgressionStatus(snapshots);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="mt-0.5 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{exercise.name}</h2>
          {exercise.nameEn && (
            <p className="text-xs text-gray-400 mt-0.5">{exercise.nameEn}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
              {CATEGORY_LABEL[exercise.category] ?? exercise.category}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_STYLE[exercise.difficulty] ?? ''}`}>
              {DIFFICULTY_LABEL[exercise.difficulty] ?? exercise.difficulty}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
              {TYPE_LABEL[exercise.type] ?? exercise.type}
            </span>
            {exercise.force && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                {FORCE_LABEL[exercise.force] ?? exercise.force}
              </span>
            )}
            {exercise.unilateral && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Unilatéral</span>
            )}
            {exercise.bodyweight && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Poids du corps</span>
            )}
          </div>
        </div>
      </div>

      {/* Visuels */}
      <div className="grid grid-cols-2 gap-3">
        <ImageSlot src={exercise.imageStart} label="Position départ" />
        <ImageSlot src={exercise.imageEnd} label="Position finale" />
      </div>

      {/* Muscles */}
      {(exercise.musclesPrimary.length > 0 || exercise.musclesSecondary.length > 0) && (
        <Section title="Muscles travaillés">
          {exercise.musclesPrimary.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Principal</p>
              <div className="flex flex-wrap gap-1.5">
                {exercise.musclesPrimary.map(m => (
                  <span key={m} className="text-sm bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium capitalize">
                    {formatMuscle(m)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {exercise.musclesSecondary.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Secondaire</p>
              <div className="flex flex-wrap gap-1.5">
                {exercise.musclesSecondary.map(m => (
                  <span key={m} className="text-sm bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize">
                    {formatMuscle(m)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Matériel */}
      {exercise.equipment.length > 0 && (
        <Section title="Matériel requis">
          <div className="flex flex-wrap gap-2">
            {exercise.equipment.map(eq => (
              <span key={eq} className="text-sm bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1 rounded-full">
                {EQUIPMENT_LABEL[eq] ?? formatEquipment(eq)}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Instructions (intégrées FR, ou inline EN de la banque avec traduction) */}
      {id && (
        <InstructionsBlock
          exerciseId={id}
          builtinSteps={content?.instructions}
          frenchSteps={exercise.instructionsFr ?? (exercise.source !== 'free-exercise-db' ? exercise.instructions : undefined)}
          englishSteps={exercise.instructionsEn ?? (exercise.source === 'free-exercise-db' ? exercise.instructions : undefined)}
        />
      )}

      {/* Conseils */}
      {content?.tips && content.tips.length > 0 && (
        <Section title="Conseils clés">
          <ul className="space-y-2.5">
            {content.tips.map((tip, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                {tip}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Erreurs fréquentes */}
      {content?.commonMistakes && content.commonMistakes.length > 0 && (
        <Section title="Erreurs fréquentes">
          <ul className="space-y-2.5">
            {content.commonMistakes.map((mistake, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                {mistake}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!content && !exercise.instructionsFr?.length && !exercise.instructionsEn?.length && (!exercise.instructions || exercise.instructions.length === 0) && (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-400">Instructions à venir pour cet exercice.</p>
        </div>
      )}

      {/* Progression — visible dès la 1ère séance */}
      {snapshots.length >= 1 && (
        <ProgressionSection snapshots={snapshots} progression={progression} />
      )}

      {/* Performances personnelles */}
      <Section title="Mes performances">
        {history.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            <Dumbbell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">Aucune séance avec cet exercice</p>
            <Link to="/workout/new" className="text-blue-600 hover:text-blue-700 text-xs mt-2 inline-block">
              Démarrer une séance →
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatBox
                label="Record charge"
                value={prData ? `${prData.maxWeight} kg` : '—'}
                icon={<Award className="w-4 h-4 text-yellow-500" />}
              />
              <StatBox
                label="1RM estimé"
                value={prData?.estimated1RM ? `${prData.estimated1RM} kg` : '—'}
                icon={<Award className="w-4 h-4 text-orange-400" />}
              />
              <StatBox label="Séances" value={history.length} />
              <StatBox
                label="Dernière"
                value={new Date(history[0].date).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short',
                })}
              />
            </div>

            <div className="space-y-2">
              {history.slice(0, 5).map(h => (
                <Link
                  key={h.workoutId}
                  to={`/workout/${h.workoutId}`}
                  className="flex justify-between items-center py-2.5 px-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{h.workoutName}</p>
                    <p className="text-xs text-gray-400">
                      {h.completedSets}/{h.sets} séries · vol. {h.totalVolume} kg
                      {h.avgRpe !== null && (
                        <span className="ml-1 text-blue-500">· RPE {h.avgRpe.toFixed(1)}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{h.maxWeight} kg</p>
                    <p className="text-xs text-gray-400">
                      {new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </Section>

    </div>
  );
}
