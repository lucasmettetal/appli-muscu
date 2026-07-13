import type { Exercise } from '../context/WorkoutContext';
import { GeminiAIService, geminiKeyName } from './ai-service';

// ─── Programme généré (format intermédiaire, avant sauvegarde) ────────────────

export interface GeneratedProgramExercise {
  exerciseId: string;
  sets: number;
  reps?: number;
}
export interface GeneratedProgramDay {
  name: string;
  exercises: GeneratedProgramExercise[];
}
export interface GeneratedProgram {
  name: string;
  description?: string;
  days: GeneratedProgramDay[];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

// ─── Prompt système : impose un JSON strict référençant nos exerciseId ────────

export function buildProgramSystemPrompt(exercises: Exercise[]): string {
  const catalog = exercises
    .map(e => `${e.id} | ${e.name} | ${e.muscleGroup}`)
    .join('\n');

  return `Tu es un coach de musculation. Tu crées un programme d'entraînement structuré à partir de la demande de l'utilisateur.

Tu DOIS répondre UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises Markdown. Format exact :

{
  "name": "Nom court du programme",
  "description": "Une phrase de résumé",
  "days": [
    { "name": "Nom du jour (ex: Jour A - Push)", "exercises": [ { "exerciseId": "id", "sets": 4, "reps": 8 } ] }
  ]
}

RÈGLES :
- "exerciseId" DOIT provenir EXACTEMENT de la liste ci-dessous (n'invente aucun id).
- Choisis des exercices cohérents avec la demande et les groupes musculaires.
- "sets" entre 2 et 6, "reps" entre 3 et 20.
- 3 à 6 exercices par jour.

CATALOGUE D'EXERCICES DISPONIBLES (id | nom | groupe) :
${catalog}`;
}

// ─── Parsing + validation de la réponse ───────────────────────────────────────

export function parseProgramResponse(text: string, exercises: Exercise[]): GeneratedProgram | null {
  const validIds = new Set(exercises.map(e => e.id));

  // Extrait le bloc JSON même si le modèle ajoute du texte ou des balises ```.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.days)) return null;

  const days: GeneratedProgramDay[] = [];
  for (const d of obj.days as unknown[]) {
    if (!d || typeof d !== 'object') continue;
    const day = d as Record<string, unknown>;
    if (!Array.isArray(day.exercises)) continue;

    const exs: GeneratedProgramExercise[] = [];
    for (const e of day.exercises as unknown[]) {
      if (!e || typeof e !== 'object') continue;
      const ex = e as Record<string, unknown>;
      if (typeof ex.exerciseId !== 'string' || !validIds.has(ex.exerciseId)) continue;
      const sets = clamp(Number(ex.sets) || 3, 1, 10);
      const reps = ex.reps !== undefined && Number.isFinite(Number(ex.reps))
        ? clamp(Number(ex.reps), 1, 30)
        : undefined;
      exs.push({ exerciseId: ex.exerciseId, sets, ...(reps !== undefined ? { reps } : {}) });
    }

    if (exs.length === 0) continue; // on ignore un jour sans exercice valide
    const name = typeof day.name === 'string' && day.name.trim() ? day.name.trim() : `Jour ${days.length + 1}`;
    days.push({ name, exercises: exs });
  }

  if (days.length === 0) return null;

  return {
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Programme',
    description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
    days,
  };
}

// ─── Générateur de secours (mode démo, sans clé API) ──────────────────────────

const DAY_TEMPLATES: { name: string; cats: Exercise['category'][] }[] = [
  { name: 'Push (pectoraux, épaules, triceps)', cats: ['chest', 'shoulders', 'arms'] },
  { name: 'Pull (dos, biceps)', cats: ['back', 'arms'] },
  { name: 'Jambes', cats: ['legs', 'core'] },
  { name: 'Haut du corps', cats: ['chest', 'back', 'shoulders', 'arms'] },
  { name: 'Bas du corps', cats: ['legs', 'core'] },
];

function pickExercises(exercises: Exercise[], cats: Exercise['category'][], limit = 5): Exercise[] {
  const inCats = exercises.filter(e => cats.includes(e.category));
  // Priorité aux exercices polyarticulaires.
  const sorted = [...inCats].sort((a, b) => (a.type === 'compound' ? -1 : 1) - (b.type === 'compound' ? -1 : 1));
  return sorted.slice(0, limit);
}

export function mockGenerateProgram(request: string, exercises: Exercise[]): GeneratedProgram {
  const match = request.match(/(\d+)/);
  const dayCount = clamp(match ? Number(match[1]) : 3, 1, 6);

  const days: GeneratedProgramDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const template = DAY_TEMPLATES[i % DAY_TEMPLATES.length];
    const picked = pickExercises(exercises, template.cats);
    const fallback = picked.length > 0 ? picked : exercises.slice(0, 4);
    days.push({
      name: template.name,
      exercises: fallback.map(e => ({ exerciseId: e.id, sets: 4, reps: 8 })),
    });
  }

  return {
    name: `Programme ${dayCount} jour${dayCount > 1 ? 's' : ''}`,
    description: 'Programme généré automatiquement (mode démo). Ajoute ta clé Gemini pour un programme personnalisé.',
    days,
  };
}

// ─── Point d'entrée : Gemini si clé dispo, sinon mock ─────────────────────────

export async function generateProgram(request: string, exercises: Exercise[]): Promise<GeneratedProgram> {
  const key = localStorage.getItem(geminiKeyName());
  if (!key) {
    return mockGenerateProgram(request, exercises);
  }

  const svc = new GeminiAIService(key);
  const text = await svc.chat(
    [{ role: 'user', content: request || 'Crée-moi un programme de musculation équilibré sur 3 jours.' }],
    buildProgramSystemPrompt(exercises),
  );
  const parsed = parseProgramResponse(text, exercises);
  // Si le modèle n'a pas renvoyé un JSON exploitable, on retombe sur le mock.
  return parsed ?? mockGenerateProgram(request, exercises);
}
