
export type TaskType = "urgent" | "important" | "reading" | "chatgpt" | "secondary";

export interface Task {
  id: string; // Sera un UUID de Supabase
  text: string;
  completed: boolean;
  type: TaskType;
  created_at: string; // Nom de colonne Supabase standard, sera string ISO
}

export interface Chapter {
  id: string; // UUID
  name: string;
  progress: number; // 0-100
  status: string; 
  supervisor_comments: string[]; // Supabase: text[]
  // created_at pourrait être ajouté si nécessaire
}

export interface PomodoroSession {
  id: string; // UUID
  start_time: string; // Supabase: timestamptz (string ISO)
  duration: number; // en minutes
  notes?: string;
  // created_at pourrait être ajouté
}

export interface BrainDumpEntry {
  id: string; // UUID
  text: string;
  created_at: string; // Supabase: timestamptz (string ISO)
  status: "captured" | "task" | "idea" | "discarded"; 
}

export interface Source {
  id: string; // UUID
  title: string;
  type: "pdf" | "website" | "interview" | "field_notes" | "other"; 
  source_link_or_path?: string;
  notes?: string;
  created_at: string; // Supabase: timestamptz (string ISO)
}

export interface PromptLogEntry {
  id: string; // UUID
  original_prompt: string;
  refined_prompt?: string;
  reasoning?: string;
  timestamp: string; // Supabase: timestamptz (string ISO)
  tags?: string[]; // Supabase: text[]
}

export interface DailyObjective {
  id: string; // UUID
  text: string;
  completed: boolean;
  // created_at pourrait être ajouté
}

// Ce type est pour générer les types Supabase, à faire avec `supabase gen types typescript > src/types/supabase.ts`
// Pour l'instant, nous allons le définir de manière basique pour que le client Supabase fonctionne.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Task>;
      };
      chapters: {
        Row: Chapter;
        Insert: Omit<Chapter, 'id'>;
        Update: Partial<Chapter>;
      };
      pomodoro_sessions: {
        Row: PomodoroSession;
        Insert: Omit<PomodoroSession, 'id'>;
        Update: Partial<PomodoroSession>;
      };
      brain_dump_entries: {
        Row: BrainDumpEntry;
        Insert: Omit<BrainDumpEntry, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<BrainDumpEntry>;
      };
      sources: {
        Row: Source;
        Insert: Omit<Source, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Source>;
      };
      prompt_log_entries: {
        Row: PromptLogEntry;
        Insert: Omit<PromptLogEntry, 'id' | 'timestamp'> & { timestamp?: string, tags?: string[] };
        Update: Partial<PromptLogEntry>;
      };
      daily_objectives: {
        Row: DailyObjective;
        Insert: Omit<DailyObjective, 'id'>;
        Update: Partial<DailyObjective>;
      };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
    Enums: {
      [_ in never]: never
    };
    CompositeTypes: {
      [_ in never]: never
    };
  };
};
