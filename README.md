# Fitness Tracker — Application de suivi musculation

Application web mobile-first pour suivre ses séances de musculation, visualiser sa progression et obtenir des conseils via un coach IA.

## Stack technique

- **React 18** + **TypeScript** + **Vite 6**
- **Tailwind CSS v4** + **shadcn/ui** (Radix UI)
- **Recharts** pour les graphiques (chargé à la demande)
- **React Router v7** (routes en lazy-loading)
- **Vitest** pour les tests unitaires
- **pnpm** comme gestionnaire de paquets
- Stockage : `localStorage` (pas de backend)

## Démarrage

```bash
pnpm install
pnpm dev        # serveur de dev
pnpm build      # build de production (typecheck + vite build)
pnpm preview    # aperçu du build
pnpm test       # tests unitaires (Vitest)
pnpm typecheck  # vérification TypeScript seule
```

L'app est accessible sur `http://localhost:5173`.

> Le Coach IA appelle l'API Gemini **directement depuis le navigateur** (l'API
> Gemini autorise le CORS), donc il fonctionne aussi bien en `dev`, `preview`
> qu'en production — aucun proxy ni fonction serveur nécessaire.

## Fonctionnalités

- **Séances** — Création, suivi des séries avec poids/reps, RPE, RIR et notes
- **Timer de repos** — Flottant, avec presets et ajustements ±15s, bip audio à la fin
- **Records personnels** — Détection automatique des PRs (charge, 1RM Epley, volume) avec célébration
- **Bibliothèque d'exercices** — 30 exercices intégrés (avec images début/fin) + création personnalisée + import depuis une banque de ~870 exercices avec images (Free Exercise DB), instructions traduisibles en français à la demande via le Coach IA
- **Progression** — Graphiques par exercice, statut de progression (positive / stable / stagnation)
- **Coach IA** — Chat avec Google Gemini (clé API gratuite requise, sans carte bancaire) ou mode démo sans clé
- **Profils locaux** — Plusieurs personnes peuvent partager le même appareil : chaque profil garde ses propres séances, exercices et clé IA (isolés dans le navigateur, sans synchronisation entre appareils)
- **Export / Import** — Sauvegarde JSON de toutes les données, avec backup automatique avant import

## Configuration du Coach IA

1. Obtiens une clé API **gratuite** sur [aistudio.google.com](https://aistudio.google.com/apikey) (aucune carte bancaire)
2. Dans l'app, va sur **Coach IA** → badge **Mode démo** → entre ta clé `AIza…`
3. La clé est stockée uniquement dans ton navigateur (localStorage)

Chaque utilisateur fournit sa propre clé (gratuite) : le propriétaire de l'app ne paie rien.
Les appels vont directement du navigateur vers l'API Gemini (aucun proxy).

## Déploiement (Vercel)

Le fichier `vercel.json` est déjà configuré (app statique). Connecte le repo sur [vercel.com](https://vercel.com) — aucune variable d'environnement à définir côté serveur (la clé Gemini est fournie par l'utilisateur dans son navigateur).

```bash
pnpm build   # vérification locale
```

## Tests

Le cœur métier (`lib/`) est couvert par des tests unitaires Vitest :

- `pr-utils.test.ts` — formule Epley, détection des records, historique, statut de progression
- `ai-context.test.ts` — formatage du contexte injecté dans le prompt du Coach IA

```bash
pnpm test          # exécution unique
pnpm test:watch    # mode watch
```

## Structure

```
src/
├── context/WorkoutContext.tsx   # état global + localStorage + export/import
├── lib/
│   ├── pr-utils.ts              # Epley 1RM, records, historique, progression
│   ├── pr-utils.test.ts         # tests unitaires
│   ├── ai-context.ts            # formatage du prompt système du Coach IA
│   ├── ai-context.test.ts       # tests unitaires
│   ├── ai-service.ts            # MockAIService + GeminiAIService
│   ├── wger-api.ts              # intégration API wger.de
│   └── exercise-utils.ts        # labels et styles partagés
├── pages/                       # une page par route (chargées en lazy)
├── routes.tsx                   # routeur + code-splitting par route
└── components/
    ├── Layout.tsx               # nav bottom + header
    └── ui/                      # composants shadcn/ui
```
