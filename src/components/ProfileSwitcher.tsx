import { useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { Check, Plus, Pencil, Trash2, X } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';

// Sélecteur de profil local : bouton compact dans le header + feuille de gestion
// (basculer, ajouter, renommer, supprimer). Avatars = initiales colorées.
export function ProfileSwitcher() {
  const { profiles, activeProfileId, activeProfile, switchProfile, addProfile, updateProfile, removeProfile } =
    useProfile();

  const [open, setOpen] = useState(false);

  // Ajout
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // Édition
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const resetAdd = () => { setAdding(false); setNewName(''); };

  const handleAdd = () => {
    const p = addProfile(newName);
    resetAdd();
    switchProfile(p.id); // bascule direct sur le nouveau profil
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id); setEditName(name);
  };

  const handleSaveEdit = () => {
    if (editingId) updateProfile(editingId, editName);
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Supprimer le profil « ${name} » et toutes ses données ? Action définitive.`)) {
      removeProfile(id);
    }
  };

  return (
    <>
      {/* Bouton header */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors max-w-[45vw]"
        aria-label="Changer de profil"
      >
        <ProfileAvatar name={activeProfile?.name ?? 'Profil'} seed={activeProfileId} size="sm" />
        <span className="text-sm font-medium text-gray-700 truncate">{activeProfile?.name ?? 'Profil'}</span>
      </button>

      {/* Feuille de gestion */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => { setOpen(false); resetAdd(); setEditingId(null); }}>
          <div
            className="bg-white w-full rounded-t-2xl p-5 space-y-4 max-w-lg mx-auto max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Profils</h2>
              <button onClick={() => { setOpen(false); resetAdd(); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Chaque profil garde ses propres séances sur cet appareil. (Pas de synchronisation entre appareils.)
            </p>

            {/* Liste des profils */}
            <div className="space-y-2">
              {profiles.map(p => (
                <div key={p.id} className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {editingId === p.id ? (
                    <div className="p-3">
                      <div className="flex gap-2">
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Nom du profil"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="px-3 rounded-lg bg-blue-600 text-white text-sm font-medium">OK</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2">
                      <button
                        onClick={() => { switchProfile(p.id); setOpen(false); }}
                        className="flex-1 flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      >
                        <ProfileAvatar name={p.name} seed={p.id} />
                        <span className="text-sm font-medium text-gray-900 flex-1 truncate">{p.name}</span>
                        {p.id === activeProfileId && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                      <button onClick={() => startEdit(p.id, p.name)} className="p-1.5 text-gray-400 hover:text-gray-700" aria-label="Renommer">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {profiles.length > 1 && (
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-gray-400 hover:text-red-500" aria-label="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ajout d'un profil */}
            {adding ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nom du nouveau profil"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
                    autoFocus
                  />
                  <button
                    onClick={handleAdd}
                    disabled={!newName.trim()}
                    className="px-4 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-40"
                  >
                    Créer
                  </button>
                </div>
                <button onClick={resetAdd} className="text-xs text-gray-400 hover:text-gray-600 mt-2">Annuler</button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nouveau profil
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
