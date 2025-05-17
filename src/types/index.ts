
import type { Database as SupabaseDatabase } from './supabase'; // Assurez-vous que ce chemin est correct

export type Database = SupabaseDatabase;

// NOUVELLE INTERFACE POUR LES TAGS
export interface Tag {
  id: string;
  user_id: string; // Ajouté pour les tags spécifiques à l'utilisateur
  name: string;
  color?: string | null;
  created_at: string;
}

export interface Chapter {
  id: string;
  user_id: string; // Ajouté
  name: string;
  progress: number;
  status: string;
  supervisor_comments: string[];
  created_at: string;
  chapter_tags?: { tags: Tag }[];
  tags?: Tag[];
  // Pour les éléments liés (récupérés séparément ou via des jointures plus complexes)
  tasks_count?: number;
  daily_objectives_count?: number;
}

export interface Task {
  id: string;
  user_id: string; // Ajouté
  text: string;
  completed: boolean;
  type: TaskType;
  created_at: string;
  chapter_id?: string | null;
  chapters?: { id: string, name: string } | null;
  task_tags?: { tags: Tag }[];
  tags?: Tag[];
}

export type TaskType = "urgent" | "important" | "reading" | "chatgpt" | "secondary";

export interface DailyObjective {
  id: string;
  user_id: string; // Ajouté
  text: string;
  completed: boolean;
  objective_date: string;
  created_at: string;
  completed_at?: string | null;
  chapter_id?: string | null;
  chapters?: { id: string, name: string } | null;
  daily_objective_tags?: { tags: Tag }[];
  tags?: Tag[];
}

export interface PomodoroSession {
  id: string;
  user_id: string; // Ajouté
  start_time: string;
  duration: number;
  notes?: string | null;
  created_at?: string;
  chapter_id?: string | null;
  task_id?: string | null;
  daily_objective_id?: string | null;
  chapters?: { id: string, name: string } | null;
  tasks?: { id: string, text: string } | null;
  daily_objectives?: { id: string, text: string } | null;
}

export interface BrainDumpEntry {
  id: string;
  user_id: string; // Ajouté
  text: string;
  created_at: string;
  status: BrainDumpEntryStatus;
  brain_dump_entry_tags?: { tags: Tag }[];
  tags?: Tag[];
}
export type BrainDumpEntryStatus = "captured" | "idea" | "task" | "discarded";

export interface Source {
  id: string;
  user_id: string; // Ajouté
  title: string;
  type: 'pdf' | 'website' | 'interview' | 'field_notes' | 'other';
  source_link_or_path?: string | null;
  notes?: string | null;
  created_at: string;
  source_tags?: { tags: Tag }[];
  tags?: Tag[];
}

export interface PromptLogEntry {
  id: string;
  user_id: string; // Ajouté
  original_prompt: string;
  refined_prompt?: string;
  reasoning?: string;
  timestamp: string;
  tags?: string[]; // Textuels pour l'instant, pourraient devenir des relations de Tag aussi
}

// Rappel : Après avoir appliqué les modifications SQL à votre base Supabase,
// générez les types précis avec la CLI Supabase pour remplacer le contenu de src/types/supabase.ts :
// npx supabase gen types typescript --project-id VOTRE_ID_PROJET --schema public > src/types/supabase.ts
// Et dans supabaseClient.ts, assurez-vous d'importer { Database } depuis ce fichier généré.
