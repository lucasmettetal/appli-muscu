import { STORAGE_KEYS } from '../context/WorkoutContext';
import { scopedKey } from './profiles';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIService {
  chat(messages: AIMessage[], systemPrompt: string): Promise<string>;
}

// ─── Mock (mode démo sans clé API) ───────────────────────────────────────────

const MOCK_DELAY_MS = 900;

function pickMockResponse(userMessage: string, systemPrompt: string): string {
  const msg = userMessage.toLowerCase();
  const hasData = systemPrompt.includes('Séances totales') && !systemPrompt.includes('Séances totales : 0');

  if (!hasData) {
    return "Je ne vois encore aucune séance dans ton historique. Lance ta première séance depuis l'onglet Séances, puis reviens me parler de tes objectifs ! 💪";
  }

  if (msg.match(/progression|progresse|évolue|améliore/)) {
    return `D'après ton historique, voici ce que je vois :\n\n📈 Certains exercices montrent une belle progression — continue à surcharger progressivement de 2,5 à 5 kg dès que tu finis toutes les séries proprement.\n\n⚠️ Si un exercice est en stagnation depuis plus de 3 séances, essaie de changer le nombre de répétitions (passer de 5×5 à 4×8 par exemple) ou d'augmenter le temps sous tension.\n\nTu veux qu'on analyse un exercice en particulier ?`;
  }

  if (msg.match(/récupér|repos|fatigue|sore|douleur|dormir/)) {
    return `La récupération est aussi importante que l'entraînement. Quelques points clés :\n\n😴 **Sommeil** : vise 7-9h. C'est là que les muscles se reconstruisent.\n\n🍗 **Protéines** : 1,6 à 2,2 g/kg de poids de corps par jour pour la croissance musculaire.\n\n⏱️ **Fréquence** : un muscle récupère en 48-72h. Si tu t'entraînes 3x/semaine, c'est souvent optimal.\n\nTu ressens une fatigue particulière en ce moment ?`;
  }

  if (msg.match(/ce soir|aujourd'hui|séance|travailler|faire|entraîner/)) {
    return `Bonne question ! Pour choisir la séance du jour, il faut regarder ce que tu as fait récemment.\n\n🔄 Si tu as travaillé le haut du corps hier → privilégie le bas du corps aujourd'hui (jambes, mollets).\n\n💡 Sinon, une séance "push" (pectoraux, épaules, triceps) ou "pull" (dos, biceps) selon ton split.\n\nRegarde tes dernières séances dans l'onglet Séances pour choisir le groupe musculaire le moins récent !`;
  }

  if (msg.match(/nutrition|manger|protéine|calorie|régime|poids/)) {
    return `La nutrition, c'est 50% du résultat. Les bases :\n\n🥩 **Protéines** : 1,6-2,2 g/kg/jour (poulet, œufs, poisson, légumineuses)\n🍚 **Glucides** : carburant pour l'entraînement, notamment avant la séance\n🥑 **Lipides** : indispensables pour les hormones, 0,8-1 g/kg minimum\n\n📊 Pour la prise de masse, vise +200-300 kcal/jour au-dessus de ta maintenance.\nPour la sèche, -300-500 kcal/jour.\n\nTu cherches à prendre de la masse ou à perdre du gras ?`;
  }

  if (msg.match(/programme|planning|plan|semaine|split/)) {
    return `D'après ta fréquence d'entraînement, voici un programme adapté :\n\n**3 jours/semaine → Full Body**\nLundi : Squat, Développé couché, Rowing barre\nMercredi : Soulevé de terre, Développé militaire, Tractions\nVendredi : Leg press, Dips, Curl biceps\n\n**4 jours/semaine → Upper/Lower**\nLundi/Jeudi : Haut du corps\nMardi/Vendredi : Bas du corps\n\nTu veux que je détaille l'un de ces programmes ?`;
  }

  if (msg.match(/record|pr|personnel|max/)) {
    return `Tes records sont visibles dans chaque fiche d'exercice (onglet Exercices → détail). Le badge 🏆 apparaît automatiquement quand tu bats un record pendant une séance.\n\nPour battre tes PRs de façon régulière :\n\n1. **Surcharge progressive** : +2,5 kg dès que tu finis toutes les reps\n2. **Technique d'abord** : un PR avec une mauvaise technique ne compte pas vraiment\n3. **Périodisation** : alterne des semaines lourdes et des semaines plus légères\n\nSur quel exercice vises-tu un nouveau record ?`;
  }

  if (msg.match(/bonjour|salut|hello|coucou|bonsoir/)) {
    return `Bonjour ! Je suis ton coach IA. Je peux analyser tes performances, t'aider à programmer tes séances, ou répondre à tes questions sur l'entraînement et la récupération.\n\nQu'est-ce que je peux faire pour toi aujourd'hui ? 💪`;
  }

  if (msg.match(/merci|super|parfait|top|génial/)) {
    return `Avec plaisir ! N'hésite pas à revenir après ta prochaine séance pour qu'on analyse ensemble tes progrès. Bonne séance ! 🏋️`;
  }

  // Réponse générique
  return `Bonne question ! Pour te donner un conseil précis, peux-tu me donner plus de détails ?\n\nVoici ce sur quoi je peux t'aider :\n- 📊 Analyser ta progression\n- 🏋️ Choisir ta prochaine séance\n- 💪 Optimiser tes records\n- 🍗 Nutrition et récupération\n- 📅 Créer un programme sur mesure`;
}

export class MockAIService implements AIService {
  async chat(messages: AIMessage[], systemPrompt: string): Promise<string> {
    await new Promise(r => setTimeout(r, MOCK_DELAY_MS));
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
    return pickMockResponse(lastUserMessage, systemPrompt);
  }
}

// ─── Google Gemini (clé API utilisateur, gratuite) ───────────────────────────
// Modèle gratuit de Google. Si tu changes ce nom, mets-le à jour aussi dans
// api/gemini.ts (la fonction serveur proxy utilisée en production).
export const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_MAX_TOK = 1024;

export class GeminiAIService implements AIService {
  constructor(private readonly apiKey: string) {}

  async chat(messages: AIMessage[], systemPrompt: string): Promise<string> {
    const response = await fetch(`/api/gemini/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        // Gemini utilise les rôles "user" et "model" (pas "assistant").
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: GEMINI_MAX_TOK },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const detail = (err as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`;
      throw new Error(detail);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts.map(p => p.text ?? '').join('').trim();
  }
}

// ─── Factory — sélectionne le service selon la clé disponible ─────────────────

// Nom de la clé Gemini isolée par profil actif (à recalculer à chaque usage).
export const geminiKeyName = () => scopedKey(STORAGE_KEYS.GEMINI_KEY);

export function createAIService(): AIService {
  const key = localStorage.getItem(geminiKeyName());
  return key ? new GeminiAIService(key) : new MockAIService();
}
