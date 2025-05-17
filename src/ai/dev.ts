
import { config } from 'dotenv';
config();

import '@/ai/flows/refine-prompt.ts';
import '@/ai/flows/summarize-document.ts';
import '@/ai/flows/generate-chapter-outline.ts';
import '@/ai/flows/modify-task-list.ts';
import '@/ai/flows/thesis-agent-flow.ts';
import '@/ai/flows/generate-thesis-plan-flow.ts'; // Ajout du nouveau flux
    
