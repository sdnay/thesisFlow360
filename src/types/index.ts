export type TaskType = "urgent" | "important" | "reading" | "chatgpt" | "secondary";

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  type: TaskType;
  createdAt: string;
}

export interface Chapter {
  id: string;
  name: string;
  progress: number; // 0-100
  status: string; // e.g., "Not Started", "In Progress", "Under Review", "Completed"
  supervisorComments: string[];
}

export interface PomodoroSession {
  id: string;
  startTime: string;
  duration: number; // in minutes
  notes?: string;
}

export interface BrainDumpEntry {
  id: string;
  text: string;
  createdAt: string;
  status: "captured" | "task" | "idea" | "discarded";
}

export interface Source {
  id: string;
  title: string;
  type: "pdf" | "website" | "interview" | "field_notes" | "other";
  sourceLinkOrPath?: string;
  notes?: string;
  createdAt: string;
}

export interface PromptLogEntry {
  id: string;
  originalPrompt: string;
  refinedPrompt?: string;
  reasoning?: string;
  timestamp: string;
  tags?: string[];
}

export interface DailyObjective {
  id: string;
  text: string;
  completed: boolean;
}
