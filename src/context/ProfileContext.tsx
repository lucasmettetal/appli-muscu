import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  type Profile,
  loadProfiles,
  ensureProfilesInitialized,
  getActiveProfileId,
  setActiveProfileId,
  createProfile as createProfileStore,
  renameProfile as renameProfileStore,
  deleteProfile as deleteProfileStore,
} from '../lib/profiles';

interface ProfileContextType {
  profiles: Profile[];
  activeProfileId: string;
  activeProfile: Profile | undefined;
  switchProfile: (id: string) => void;
  addProfile: (name: string, emoji?: string) => Profile;
  updateProfile: (id: string, name: string, emoji?: string) => void;
  removeProfile: (id: string) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  // Crée le profil par défaut + migre les données héritées au premier lancement.
  const [profiles, setProfiles] = useState<Profile[]>(() => ensureProfilesInitialized());
  const [activeProfileId, setActiveId] = useState<string>(
    () => getActiveProfileId() ?? profiles[0]?.id ?? '',
  );

  const switchProfile = useCallback((id: string) => {
    setActiveProfileId(id);
    setActiveId(id);
  }, []);

  const addProfile = useCallback((name: string, emoji?: string) => {
    const profile = createProfileStore(name, emoji);
    setProfiles(loadProfiles());
    return profile;
  }, []);

  const updateProfile = useCallback((id: string, name: string, emoji?: string) => {
    renameProfileStore(id, name, emoji);
    setProfiles(loadProfiles());
  }, []);

  const removeProfile = useCallback((id: string) => {
    deleteProfileStore(id);
    let remaining = loadProfiles();
    // On garde toujours au moins un profil.
    if (remaining.length === 0) {
      createProfileStore('Moi');
      remaining = loadProfiles();
    }
    setProfiles(remaining);
    // Si on supprime le profil actif, basculer vers un autre.
    setActiveId(prev => {
      if (prev !== id) return prev;
      const next = remaining[0].id;
      setActiveProfileId(next);
      return next;
    });
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <ProfileContext.Provider
      value={{ profiles, activeProfileId, activeProfile, switchProfile, addProfile, updateProfile, removeProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (ctx === undefined) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
