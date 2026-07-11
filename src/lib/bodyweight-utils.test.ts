import { describe, it, expect } from 'vitest';
import { sortByDate, getBodyWeightStats } from './bodyweight-utils';
import type { BodyWeight } from '../context/WorkoutContext';

let n = 0;
function bw(date: string, weight: number): BodyWeight {
  return { id: `b-${n++}`, date, weight };
}

describe('sortByDate', () => {
  it('trie du plus ancien au plus récent', () => {
    const entries = [bw('2026-03-01', 80), bw('2026-01-01', 82), bw('2026-02-01', 81)];
    expect(sortByDate(entries).map(e => e.weight)).toEqual([82, 81, 80]);
  });

  it('ne modifie pas le tableau source', () => {
    const entries = [bw('2026-02-01', 81), bw('2026-01-01', 82)];
    const copy = [...entries];
    sortByDate(entries);
    expect(entries).toEqual(copy);
  });
});

describe('getBodyWeightStats', () => {
  it('gère une liste vide', () => {
    const s = getBodyWeightStats([]);
    expect(s).toEqual({ latest: null, previous: null, deltaFromPrevious: null, totalDelta: null, min: null, max: null, count: 0 });
  });

  it('gère une seule saisie', () => {
    const s = getBodyWeightStats([bw('2026-01-01', 80)]);
    expect(s.latest).toBe(80);
    expect(s.previous).toBeNull();
    expect(s.deltaFromPrevious).toBeNull();
    expect(s.totalDelta).toBeNull();
    expect(s.count).toBe(1);
  });

  it('calcule les deltas dans l\'ordre chronologique', () => {
    // saisies fournies dans le désordre
    const s = getBodyWeightStats([bw('2026-03-01', 78.4), bw('2026-01-01', 82), bw('2026-02-01', 80)]);
    expect(s.latest).toBe(78.4);
    expect(s.previous).toBe(80);
    expect(s.deltaFromPrevious).toBe(-1.6);
    expect(s.totalDelta).toBe(-3.6); // 78.4 - 82
    expect(s.min).toBe(78.4);
    expect(s.max).toBe(82);
    expect(s.count).toBe(3);
  });

  it('arrondit les deltas à 0,1', () => {
    const s = getBodyWeightStats([bw('2026-01-01', 80.0), bw('2026-01-02', 80.14)]);
    expect(s.deltaFromPrevious).toBe(0.1); // 0.14 -> 0.1 (arrondi)
  });
});
