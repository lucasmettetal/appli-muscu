// Traduit en français les exercices Free Exercise DB (noms + instructions) via
// l'API Gemini, par lots, et fusionne le résultat dans
// src/data/exercise-translations.fr.json SANS écraser les traductions existantes.
//
// Usage :
//   GEMINI_API_KEY=xxxx node scripts/translate-exercises.mjs [--limit N] [--force-instructions]
//
// - Idempotent / reprenable : sauvegarde après chaque lot ; relancer complète
//   simplement ce qui manque (ne retraduit pas ce qui est déjà fait).
// - Rate-limité (compatible palier gratuit) + retries + parsing JSON robuste.

import { readFile, writeFile } from 'node:fs/promises';

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!API_KEY) {
  console.error('❌  Manque la clé : GEMINI_API_KEY=... node scripts/translate-exercises.mjs');
  process.exit(1);
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const DB_PATH = 'public/data/free-exercise-db/exercises.json';
const OUT_PATH = 'src/data/exercise-translations.fr.json';

const BATCH_SIZE = 12;          // exercices par appel Gemini
const DELAY_MS = 4500;          // pause entre appels (~13 req/min)
const MAX_RETRIES = 3;

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(args[limitArg + 1]) : Infinity;
const FORCE_INSTRUCTIONS = args.includes('--force-instructions');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const db = JSON.parse(await readFile(DB_PATH, 'utf8'));
let translations = {};
try {
  translations = JSON.parse(await readFile(OUT_PATH, 'utf8'));
} catch {
  translations = {};
}

// Exercices restant à traduire (nom manquant, ou instructions manquantes).
const todo = db.filter(ex => {
  const t = translations[ex.id];
  const needName = !t?.nameFr;
  const needInstr = (ex.instructions?.length ?? 0) > 0 && !(t?.instructionsFr?.length) && (FORCE_INSTRUCTIONS || true);
  return needName || needInstr;
}).slice(0, LIMIT === Infinity ? undefined : LIMIT);

console.log(`Banque : ${db.length} exercices — à traiter : ${todo.length}`);
if (todo.length === 0) { console.log('Rien à faire ✅'); process.exit(0); }

const SYSTEM = `Tu es un traducteur expert en musculation et fitness. On te donne un tableau JSON d'exercices en anglais.
Traduis en français NATUREL et correct : le nom de l'exercice et chaque étape d'instruction.
Règles :
- Garde la terminologie standard de musculation (ex: "Barbell Bench Press" -> "Développé couché à la barre", "Dumbbell" -> "haltères", "Cable" -> "à la poulie").
- Ne traduis PAS les noms propres de matériel de marque.
- Réponds UNIQUEMENT avec un tableau JSON valide, même ordre, même "id", au format :
  [{"id":"...","nameFr":"...","instructionsFr":["...", "..."]}]
- Pas de texte avant/après, pas de balises Markdown.`;

async function translateBatch(batch) {
  const payload = batch.map(ex => ({ id: ex.id, name: ex.name, instructions: ex.instructions ?? [] }));
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
    generationConfig: { maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
  });

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Réponse sans tableau JSON');
  return JSON.parse(text.slice(start, end + 1));
}

let done = 0;
for (let i = 0; i < todo.length; i += BATCH_SIZE) {
  const batch = todo.slice(i, i + BATCH_SIZE);
  let items = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      items = await translateBatch(batch);
      break;
    } catch (e) {
      console.warn(`  lot ${i / BATCH_SIZE + 1} tentative ${attempt} échouée : ${e.message}`);
      if (attempt < MAX_RETRIES) await sleep(DELAY_MS * attempt);
    }
  }
  if (!items) { console.warn('  → lot ignoré après échecs.'); await sleep(DELAY_MS); continue; }

  const byId = new Map(items.map(it => [it.id, it]));
  for (const ex of batch) {
    const it = byId.get(ex.id);
    if (!it?.nameFr) continue;
    const prev = translations[ex.id] ?? {};
    translations[ex.id] = {
      ...prev,
      nameFr: prev.nameFr ?? it.nameFr,
      ...(it.instructionsFr?.length ? { instructionsFr: prev.instructionsFr ?? it.instructionsFr } : (prev.instructionsFr ? { instructionsFr: prev.instructionsFr } : {})),
      ...(prev.aliases ? { aliases: prev.aliases } : {}),
      ...(prev.legacyIds ? { legacyIds: prev.legacyIds } : {}),
    };
    done++;
  }

  // Sauvegarde incrémentale (reprise possible si interruption).
  await writeFile(OUT_PATH, `${JSON.stringify(translations, null, 2)}\n`, 'utf8');
  console.log(`  ${Math.min(i + BATCH_SIZE, todo.length)}/${todo.length} traités (${done} écrits)`);
  await sleep(DELAY_MS);
}

console.log(`\n✅ Terminé. ${Object.keys(translations).length} exercices traduits au total dans ${OUT_PATH}`);
