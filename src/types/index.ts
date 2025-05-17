
import type { Database as SupabaseDatabase } from './supabase'; // Assurez-vous que ce chemin est correct

export type Database = SupabaseDatabase;

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  created_at: string;
}

export interface Chapter {
  id: string;
  name: string;
  progress: number;
  status: string;
  supervisor_comments: string[];
  created_at: string;
  // Pour la récupération via Supabase avec jointure (la structure peut varier un peu)
  chapter_tags?: { tags: Tag }[]; // Supabase structure pour many-to-many
  // Champ simplifié après traitement des données côté client
  tags?: Tag[]; 
  tasks?: Partial<Task>[]; // Pour afficher les tâches liées
  daily_objectives?: Partial<DailyObjective>[]; // Pour afficher les objectifs liés
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  type: TaskType;
  created_at: string;
  chapter_id?: string | null;
  // Pour la récupération via Supabase avec jointure
  chapters?: { id: string, name: string } | null; // Chapitre lié
  task_tags?: { tags: Tag }[]; // Supabase structure pour many-to-many
  // Champ simplifié après traitement
  tags?: Tag[];
}

export type TaskType = "urgent" | "important" | "reading" | "chatgpt" | "secondary";

export interface DailyObjective {
  id: string;
  text: string;
  completed: boolean;
  objective_date: string; // YYYY-MM-DD
  created_at: string;
  completed_at?: string | null;
  chapter_id?: string | null;
  // Pour la récupération via Supabase avec jointure
  chapters?: { id: string, name: string } | null; // Chapitre lié
  daily_objective_tags?: { tags: Tag }[]; // Supabase structure
  // Champ simplifié après traitement
  tags?: Tag[];
}

export interface PomodoroSession {
  id: string;
  start_time: string; // ISO string
  duration: number; // en minutes
  notes?: string | null;
  created_at?: string; // Ajouté pour cohérence, Supabase peut le gérer
  // Clés étrangères
  chapter_id?: string | null;
  task_id?: string | null;
  daily_objective_id?: string | null;
  // Relations pour affichage (après jointure)
  chapters?: { id: string, name: string } | null;
  tasks?: { id: string, text: string } | null;
  daily_objectives?: { id: string, text: string } | null;
}

export interface BrainDumpEntry {
  id: string;
  text: string;
  created_at: string;
  status: BrainDumpEntryStatus;
  // Pour la récupération via Supabase avec jointure
  brain_dump_entry_tags?: { tags: Tag }[]; // Supabase structure
  // Champ simplifié après traitement
  tags?: Tag[];
}
export type BrainDumpEntryStatus = "captured" | "idea" | "task" | "discarded";

export interface Source {
  id: string;
  title: string;
  type: 'pdf' | 'website' | 'interview' | 'field_notes' | 'other';
  source_link_or_path?: string | null;
  notes?: string | null;
  created_at: string;
  // Pour la récupération via Supabase avec jointure
  source_tags?: { tags: Tag }[]; // Supabase structure
  // Champ simplifié après traitement
  tags?: Tag[];
}

export interface PromptLogEntry {
  id: string;
  original_prompt: string;
  refined_prompt?: string;
  reasoning?: string;
  timestamp: string;
  tags?: string[]; // Ces tags sont textuels pour l'instant
}

// Important : Vous DEVEZ générer vos types Supabase après avoir appliqué les modifications SQL.
// Commande : npx supabase gen types typescript --project-id VOTRE_ID_PROJET --schema public > src/types/supabase.ts
// Puis, dans supabaseClient.ts, importez { Database } from './supabase' (ou le chemin correct).
// Les types `Insert` et `Update` dans le commentaire ci-dessous sont des exemples
// et seront remplacés par les types générés par Supabase.

/*
Pour src/lib/supabaseClient.ts :
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'; // CE FICHI SERA GENERE

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
*/
