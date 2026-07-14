import { useState, useRef } from 'react';
import { useWorkout, type AppData } from '../context/WorkoutContext';
import { Download, Upload, CheckCircle2, AlertTriangle, Database, Dumbbell, X, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateDemoWorkouts, generateDemoBodyWeights } from '../lib/demo-data';

// ─── Téléchargement d'un blob JSON ───────────────────────────────────────────

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todaySlug() {
  return new Date().toISOString().split('T')[0];
}

// ─── Confirmation avant import ────────────────────────────────────────────────

function ImportConfirmModal({
  incoming,
  current,
  onConfirm,
  onCancel,
}: {
  incoming: { workouts: number; customExercises: number };
  current:  { workouts: number; customExercises: number };
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-white w-full rounded-t-2xl p-6 space-y-5 max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Remplacer les données ?</h2>
            <p className="text-sm text-gray-500 mt-1">
              Cette action remplacera toutes tes données actuelles.
            </p>
          </div>
        </div>

        {/* Tableau avant / après */}
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-sm">
          <div className="grid grid-cols-3 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">
            <span />
            <span className="text-center">Actuellement</span>
            <span className="text-center">Après import</span>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-gray-600">Séances</span>
              <span className="text-center font-semibold text-gray-900">{current.workouts}</span>
              <span className="text-center font-semibold text-blue-600">{incoming.workouts}</span>
            </div>
            <div className="grid grid-cols-3 px-4 py-2.5">
              <span className="text-gray-600">Exercices perso</span>
              <span className="text-center font-semibold text-gray-900">{current.customExercises}</span>
              <span className="text-center font-semibold text-blue-600">{incoming.customExercises}</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
          <Download className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Une <strong>sauvegarde automatique</strong> de tes données actuelles sera téléchargée
            avant l'import.
          </span>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Annuler
          </Button>
          <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={onConfirm}>
            Sauvegarder & Importer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type ImportState =
  | { status: 'idle' }
  | { status: 'ready'; data: AppData; stats: { workouts: number; customExercises: number } }
  | { status: 'error'; message: string }
  | { status: 'success'; stats: { workouts: number; customExercises: number } };

export function Settings() {
  const { workouts, exercises, exportData, importData } = useWorkout();
  const customCount = exercises.filter(e => e.custom).length;

  // ─── Données démo (dev) ──────────────────────────────────────────────────────
  const handleLoadDemo = () => {
    const current = exportData();
    importData({
      ...current,
      workouts: [...generateDemoWorkouts(exercises), ...current.workouts],
      bodyWeights: [...generateDemoBodyWeights(), ...(current.bodyWeights ?? [])],
    });
    setImportState({ status: 'idle' });
  };

  const handleClearAll = () => {
    const current = exportData();
    importData({ ...current, workouts: [], bodyWeights: [] });
    setImportState({ status: 'idle' });
  };

  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });
  const [showConfirm, setShowConfirm]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const data = exportData();
    downloadJSON(data, `muscu-backup-${todaySlug()}.json`);
  };

  // ─── Import — lecture du fichier ────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset pour permettre de re-sélectionner le même fichier
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') {
        setImportState({ status: 'error', message: 'Impossible de lire le fichier.' });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportState({ status: 'error', message: 'Le fichier n\'est pas un JSON valide.' });
        return;
      }

      // Validation via le contexte (réutilise la même logique)
      const d = parsed as Record<string, unknown>;
      if (!Array.isArray(d?.workouts)) {
        setImportState({ status: 'error', message: 'Champ "workouts" manquant — ce fichier n\'est pas une sauvegarde muscu.' });
        return;
      }
      if (!Array.isArray(d?.customExercises)) {
        setImportState({ status: 'error', message: 'Champ "customExercises" manquant — ce fichier n\'est pas une sauvegarde muscu.' });
        return;
      }

      setImportState({
        status: 'ready',
        data: parsed as AppData,
        stats: {
          workouts: (d.workouts as unknown[]).length,
          customExercises: (d.customExercises as unknown[]).length,
        },
      });
      setShowConfirm(true);
    };
    reader.onerror = () => {
      setImportState({ status: 'error', message: 'Erreur de lecture du fichier.' });
    };
    reader.readAsText(file);
  };

  // ─── Import — confirmation ───────────────────────────────────────────────────

  const handleConfirmImport = () => {
    if (importState.status !== 'ready') return;

    // 1. Sauvegarde automatique des données actuelles
    const backup = exportData();
    downloadJSON(backup, `muscu-backup-avant-import-${todaySlug()}.json`);

    // 2. Import
    const result = importData(importState.data);
    setShowConfirm(false);

    if (result.success) {
      setImportState({ status: 'success', stats: result.stats! });
    } else {
      setImportState({ status: 'error', message: result.error ?? 'Erreur inconnue.' });
    }
  };

  const handleCancelImport = () => {
    setShowConfirm(false);
    setImportState({ status: 'idle' });
  };

  const resetImportState = () => setImportState({ status: 'idle' });

  return (
    <>
      {showConfirm && importState.status === 'ready' && (
        <ImportConfirmModal
          incoming={importState.stats}
          current={{ workouts: workouts.length, customExercises: customCount }}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
        />
      )}

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Réglages</h2>

        {/* Résumé des données actuelles */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Données actuelles
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-lg font-bold text-gray-900">{workouts.length}</p>
                <p className="text-xs text-gray-400">Séance{workouts.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
              <Dumbbell className="w-5 h-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-lg font-bold text-gray-900">{customCount}</p>
                <p className="text-xs text-gray-400">Exercice{customCount !== 1 ? 's' : ''} perso</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Stockage : navigateur (localStorage) · Pense à exporter régulièrement.
          </p>
        </div>

        {/* Export */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Exporter mes données
          </h3>
          <p className="text-sm text-gray-500">
            Télécharge un fichier JSON avec toutes tes séances, tes exercices personnalisés
            et tes réglages. Conserve ce fichier en lieu sûr.
          </p>
          <Button onClick={handleExport} className="w-full" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Télécharger la sauvegarde
          </Button>
        </div>

        {/* Import */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Importer des données
          </h3>
          <p className="text-sm text-gray-500">
            Restaure une sauvegarde précédemment exportée. Tes données actuelles seront
            remplacées — une sauvegarde automatique sera créée avant l'import.
          </p>

          {/* Feedback import */}
          {importState.status === 'error' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-700 font-medium">Import impossible</p>
                <p className="text-xs text-red-600 mt-0.5">{importState.message}</p>
              </div>
              <button onClick={resetImportState} className="text-red-400 hover:text-red-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {importState.status === 'success' && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-3">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-green-700 font-medium">Import réussi</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {importState.stats.workouts} séance{importState.stats.workouts !== 1 ? 's' : ''} et{' '}
                  {importState.stats.customExercises} exercice{importState.stats.customExercises !== 1 ? 's' : ''} perso importé{importState.stats.workouts !== 1 ? 's' : ''}.
                </p>
              </div>
              <button onClick={resetImportState} className="text-green-400 hover:text-green-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
            variant="outline"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choisir un fichier de sauvegarde
          </Button>
        </div>

        {/* Données démo (dev uniquement) */}
        {import.meta.env.DEV && (
          <div className="bg-white rounded-xl border border-dashed border-violet-300 p-4 space-y-3">
            <h3 className="text-sm font-bold text-violet-700 uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Données démo (dev)
            </h3>
            <p className="text-sm text-gray-500">
              Génère ~4 semaines de séances réalistes (avec progression) et quelques pesées, pour
              visualiser tous les widgets du tableau de bord remplis.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleLoadDemo} className="flex-1 bg-violet-600 hover:bg-violet-700">
                <Sparkles className="w-4 h-4 mr-2" />
                Charger la démo
              </Button>
              <Button onClick={handleClearAll} variant="outline" className="flex-1 text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4 mr-2" />
                Tout effacer
              </Button>
            </div>
          </div>
        )}

        {/* Info stockage */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
          <p className="text-sm font-semibold text-amber-800">À propos du stockage</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Tes données sont stockées uniquement dans ce navigateur. Elles peuvent être perdues
            si tu vides le cache ou changes de navigateur. Exporte régulièrement pour éviter
            toute perte.
          </p>
        </div>
      </div>
    </>
  );
}
