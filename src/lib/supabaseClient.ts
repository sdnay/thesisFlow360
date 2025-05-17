
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase'; // Ce type sera généré par Supabase CLI ou défini manuellement

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL (NEXT_PUBLIC_SUPABASE_URL) is not defined in environment variables. Please set it in your .env file.");
}

// Add a more specific check for URL format
if (!(supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
  throw new Error(
    `The Supabase URL (NEXT_PUBLIC_SUPABASE_URL) in your .env file appears to be invalid. It must start with 'http://' or 'https://'. Current value (for debugging, ensure this is not logged in production if sensitive): '${supabaseUrl}'`
  );
}

if (!supabaseAnonKey) {
  throw new Error("Supabase anonymous key (NEXT_PUBLIC_SUPABASE_ANON_KEY) is not defined in environment variables. Please set it in your .env file.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
