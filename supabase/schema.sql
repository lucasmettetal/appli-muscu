-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Schéma Supabase pour Fitness Tracker (appli-muscu)                        ║
-- ║  À exécuter une seule fois dans : Supabase → SQL Editor → New query        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Une ligne par utilisateur ; tout l'état de l'app est stocké dans `data`
-- (même format que l'export/import JSON existant).
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Chaque utilisateur ne peut lire/écrire QUE sa propre ligne.
alter table public.user_data enable row level security;

drop policy if exists "own_data_select" on public.user_data;
create policy "own_data_select"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "own_data_insert" on public.user_data;
create policy "own_data_insert"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "own_data_update" on public.user_data;
create policy "own_data_update"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Met à jour updated_at automatiquement ───────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_data_touch on public.user_data;
create trigger trg_user_data_touch
  before update on public.user_data
  for each row execute function public.touch_updated_at();
