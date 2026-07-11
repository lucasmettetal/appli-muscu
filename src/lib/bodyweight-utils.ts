import type { BodyWeight } from '../context/WorkoutContext';

// Tri chronologique croissant (le plus ancien d'abord).
export function sortByDate(entries: BodyWeight[]): BodyWeight[] {
  return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export interface BodyWeightStats {
  latest: number | null;        // dernier poids saisi
  previous: number | null;      // avant-dernier
  deltaFromPrevious: number | null; // variation vs saisie précédente
  totalDelta: number | null;    // variation depuis la 1re saisie
  min: number | null;
  max: number | null;
  count: number;
}

export function getBodyWeightStats(entries: BodyWeight[]): BodyWeightStats {
  const sorted = sortByDate(entries);
  if (sorted.length === 0) {
    return { latest: null, previous: null, deltaFromPrevious: null, totalDelta: null, min: null, max: null, count: 0 };
  }

  const weights = sorted.map(e => e.weight);
  const latest = weights[weights.length - 1];
  const previous = weights.length > 1 ? weights[weights.length - 2] : null;
  const first = weights[0];

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    latest,
    previous,
    deltaFromPrevious: previous !== null ? round1(latest - previous) : null,
    totalDelta: weights.length > 1 ? round1(latest - first) : null,
    min: Math.min(...weights),
    max: Math.max(...weights),
    count: sorted.length,
  };
}
