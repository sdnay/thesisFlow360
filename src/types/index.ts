
export type TaskType = "urgent" | "important" | "reading" | "chatgpt" | "secondary";

export interface Task {
  id: string; 
  text: string;
  completed: boolean;
  type: TaskType;
  created_at: string; 
}

export interface Chapter {
  id: string; 
  name: string;
  progress: number; 
  status: string; 
  supervisor_comments: string[]; 
  created_at?: string; // Rendu optionnel car pas toujours présent à l'insertion manuelle
}

export interface PomodoroSession {
  id: string; 
  start_time: string; 
  duration: number; 
  notes?: string;
  created_at?: string;
}

export interface BrainDumpEntry {
  id: string; 
  text: string;
  created_at: string; 
  status: "captured" | "task" | "idea" | "discarded"; 
}

export interface Source {
  id: string; 
  title: string;
  type: "pdf" | "website" | "interview" | "field_notes" | "other"; 
  source_link_or_path?: string;
  notes?: string;
  created_at: string; 
}

export interface PromptLogEntry {
  id: string; 
  original_prompt: string;
  refined_prompt?: string;
  reasoning?: string;
  timestamp: string; 
  tags?: string[]; 
}

export interface DailyObjective {
  id: string; 
  text: string;
  completed: boolean;
  created_at?: string;
}


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
        Update: Partial<Omit<Task, 'id' | 'created_at'>>;
      };
      chapters: {
        Row: Chapter;
        Insert: Omit<Chapter, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Chapter, 'id' | 'created_at'>>;
      };
      pomodoro_sessions: {
        Row: PomodoroSession;
        Insert: Omit<PomodoroSession, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Omit<PomodoroSession, 'id' | 'created_at'>>;
      };
      brain_dump_entries: {
        Row: BrainDumpEntry;
        Insert: Omit<BrainDumpEntry, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Omit<BrainDumpEntry, 'id' | 'created_at'>>;
      };
      sources: {
        Row: Source;
        Insert: Omit<Source, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Source, 'id' | 'created_at'>>;
      };
      prompt_log_entries: {
        Row: PromptLogEntry;
        Insert: Omit<PromptLogEntry, 'id' | 'timestamp'> & { timestamp?: string, tags?: string[] };
        Update: Partial<Omit<PromptLogEntry, 'id' | 'timestamp'>>;
      };
      daily_objectives: {
        Row: DailyObjective;
        Insert: Omit<DailyObjective, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Omit<DailyObjective, 'id' | 'created_at'>>;
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
