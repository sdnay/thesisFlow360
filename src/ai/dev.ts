import { config } from 'dotenv';
config();

import '@/ai/flows/refine-prompt.ts';
import '@/ai/flows/summarize-document.ts';
import '@/ai/flows/generate-chapter-outline.ts';
import '@/ai/flows/modify-task-list.ts';