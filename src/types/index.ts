
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
  created_at?: string;
}

export interface PomodoroSession {
  id: string;
  start_time: string;
  duration: number;
  notes?: string;
  created_at?: string;
}

export type BrainDumpEntryStatus = "captured" | "task" | "idea" | "discarded";

export interface BrainDumpEntry {
  id: string;
  text: string;
  created_at: string;
  status: BrainDumpEntryStatus;
}

export type SourceType = "pdf" | "website" | "interview" | "field_notes" | "other";

export interface Source {
  id: string;
  title: string;
  type: SourceType;
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
  objective_date: string; // Format YYYY-MM-DD, NOT NULL
  created_at: string; // NOT NULL
  completed_at?: string | null; // TIMESTAMPTZ, can be null
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
        Insert: Omit<DailyObjective, 'id' | 'created_at'> & { created_at?: string, objective_date?: string, completed_at?: string | null };
        Update: Partial<Omit<DailyObjective, 'id' | 'created_at'>> & { objective_date?: string, completed_at?: string | null };
      };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
    Enums: {
      brain_dump_status: BrainDumpEntryStatus;
      source_type_enum: SourceType;
      task_type_enum: TaskType;
    };
    CompositeTypes: {
      [_ in never]: never
    };
  };
};
