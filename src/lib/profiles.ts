// ─── Profils locaux ───────────────────────────────────────────────────────────
// Plusieurs personnes peuvent partager le même appareil sans mélanger leurs
// données. Chaque profil a son propre espace dans le localStorage : les clés de
// données sont suffixées par l'id du profil actif (`base__p_<id>`).
// Il n'y a ni compte ni synchronisation entre appareils (voir la piste Supabase
// si besoin plus tard).

export interface Profile {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
}

const PROFILES_KEY = 'muscu_profiles';
const ACTIVE_KEY = 'muscu_active_profile';

// Bases de clés à isoler par profil (les données historiques utilisaient
// directement ces noms — cf. migration ci-dessous).
export const SCOPED_BASES = [
  'muscu_workouts',
  'muscu_custom_exercises',
  'muscu_rest_duration',
  'muscu_claude_key',
  'muscu_workout_draft',
];

export const AVATARS = ['💪', '🔥', '🏋️', '⚡', '🦍', '🐺', '🚀', '🎯', '🥇', '🧠', '🦁', '🐉'];

// ─── Résolution de clé selon le profil actif ─────────────────────────────────

export function getActiveProfileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveProfileId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignore
  }
}

// Renvoie la clé isolée pour le profil actif. Sans profil actif, renvoie la
// base telle quelle (utile pour les tests et la période pré-migration).
export function scopedKey(base: string): string {
  const id = getActiveProfileId();
  return id ? `${base}__p_${id}` : base;
}

// ─── CRUD des profils ─────────────────────────────────────────────────────────

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (p): p is Profile =>
        !!p && typeof p === 'object' &&
        typeof (p as Profile).id === 'string' &&
        typeof (p as Profile).name === 'string',
    );
  } catch {
    return [];
  }
}

function saveProfiles(list: Profile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function createProfile(name: string, emoji?: string): Profile {
  const list = loadProfiles();
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Profil',
    emoji: emoji || AVATARS[list.length % AVATARS.length],
    createdAt: new Date().toISOString(),
  };
  saveProfiles([...list, profile]);
  return profile;
}

export function renameProfile(id: string, name: string, emoji?: string): void {
  saveProfiles(
    loadProfiles().map(p =>
      p.id === id ? { ...p, name: name.trim() || p.name, emoji: emoji ?? p.emoji } : p,
    ),
  );
}

// Supprime un profil ET toutes ses données isolées.
export function deleteProfile(id: string): void {
  for (const base of SCOPED_BASES) {
    try {
      localStorage.removeItem(`${base}__p_${id}`);
    } catch {
      // ignore
    }
  }
  saveProfiles(loadProfiles().filter(p => p.id !== id));
}

// ─── Initialisation / migration ───────────────────────────────────────────────
// Au premier lancement de la version multi-profils :
//  - s'il n'existe aucun profil, on en crée un par défaut ;
//  - on rapatrie les données « héritées » (clés non isolées) vers ce profil.
// Idempotent : ne fait rien si des profils existent déjà.
export function ensureProfilesInitialized(defaultName = 'Moi'): Profile[] {
  const existing = loadProfiles();

  if (existing.length > 0) {
    const activeId = getActiveProfileId();
    if (!activeId || !existing.some(p => p.id === activeId)) {
      setActiveProfileId(existing[0].id);
    }
    return existing;
  }

  const profile = createProfile(defaultName);
  setActiveProfileId(profile.id);

  // Rapatrie les données existantes non isolées vers le profil par défaut.
  for (const base of SCOPED_BASES) {
    try {
      const legacy = localStorage.getItem(base);
      const target = `${base}__p_${profile.id}`;
      if (legacy !== null && localStorage.getItem(target) === null) {
        localStorage.setItem(target, legacy);
        localStorage.removeItem(base);
      }
    } catch {
      // ignore
    }
  }

  return loadProfiles();
}
