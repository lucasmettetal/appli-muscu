# Activer la synchro cloud (Supabase)

Sans Supabase, l'app fonctionne à 100 % en local (profils navigateur). En activant
la synchro, tes séances/programmes/records sont sauvegardés dans ton compte et
partagés entre appareils (iPhone installé + ordinateur). ~5 minutes.

## 1. Créer le projet
1. Va sur https://supabase.com → **New project** (le plan gratuit suffit).
2. Note le mot de passe de la base (pas nécessaire côté app).

## 2. Récupérer les clés
Dans **Project Settings → API** :
- **Project URL** → `VITE_SUPABASE_URL`
- clé **anon public** → `VITE_SUPABASE_ANON_KEY`

Ces deux valeurs sont **publiques** (prévues pour le navigateur) ; la sécurité est
assurée par les politiques RLS ci-dessous.

Renseigne-les :
- **En local** : copie `.env.example` en `.env.local` et remplis les deux variables.
- **Sur Vercel** : Project → Settings → Environment Variables (Production + Preview),
  puis redéploie.

## 3. Créer la table + la sécurité (RLS)
Dans **SQL Editor**, colle et exécute :

```sql
-- Une ligne par utilisateur : tout l'état de l'app dans un JSON.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Chaque utilisateur ne voit et ne modifie QUE sa propre ligne.
alter table public.user_data enable row level security;

create policy "user_data lecture"     on public.user_data
  for select using (auth.uid() = user_id);
create policy "user_data insertion"   on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "user_data mise à jour" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_data suppression" on public.user_data
  for delete using (auth.uid() = user_id);

-- Met à jour updated_at automatiquement.
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger user_data_touch before update on public.user_data
  for each row execute function public.touch_updated_at();
```

## 4. Configurer la connexion par lien magique
Dans **Authentication → Providers → Email** : garde **Email** activé (le lien
magique fonctionne par défaut, aucun mot de passe requis).

Dans **Authentication → URL Configuration** :
- **Site URL** : l'URL de production (ex. `https://ton-app.vercel.app`)
- **Redirect URLs** : ajoute aussi `http://localhost:5173` pour le développement.

## 5. Vérifier
1. Redémarre le serveur de dev (`corepack pnpm dev`) pour charger `.env.local`.
2. Va sur la page **Connexion** : si les variables sont détectées, le formulaire
   de lien magique s'affiche.
3. Connecte-toi → tes données locales du profil actif sont migrées vers le compte
   au premier chargement, puis synchronisées automatiquement (débounce ~0,8 s).

> Remarque : l'app lit/écrit une seule ligne `user_data` par utilisateur. Aucun
> schéma à maintenir côté app — la structure vit dans le JSON `data`.
