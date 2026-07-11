import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Client Supabase (optionnel) ──────────────────────────────────────────────
// La synchro cloud n'est active que si les deux variables d'environnement sont
// définies (en local dans .env.local, et sur Vercel dans les Environment
// Variables). Sinon l'app fonctionne en mode 100 % local (profils navigateur).
//
// Ces valeurs sont PUBLIQUES par conception (la clé « anon » est prévue pour le
// navigateur ; la sécurité est assurée par les politiques RLS côté base).

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // nécessaire pour le lien magique
      },
    })
  : null;
