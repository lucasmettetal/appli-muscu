# Configuration de la synchro cloud (Supabase)

Suivre ces étapes une seule fois. À la fin, colle-moi les 2 valeurs demandées à
l'étape 4 et confirme que le SQL de l'étape 3 est passé.

## 1. Créer le projet

1. Va sur [supabase.com](https://supabase.com) → **Sign in** (avec GitHub, c'est le plus simple)
2. **New project**
   - Name : `appli-muscu` (ou ce que tu veux)
   - Database Password : mets-en un fort et **note-le** (tu n'en auras pas besoin pour l'app, mais garde-le)
   - Region : **West EU (Paris)** ou la plus proche
3. Attends ~2 min que le projet se provisionne.

## 2. Activer la connexion par lien magique

1. Menu de gauche → **Authentication** → **Providers** → **Email**
2. Vérifie que **Email** est activé, avec **"Confirm email"** activé (le lien magique en dépend)
3. (Optionnel mais conseillé) **Authentication → URL Configuration** :
   - **Site URL** : l'URL de ton app Vercel (ex. `https://appli-muscu.vercel.app`)
   - **Redirect URLs** : ajoute aussi `http://localhost:5173` pour tester en local

## 3. Créer la table

1. Menu de gauche → **SQL Editor** → **New query**
2. Copie-colle tout le contenu de [`schema.sql`](./schema.sql)
3. Clique **Run**. Tu dois voir « Success. No rows returned ».

## 4. Récupérer les clés (à me donner)

Menu de gauche → **Project Settings** (roue crantée) → **API** :

- **Project URL** → c'est `VITE_SUPABASE_URL`
- **Project API keys → `anon` `public`** → c'est `VITE_SUPABASE_ANON_KEY`

> Ces deux valeurs sont **publiques** (prévues pour le navigateur) — pas de risque
> à me les transmettre. Ne me donne **jamais** la clé `service_role`.

## 5. Où elles vont

- **En local** : crée un fichier `.env.local` à la racine (voir `.env.example`) avec ces 2 valeurs. `pnpm dev` les prendra en compte.
- **Sur Vercel** : Project → **Settings → Environment Variables** → ajoute
  `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Production + Preview), puis
  redéploie.

---

Une fois l'étape 3 faite et les 2 valeurs de l'étape 4 en main, préviens-moi :
je câble alors l'écran de connexion, la synchro et la migration de tes données
locales vers ton compte.
