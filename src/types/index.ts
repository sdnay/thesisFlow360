
import type { Database as SupabaseDatabase } from './supabase'; // Assurez-vous que ce chemin est correct

export type Database = SupabaseDatabase;

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color?: string | null;
  created_at: string;
}

export interface Chapter {
  id: string;
  user_id: string;
  name: string;
  progress: number; // Sera calculée dynamiquement, mais peut aussi être une valeur manuelle de base
  status: string;
  supervisor_comments: string[];
  created_at: string;
  tags?: Tag[];
  tasks?: Task[]; // Pour la page de détail du chapitre
  daily_objectives?: DailyObjective[]; // Pour la page de détail du chapitre
  // Pour la liaison avec les sources via la table de jonction
  sources?: Source[]; // Sera peuplé après requête sur la table de jonction
  chapter_sources?: { source_id: string, sources: Source }[]; // Typage plus précis pour la jointure Supabase
}

// Nouvelle interface pour la table de jonction chapter_sources
export interface ChapterSource {
  chapter_id: string;
  source_id: string;
  user_id: string;
  // created_at?: string; // Si vous ajoutez une date de création à la liaison
}

export interface Task {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  type: TaskType;
  created_at: string;
  chapter_id?: string | null;
  chapters?: Pick<Chapter, 'id' | 'name'> | null; // Pour afficher le nom du chapitre lié
  tags?: Tag[];
}

export type TaskType = "urgent" | "important" | "reading" | "chatgpt" | "secondary";

export interface DailyPlan {
  id: string;
  user_id: string;
  plan_date: string; // YYYY-MM-DD
  title?: string | null;
  created_at: string;
}

export interface DailyObjective {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  objective_date: string; // YYYY-MM-DD
  created_at: string;
  completed_at?: string | null;
  chapter_id?: string | null;
  chapters?: Pick<Chapter, 'id' | 'name'> | null; // Pour afficher le nom du chapitre lié
  daily_plan_id?: string | null;
  daily_plans?: Pick<DailyPlan, 'id' | 'title'> | null;
  tags?: Tag[];
}

export interface PomodoroSession {
  id: string;
  user_id: string;
  start_time: string;
  duration: number; // en minutes
  notes?: string | null;
  created_at: string; // Modifié pour être non optionnel
  chapter_id?: string | null;
  task_id?: string | null;
  daily_objective_id?: string | null;
  chapters?: Pick<Chapter, 'id' | 'name'> | null;
  tasks?: Pick<Task, 'id' | 'text'> | null;
  daily_objectives?: Pick<DailyObjective, 'id' | 'text'> | null;
}

export interface BrainDumpEntry {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  status: BrainDumpEntryStatus;
  chapter_id?: string | null; // Ajout pour lier au chapitre
  chapters?: Pick<Chapter, 'id' | 'name'> | null; // Pour afficher le nom du chapitre lié
  tags?: Tag[];
}
export type BrainDumpEntryStatus = "captured" | "idea" | "task" | "discarded";

export interface Source {
  id: string;
  user_id: string;
  title: string;
  type: 'pdf' | 'website' | 'interview' | 'field_notes' | 'other';
  source_link_or_path?: string | null;
  notes?: string | null;
  created_at: string;
  tags?: Tag[];
  // Pour la liaison avec les chapitres via la table de jonction
  chapters?: Chapter[]; // Sera peuplé après requête sur la table de jonction
  chapter_sources?: { chapter_id: string, chapters: Chapter }[]; // Typage plus précis
}

export interface PromptLogEntry {
  id: string;
  user_id: string;
  original_prompt: string;
  refined_prompt?: string | null; // Permettre null
  reasoning?: string | null; // Permettre null
  timestamp: string;
  tags?: string[] | null; // Permettre null
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'agent'; // 'agent' pour ThesisBot
  content: string;
  actions_taken?: ThesisAgentOutput['actionsTaken']; // Assurez-vous que ThesisAgentOutput est bien défini
  timestamp: string;
}

// Pour l'agent IA
export interface ThesisAgentInput { // Ce qui vient du client pour processUserRequest
  userRequest: string;
  chatHistory?: Array<{ role: 'user' | 'agent' | 'model'; content: string; actions_taken?: any }> | null;
}

export interface ThesisAgentOutput { // Ce que processUserRequest retourne
  responseMessage: string;
  actionsTaken?: Array<{
    toolName: string;
    toolInput: any;
    toolOutput: any;
  }> | null;
}
