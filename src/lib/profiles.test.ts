import { beforeEach, describe, it, expect } from 'vitest';
import {
  scopedKey,
  getActiveProfileId,
  setActiveProfileId,
  loadProfiles,
  createProfile,
  renameProfile,
  deleteProfile,
  ensureProfilesInitialized,
} from './profiles';

// ─── Mock localStorage (env node de Vitest) ───────────────────────────────────

function mockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

beforeEach(() => {
  globalThis.localStorage = mockStorage();
});

// ─── scopedKey ────────────────────────────────────────────────────────────────

describe('scopedKey', () => {
  it('renvoie la base sans profil actif', () => {
    expect(scopedKey('muscu_workouts')).toBe('muscu_workouts');
  });

  it('suffixe avec l\'id du profil actif', () => {
    setActiveProfileId('abc');
    expect(scopedKey('muscu_workouts')).toBe('muscu_workouts__p_abc');
  });
});

// ─── CRUD ─────────────────────────────────────────────────────────────────────

describe('CRUD des profils', () => {
  it('crée et recharge des profils', () => {
    const a = createProfile('Lucas');
    const b = createProfile('Marie', '🔥');
    const list = loadProfiles();
    expect(list.map(p => p.name)).toEqual(['Lucas', 'Marie']);
    expect(b.emoji).toBe('🔥');
    expect(a.id).not.toBe(b.id);
  });

  it('renomme un profil', () => {
    const p = createProfile('X');
    renameProfile(p.id, 'Nouveau', '🎯');
    const reloaded = loadProfiles().find(x => x.id === p.id);
    expect(reloaded!.name).toBe('Nouveau');
    expect(reloaded!.emoji).toBe('🎯');
  });

  it('supprime un profil et efface ses données isolées', () => {
    const p = createProfile('X');
    localStorage.setItem(`muscu_workouts__p_${p.id}`, '[1]');
    deleteProfile(p.id);
    expect(loadProfiles().find(x => x.id === p.id)).toBeUndefined();
    expect(localStorage.getItem(`muscu_workouts__p_${p.id}`)).toBeNull();
  });
});

// ─── Migration ────────────────────────────────────────────────────────────────

describe('ensureProfilesInitialized', () => {
  it('crée un profil par défaut quand il n\'y en a aucun', () => {
    const list = ensureProfilesInitialized('Moi');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Moi');
    expect(getActiveProfileId()).toBe(list[0].id);
  });

  it('rapatrie les données héritées vers le profil par défaut', () => {
    localStorage.setItem('muscu_workouts', '[{"id":"w1"}]');
    localStorage.setItem('muscu_rest_duration', '120');

    const [profile] = ensureProfilesInitialized('Moi');

    // les données sont désormais isolées sous le profil…
    expect(localStorage.getItem(`muscu_workouts__p_${profile.id}`)).toBe('[{"id":"w1"}]');
    expect(localStorage.getItem(`muscu_rest_duration__p_${profile.id}`)).toBe('120');
    // …et les clés héritées ont été nettoyées
    expect(localStorage.getItem('muscu_workouts')).toBeNull();
  });

  it('est idempotent (ne recrée pas de profil au 2e appel)', () => {
    ensureProfilesInitialized('Moi');
    const list = ensureProfilesInitialized('Moi');
    expect(list).toHaveLength(1);
  });

  it('répare un profil actif invalide', () => {
    const p = createProfile('A');
    setActiveProfileId('id-inexistant');
    ensureProfilesInitialized();
    expect(getActiveProfileId()).toBe(p.id);
  });
});
