
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Fonction pour créer un client Supabase côté client (navigateur)
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Supabase URL (NEXT_PUBLIC_SUPABASE_URL) is not defined in environment variables. Please set it in your .env file.");
  }
  if (!(supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
    throw new Error(
      `The Supabase URL (NEXT_PUBLIC_SUPABASE_URL) in your .env file appears to be invalid. It must start with 'http://' or 'https://'. Current value: '${supabaseUrl}'`
    );
  }
  if (!supabaseAnonKey) {
    throw new Error("Supabase anonymous key (NEXT_PUBLIC_SUPABASE_ANON_KEY) is not defined in environment variables. Please set it in your .env file.");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Exporter une instance unique si vous préférez ne pas appeler la fonction partout,
// mais pour l'AuthContext, il est souvent préférable de créer une instance fraîche ou de la passer.
// Pour les appels directs dans les composants, une instance partagée est acceptable.
export const supabase = createSupabaseBrowserClient();
