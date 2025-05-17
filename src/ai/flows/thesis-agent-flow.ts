
'use server';
/**
 * @fileOverview Un agent IA capable de gérer divers aspects du flux de travail d'une thèse
 * et d'interagir avec les différentes sections de l'application ThesisFlow360.
 *
 * - processUserRequest - Fonction principale pour traiter les requêtes de l'utilisateur en langage naturel.
 * - ThesisAgentInput - Schéma d'entrée pour l'agent.
 * - ThesisAgentOutput - Schéma de sortie pour l'agent.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { supabase } from '@/lib/supabaseClient';
import type { PromptLogEntry } from '@/types'; 
import { refinePrompt, type RefinePromptInput, type RefinePromptOutput } from '@/ai/flows/refine-prompt';
import { generateThesisPlan, type GenerateThesisPlanInput, type GenerateThesisPlanOutput } from '@/ai/flows/generate-thesis-plan-flow';

// --- Définitions des Outils ---

const AddChapterInputSchema = z.object({
  name: z.string().describe("Le nom du chapitre à ajouter."),
});
const addChapterTool = ai.defineTool(
  {
    name: 'addChapterTool',
    description: 'Ajoute un nouveau chapitre au tableau de bord de la thèse. Utilisez ceci lorsque l\'utilisateur veut créer ou ajouter une nouvelle section de chapitre.',
    inputSchema: AddChapterInputSchema,
    outputSchema: z.object({
      chapterId: z.string().optional().describe("ID du chapitre nouvellement créé, si réussi."),
      message: z.string().describe("Un message de confirmation ou d'erreur."),
      success: z.boolean().describe("Indique si l'opération a réussi.")
    }),
  },
  async (input) => {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .insert([{ name: input.name, progress: 0, status: 'Non commencé', supervisor_comments: [] }])
        .select()
        .single();
      if (error) throw error;
      return { chapterId: data.id, message: `Chapitre "${input.name}" ajouté avec succès.`, success: true };
    } catch (e: any) {
      console.error("Erreur addChapterTool:", e);
      return { message: `Erreur lors de l'ajout du chapitre: ${e.message}`, success: false };
    }
  }
);

const AddBrainDumpEntryInputSchema = z.object({
  text: z.string().describe("Le contenu textuel de la note du vide-cerveau."),
  status: z.enum(["captured", "task", "idea"]).optional().default("captured").describe("Le statut de la note, ex: 'captured' pour une pensée brute, 'task' si c'est une action, 'idea' si c'est un concept plus développé. Par défaut 'captured'."),
});
const addBrainDumpEntryTool = ai.defineTool(
  {
    name: 'addBrainDumpEntryTool',
    description: 'Ajoute une nouvelle note (pensée, idée, ou tâche rapide) à la section vide-cerveau. Utilisez ceci pour une capture rapide des pensées de l\'utilisateur.',
    inputSchema: AddBrainDumpEntryInputSchema,
    outputSchema: z.object({
      entryId: z.string().optional().describe("ID de la note du vide-cerveau nouvellement créée, si réussi."),
      message: z.string().describe("Un message de confirmation ou d'erreur."),
      success: z.boolean().describe("Indique si l'opération a réussi.")
    }),
  },
  async (input) => {
    try {
      const { data, error } = await supabase
        .from('brain_dump_entries')
        .insert([{ text: input.text, status: input.status || 'captured' }])
        .select()
        .single();
      if (error) throw error;
      return { entryId: data.id, message: `Note ajoutée au vide-cerveau: "${input.text.substring(0,30)}...".`, success: true };
    } catch (e: any) {
      console.error("Erreur addBrainDumpEntryTool:", e);
      return { message: `Erreur lors de l'ajout au vide-cerveau: ${e.message}`, success: false };
    }
  }
);

const AddDailyObjectiveInputSchema = z.object({
  text: z.string().describe("Le texte de l'objectif quotidien."),
});
const addDailyObjectiveTool = ai.defineTool(
  {
    name: 'addDailyObjectiveTool',
    description: 'Ajoute un nouvel objectif quotidien au plan du jour. Utilisez ceci lorsque l\'utilisateur spécifie un but pour la journée.',
    inputSchema: AddDailyObjectiveInputSchema,
    outputSchema: z.object({
      objectiveId: z.string().optional().describe("ID de l'objectif quotidien nouvellement créé, si réussi."),
      message: z.string().describe("Un message de confirmation ou d'erreur."),
      success: z.boolean().describe("Indique si l'opération a réussi.")
    }),
  },
  async (input) => {
    try {
      const { data, error } = await supabase
        .from('daily_objectives')
        .insert([{ text: input.text, completed: false }])
        .select()
        .single();
      if (error) throw error;
      return { objectiveId: data.id, message: `Objectif du jour ajouté: "${input.text}".`, success: true };
    } catch (e: any) {
      console.error("Erreur addDailyObjectiveTool:", e);
      return { message: `Erreur lors de l'ajout de l'objectif du jour: ${e.message}`, success: false };
    }
  }
);

const AddSourceInputSchema = z.object({
  title: z.string().describe("Titre de la source."),
  type: z.enum(["pdf", "website", "interview", "field_notes", "other"]).describe("Type de la source (ex: pdf, website)."),
  source_link_or_path: z.string().optional().describe("Lien ou chemin du fichier pour la source (optionnel)."),
  notes: z.string().optional().describe("Notes additionnelles sur la source (optionnel)."),
});
const addSourceTool = ai.defineTool(
  {
    name: 'addSourceTool',
    description: 'Ajoute une nouvelle source (ex: PDF, site web, notes d\'entretien) à la bibliothèque de sources. Utilisez ceci lorsque l\'utilisateur veut enregistrer une référence.',
    inputSchema: AddSourceInputSchema,
    outputSchema: z.object({
      sourceId: z.string().optional().describe("ID de la source nouvellement créée, si réussi."),
      message: z.string().describe("Un message de confirmation ou d'erreur."),
      success: z.boolean().describe("Indique si l'opération a réussi.")
    }),
  },
  async (input) => {
    try {
      const { data, error } = await supabase
        .from('sources')
        .insert([{ title: input.title, type: input.type, source_link_or_path: input.source_link_or_path, notes: input.notes }])
        .select()
        .single();
      if (error) throw error;
      return { sourceId: data.id, message: `Source "${input.title}" ajoutée à la bibliothèque.`, success: true };
    } catch (e: any) {
      console.error("Erreur addSourceTool:", e);
      return { message: `Erreur lors de l'ajout de la source: ${e.message}`, success: false };
    }
  }
);

const AddTaskInputSchema = z.object({
  text: z.string().describe("Description de la tâche. Si l'utilisateur veut 'lancer le chrono' ou 'démarrer un pomodoro', formulez ceci comme 'Démarrer Pomodoro pour : [description]'."),
  type: z.enum(["urgent", "important", "reading", "chatgpt", "secondary"]).optional().default("secondary").describe("Type de la tâche (ex: urgent, important). Par défaut 'secondary'."),
});
const addTaskTool = ai.defineTool(
  {
    name: 'addTaskTool',
    description: 'Ajoute une nouvelle tâche au Gestionnaire de Tâches IA. Si l\'utilisateur demande de "lancer le chrono" ou "démarrer un pomodoro" pour une activité spécifique, créez une tâche instruisant de démarrer une session Pomodoro pour cette activité. Par exemple, si l\'utilisateur dit "lance le chrono pour écrire mon intro", le texte de la tâche devrait être "Démarrer Pomodoro pour : écrire l\'introduction". Pour les autres demandes d\'ajout de tâche, créez simplement la tâche.',
    inputSchema: AddTaskInputSchema,
    outputSchema: z.object({
      taskId: z.string().optional().describe("ID de la tâche nouvellement créée, si réussi."),
      message: z.string().describe("Un message de confirmation ou d'erreur."),
      success: z.boolean().describe("Indique si l'opération a réussi.")
    }),
  },
  async (input) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ text: input.text, type: input.type || 'secondary', completed: false }])
        .select()
        .single();
      if (error) throw error;
      return { taskId: data.id, message: `Tâche ajoutée : "${input.text}".`, success: true };
    } catch (e: any) {
      console.error("Erreur addTaskTool:", e);
      return { message: `Erreur lors de l'ajout de la tâche: ${e.message}`, success: false };
    }
  }
);

const RefinePromptToolInputSchema = z.object({
  promptToRefine: z.string().describe("Le prompt que l'utilisateur souhaite affiner."),
});
const refinePromptTool = ai.defineTool(
  {
    name: 'refinePromptTool',
    description: 'Affine un prompt utilisateur donné pour le rendre plus efficace. Utilisez ceci si l\'utilisateur demande explicitement d\'affiner ou d\'améliorer un prompt.',
    inputSchema: RefinePromptToolInputSchema,
    outputSchema: z.object({
        refinedPrompt: z.string().describe("Le prompt affiné."),
        reasoning: z.string().describe("Explication de la raison pour laquelle le prompt a été affiné de cette manière."),
        message: z.string().describe("Un message de confirmation."),
        success: z.boolean().describe("Indique si l'opération a réussi.")
    }),
  },
  async (input) => {
    try {
      const { data: logEntries, error: logError } = await supabase
        .from('prompt_log_entries')
        .select('original_prompt, refined_prompt')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (logError) console.warn("Impossible de récupérer l'historique des prompts pour l'affinage:", logError.message);

      const historyPrompts = (logEntries || [])
        .map(p => p.refined_prompt || p.original_prompt)
        .filter(p => p && p.trim() !== '');
      
      const refineFlowInput: RefinePromptInput = {
        prompt: input.promptToRefine,
        promptHistory: historyPrompts,
      };
      
      const result: RefinePromptOutput = await refinePrompt(refineFlowInput);

      const newLogEntryPayload: Omit<PromptLogEntry, 'id' | 'timestamp'> = {
        original_prompt: input.promptToRefine,
        refined_prompt: result.refinedPrompt,
        reasoning: result.reasoning,
        tags: ['affinage_par_agent'], 
      };
      const { error: insertError } = await supabase.from('prompt_log_entries').insert(newLogEntryPayload);
      if (insertError) throw insertError; 

      return { refinedPrompt: result.refinedPrompt, reasoning: result.reasoning, message: "Prompt affiné et consigné avec succès.", success: true };
    } catch (e: any) {
      console.error("Erreur refinePromptTool:", e);
      return { refinedPrompt: input.promptToRefine, reasoning: "", message: `Erreur lors de l'affinage du prompt: ${e.message}`, success: false };
    }
  }
);

const CreateThesisPlanToolInputSchema = z.object({
  topicOrInstructions: z.string().describe("Le sujet de la thèse ou des instructions spécifiques pour générer le plan."),
});
const createThesisPlanTool = ai.defineTool(
  {
    name: 'createThesisPlanTool',
    description: 'Génère un plan de thèse ou de mémoire détaillé basé sur un sujet ou des instructions fournies par l\'utilisateur. Le plan sera retourné sous forme de texte structuré.',
    inputSchema: CreateThesisPlanToolInputSchema,
    outputSchema: z.object({
      plan: z.string().describe("Le plan de thèse généré."),
      message: z.string().describe("Un message de confirmation ou d'erreur."),
      success: z.boolean().describe("Indique si l'opération a réussi.")
    }),
  },
  async (input) => {
    try {
      const result: GenerateThesisPlanOutput = await generateThesisPlan({ topicOrInstructions: input.topicOrInstructions });
      if (result.plan) {
        // Log the plan somewhere if needed, e.g., as a new 'source' or 'brain_dump_entry'
        // For now, just return it.
        return { plan: result.plan, message: `Plan de thèse généré pour "${input.topicOrInstructions.substring(0, 50)}...".`, success: true };
      } else {
        return { plan: "", message: "La génération du plan n'a pas retourné de contenu.", success: false };
      }
    } catch (e: any) {
      console.error("Erreur createThesisPlanTool:", e);
      return { plan: "", message: `Erreur lors de la génération du plan de thèse: ${e.message}`, success: false };
    }
  }
);


// --- Flux Principal de l'Agent ---

const ThesisAgentInputSchema = z.object({
  userRequest: z.string().describe("La requête de l'utilisateur en langage naturel."),
});
export type ThesisAgentInput = z.infer<typeof ThesisAgentInputSchema>;

const ThesisAgentOutputSchema = z.object({
  responseMessage: z.string().describe("La réponse de l'agent IA à l'utilisateur, résumant les actions entreprises ou fournissant des informations."),
  actionsTaken: z.array(z.object({
    toolName: z.string(),
    toolInput: z.any(),
    toolOutput: z.any(),
  })).optional().describe("Détails des outils utilisés et leurs sorties, le cas échéant."),
});
export type ThesisAgentOutput = z.infer<typeof ThesisAgentOutputSchema>;

const thesisAgentMainPrompt = ai.definePrompt({
  name: 'thesisAgentMainPrompt',
  input: { schema: ThesisAgentInputSchema },
  output: { schema: ThesisAgentOutputSchema },
  tools: [
    addChapterTool, 
    addBrainDumpEntryTool, 
    addDailyObjectiveTool, 
    addSourceTool, 
    addTaskTool,
    refinePromptTool,
    createThesisPlanTool // Ajout du nouvel outil
  ],
  prompt: `Tu es ThesisBot, un assistant IA avancé pour l'application ThesisFlow360, conçue pour aider les étudiants dans la rédaction de leur thèse.
Ta mission est de comprendre les requêtes de l'utilisateur en français et d'utiliser les outils disponibles pour y répondre efficacement.

Voici les actions que tu peux entreprendre avec les outils :
- **Ajouter un chapitre** : Si l'utilisateur veut créer un nouveau chapitre (ex: "ajoute un chapitre sur ma méthodologie"). Utilise \`addChapterTool\`.
- **Ajouter une note au vide-cerveau** : Pour capturer rapidement des idées, des pensées ou des petites tâches (ex: "note que je dois vérifier la citation de Durkheim"). Utilise \`addBrainDumpEntryTool\`.
- **Ajouter un objectif du jour** : Si l'utilisateur définit un objectif pour sa journée de travail (ex: "aujourd'hui, je veux finir la relecture du chapitre 2"). Utilise \`addDailyObjectiveTool\`.
- **Ajouter une source** : Pour enregistrer une référence bibliographique, un document, un site web, etc. (ex: "enregistre cette source : titre 'L'IA et le futur', type 'pdf', lien '/docs/ia_futur.pdf'"). Utilise \`addSourceTool\`.
- **Ajouter une tâche / Lancer le chrono (Pomodoro)** :
    - Si l'utilisateur veut "lancer le chrono", "démarrer un pomodoro" ou une expression similaire pour une activité, crée une tâche spécifique comme "Démarrer Pomodoro pour : [description de l'activité]". Par exemple, "lance le chrono pour rédiger la conclusion" devient une tâche "Démarrer Pomodoro pour : rédiger la conclusion".
    - Pour toute autre demande d'ajout de tâche (ex: "ajoute une tâche pour contacter mon superviseur").
    Utilise \`addTaskTool\` dans les deux cas.
- **Affiner un prompt** : Si l'utilisateur demande explicitement d'améliorer, d'affiner ou de reformuler un prompt pour une meilleure interaction avec une IA. Utilise \`refinePromptTool\`.
- **Créer un plan de thèse** : Si l'utilisateur demande de générer un plan de thèse, un plan de mémoire, ou une structure pour son travail de recherche pour un sujet donné (ex: "fais-moi un plan de mémoire sur l'impact des réseaux sociaux sur les adolescents"). Utilise \`createThesisPlanTool\`. Le plan généré sera retourné dans le message de réponse.

Instructions importantes :
- Réponds toujours en français.
- Sois concis et direct. Confirme l'action effectuée (ex: "Chapitre 'Conclusion' ajouté.").
- Si un outil est utilisé avec succès, le champ \`message\` de la sortie de l'outil devrait être utilisé pour formuler ta réponse. Si l'outil retourne des données (comme un plan de thèse), inclus-les clairement dans ta réponse.
- Si un outil échoue, informe l'utilisateur de l'échec et de la raison si possible (contenue dans le champ \`message\` de la sortie de l'outil en cas d'échec).
- Si la demande de l'utilisateur n'est pas claire ou ne correspond à aucun outil, demande des clarifications. N'invente pas d'actions.
- N'hésite pas à utiliser les outils dès que tu es raisonnablement sûr de l'intention de l'utilisateur. Ne demande pas de confirmation superflue avant d'agir.
- Si plusieurs outils sont appelés, essaie de synthétiser les résultats.
- Pour l'outil \`createThesisPlanTool\`, ta réponse doit inclure le plan généré. Par exemple : "Voici un plan de thèse pour votre sujet : \n\n[Plan de thèse ici]\n\n".

Demande de l'utilisateur : {{{userRequest}}}

---
Instructions de formatage de la réponse :
Ta réponse FINALE DOIT être un objet JSON valide.
Cet objet JSON DOIT contenir une clé "responseMessage" avec une chaîne de caractères comme valeur, qui sera ta réponse textuelle à l'utilisateur.
Si tu utilises des outils, la "responseMessage" doit résumer ce que tu as fait ou le résultat principal.
Si tu poses une question pour clarification, cette question doit être la valeur de "responseMessage".

Exemple si une action a été effectuée :
{
  "responseMessage": "J'ai ajouté le chapitre 'Introduction'."
}

Exemple si tu as généré un plan :
{
  "responseMessage": "Voici le plan de thèse que j'ai généré pour vous :\\n\\n## 1. Introduction\\n   - Contexte\\n   - Problématique\\n\\n## 2. Revue de littérature..."
}

Exemple si tu as besoin de clarification :
{
  "responseMessage": "Quel est le titre de la source que vous souhaitez ajouter ?"
}
`,
});

const thesisAgentFlow = ai.defineFlow(
  {
    name: 'thesisAgentFlow',
    inputSchema: ThesisAgentInputSchema,
    outputSchema: ThesisAgentOutputSchema,
  },
  async (input) => {
    const llmResponse = await thesisAgentMainPrompt(input);
    const agentOutput = llmResponse.output;
    
    let finalMessage = "";
    const actionsTakenDetails: NonNullable<ThesisAgentOutput['actionsTaken']> = [];

    // Prioriser le message de l'outil s'il existe et est significatif (comme un plan)
    if (llmResponse.toolRequests && llmResponse.toolRequests.length > 0) {
        for (const toolRequest of llmResponse.toolRequests) {
             actionsTakenDetails.push({
                toolName: toolRequest.toolName,
                toolInput: toolRequest.input,
                toolOutput: toolRequest.output, 
            });
            // Si l'outil est createThesisPlanTool et a réussi, son output.plan est le message principal.
            if (toolRequest.toolName === 'createThesisPlanTool' && toolRequest.output?.success && toolRequest.output?.plan) {
                finalMessage = `Voici le plan que j'ai généré pour vous :\n\n${toolRequest.output.plan}`;
            } else if (toolRequest.output?.message && !finalMessage) { 
                // Utiliser le message de l'outil si aucun message plus spécifique n'a été défini
                finalMessage = toolRequest.output.message;
            }
        }
    }
    
    // Si l'LLM a fourni un responseMessage et qu'aucun message d'outil prioritaire n'a été défini
    if (agentOutput?.responseMessage && !finalMessage) {
        finalMessage = agentOutput.responseMessage;
    } else if (!finalMessage) { // Fallback si aucun message du tout
         if (llmResponse.candidates && llmResponse.candidates.length > 0) {
            const candidate = llmResponse.candidates[0];
            if (candidate.finishReason !== 'STOP' && candidate.finishReason !== 'TOOL_CALLS') {
                finalMessage = `Ma réponse a été interrompue (raison: ${candidate.finishReason}). Veuillez réessayer ou reformuler.`;
            } else if (actionsTakenDetails.length > 0) {
                finalMessage = `J'ai traité votre demande en utilisant ${actionsTakenDetails.length} outil(s).`;
            } else {
                finalMessage = "Je ne suis pas sûr de comprendre. Pouvez-vous reformuler votre demande ?";
            }
        } else {
            finalMessage = "Désolé, une erreur interne est survenue et je n'ai pas pu traiter votre demande.";
        }
    }


    return {
      responseMessage: finalMessage,
      actionsTaken: actionsTakenDetails.length > 0 ? actionsTakenDetails : undefined,
    };
  }
);

export async function processUserRequest(input: ThesisAgentInput): Promise<ThesisAgentOutput> {
  return thesisAgentFlow(input);
}
