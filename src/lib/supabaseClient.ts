
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase'; // Ce type sera généré par Supabase CLI ou défini manuellement

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL is not defined in environment variables. Please set NEXT_PUBLIC_SUPABASE_URL.");
}
if (!supabaseAnonKey) {
  throw new Error("Supabase anonymous key is not defined in environment variables. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
