import { readFile, writeFile } from 'node:fs/promises';

const raw = JSON.parse(await readFile('public/data/free-exercise-db/exercises.json', 'utf8'));
const curated = JSON.parse(await readFile('src/data/exercises.json', 'utf8')).exercises;
const editorial = JSON.parse(await readFile('src/data/exercise-instructions.json', 'utf8'));

const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const byName = new Map(raw.map((exercise) => [normalize(exercise.name), exercise.id]));

function sourceId(exercise) {
  if (exercise.imageStart?.startsWith('free-exercise-db:')) {
    return exercise.imageStart.slice('free-exercise-db:'.length).split('/')[0];
  }
  const match = exercise.imageStart?.match(/\/exercises\/([^/]+)\/\d+\.jpg(?:\?.*)?$/);
  if (match) return decodeURIComponent(match[1]);
  return byName.get(normalize(exercise.nameEn || exercise.name));
}

const translations = {};
for (const exercise of curated) {
  const id = sourceId(exercise);
  if (!id) continue;

  const instructionsFr = exercise.instructions?.length
    ? exercise.instructions
    : editorial[exercise.id]?.instructions;

  translations[id] = {
    nameFr: exercise.name,
    ...(instructionsFr?.length ? { instructionsFr } : {}),
    ...(exercise.aliases?.length ? { aliases: exercise.aliases } : {}),
    legacyIds: [exercise.id],
  };
}

Object.assign(translations, {
  Dumbbell_Bench_Press: {
    nameFr: 'Développé couché avec haltères',
    aliases: [
      'développé haltères',
      'développé couché haltères',
      'dumbbell bench',
      'db bench',
    ],
  },
});

await writeFile(
  'src/data/exercise-translations.fr.json',
  `${JSON.stringify(translations, null, 2)}\n`,
  'utf8',
);

console.log(`${Object.keys(translations).length} traductions initiales générées.`);
