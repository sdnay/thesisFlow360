
'use server';
/**
 * @fileOverview Un agent IA capable de gérer divers aspects du flux de travail d'une thèse
 * et d'interagir avec les différentes sections de l'application ThesisFlow360.
 *
 * - processUserRequest - Fonction principale pour traiter les requêtes de l'utilisateur en langage naturel.
 * - ThesisAgentInput - Schéma d'entrée pour l'agent (requête utilisateur).
 * - ThesisAgentOutput - Schéma de sortie pour l'agent.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { supabase } from '@/lib/supabaseClient'; // Client Supabase global pour les fonctions logiques des outils
import { refinePrompt, type RefinePromptInput, type RefinePromptOutput } from '@/ai/flows/refine-prompt';
import { generateThesisPlan, type GenerateThesisPlanInput, type GenerateThesisPlanOutput } from '@/ai/flows/generate-thesis-plan-flow';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// --- Schémas d'Input/Output pour les Outils (ce que l'IA voit et génère pour les arguments de l'outil) ---
// Ces schémas NE CONTIENNENT PAS user_id. L'IA ne le fournit pas.

const AddChapterInputSchema = z.object({
  name: z.string().describe("Le nom du chapitre à ajouter."),
});
// Les OutputSchemas des outils peuvent rester tels quels, ils décrivent le résultat de l'outil.
const AddChapterOutputSchema = z.object({
  chapterId: z.string().optional().describe("ID du chapitre nouvellement créé, si réussi."),
  message: z.string().describe("Un message de confirmation ou d'erreur."),
  success: z.boolean().describe("Indique si l'opération a réussi.")
});

const AddBrainDumpEntryInputSchema = z.object({
  text: z.string().describe("Le contenu textuel de la note du vide-cerveau."),
  status: z.enum(["captured", "task", "idea"]).optional().default("captured").describe("Le statut de la note. Par défaut 'captured'."),
});
const AddBrainDumpEntryOutputSchema = z.object({
  entryId: z.string().optional().describe("ID de la note créée, si réussi."),
  message: z.string().describe("Un message de confirmation ou d'erreur."),
  success: z.boolean().describe("Indique si l'opération a réussi.")
});

const AddDailyObjectiveInputSchema = z.object({
  text: z.string().describe("Le texte de l'objectif quotidien."),
});
const AddDailyObjectiveOutputSchema = z.object({
  objectiveId: z.string().optional().describe("ID de l'objectif créé, si réussi."),
  message: z.string().describe("Un message de confirmation ou d'erreur."),
  success: z.boolean().describe("Indique si l'opération a réussi.")
});

const AddSourceInputSchema = z.object({
  title: z.string().describe("Titre de la source."),
  type: z.enum(["pdf", "website", "interview", "field_notes", "other"]).describe("Type de la source."),
  source_link_or_path: z.string().optional().describe("Lien ou chemin du fichier pour la source (optionnel)."),
  notes: z.string().optional().describe("Notes additionnelles sur la source (optionnel)."),
});
const AddSourceOutputSchema = z.object({
  sourceId: z.string().optional().describe("ID de la source créée, si réussi."),
  message: z.string().describe("Un message de confirmation ou d'erreur."),
  success: z.boolean().describe("Indique si l'opération a réussi.")
});

const AddTaskInputSchema = z.object({
  text: z.string().describe("Description de la tâche. Si l'utilisateur veut 'lancer le chrono' ou 'démarrer un pomodoro', formulez ceci comme 'Démarrer Pomodoro pour : [description]'."),
  type: z.enum(["urgent", "important", "reading", "chatgpt", "secondary"]).optional().default("secondary").describe("Type de la tâche. Par défaut 'secondary'."),
});
const AddTaskOutputSchema = z.object({
  taskId: z.string().optional().describe("ID de la tâche créée, si réussi."),
  message: z.string().describe("Un message de confirmation ou d'erreur."),
  success: z.boolean().describe("Indique si l'opération a réussi.")
});

const RefinePromptToolInputSchema = z.object({
  promptToRefine: z.string().describe("Le prompt que l'utilisateur souhaite affiner."),
});
const RefinePromptToolOutputSchema = z.object({
    refinedPrompt: z.string().describe("Le prompt affiné."),
    reasoning: z.string().describe("Explication de l'affinage."),
    message: z.string().describe("Message de confirmation."),
    success: z.boolean().describe("Succès de l'opération.")
});

const CreateThesisPlanToolInputSchema = z.object({
  topicOrInstructions: z.string().describe("Le sujet de la thèse ou des instructions spécifiques pour générer le plan."),
});
const CreateThesisPlanToolOutputSchema = z.object({
  plan: z.string().describe("Le plan de thèse généré."),
  message: z.string().describe("Message de confirmation."),
  success: z.boolean().describe("Succès de l'opération.")
});


// --- Fonctions Logiques des Outils (prennent userId en argument) ---

async function addChapterToolLogic(input: z.infer<typeof AddChapterInputSchema>, userId: string): Promise<z.infer<typeof AddChapterOutputSchema>> {
  try {
    const { data, error } = await supabase
      .from('chapters')
      .insert([{ name: input.name, user_id: userId, progress: 0, status: 'Non commencé', supervisor_comments: [] }])
      .select()
      .single();
    if (error) throw error;
    return { chapterId: data.id, message: `Chapitre "${input.name}" ajouté avec succès.`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgent] Erreur addChapterToolLogic:", e);
    return { message: `Erreur lors de l'ajout du chapitre: ${e.message}`, success: false };
  }
}

async function addBrainDumpEntryToolLogic(input: z.infer<typeof AddBrainDumpEntryInputSchema>, userId: string): Promise<z.infer<typeof AddBrainDumpEntryOutputSchema>> {
  try {
    const { data, error } = await supabase
      .from('brain_dump_entries')
      .insert([{ text: input.text, status: input.status || 'captured', user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return { entryId: data.id, message: `Note ajoutée au vide-cerveau: "${input.text.substring(0,30)}...".`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgent] Erreur addBrainDumpEntryToolLogic:", e);
    return { message: `Erreur lors de l'ajout au vide-cerveau: ${e.message}`, success: false };
  }
}

async function addDailyObjectiveToolLogic(input: z.infer<typeof AddDailyObjectiveInputSchema>, userId: string): Promise<z.infer<typeof AddDailyObjectiveOutputSchema>> {
  try {
    const { data, error } = await supabase
      .from('daily_objectives')
      .insert([{ text: input.text, completed: false, user_id: userId, objective_date: new Date().toISOString().split('T')[0] }])
      .select()
      .single();
    if (error) throw error;
    return { objectiveId: data.id, message: `Objectif du jour ajouté: "${input.text}".`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgent] Erreur addDailyObjectiveToolLogic:", e);
    return { message: `Erreur lors de l'ajout de l'objectif du jour: ${e.message}`, success: false };
  }
}

async function addSourceToolLogic(input: z.infer<typeof AddSourceInputSchema>, userId: string): Promise<z.infer<typeof AddSourceOutputSchema>> {
  try {
    const { data, error } = await supabase
      .from('sources')
      .insert([{ title: input.title, type: input.type, source_link_or_path: input.source_link_or_path, notes: input.notes, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return { sourceId: data.id, message: `Source "${input.title}" ajoutée à la bibliothèque.`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgent] Erreur addSourceToolLogic:", e);
    return { message: `Erreur lors de l'ajout de la source: ${e.message}`, success: false };
  }
}

async function addTaskToolLogic(input: z.infer<typeof AddTaskInputSchema>, userId: string): Promise<z.infer<typeof AddTaskOutputSchema>> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ text: input.text, type: input.type || 'secondary', completed: false, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return { taskId: data.id, message: `Tâche ajoutée : "${input.text}".`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgent] Erreur addTaskToolLogic:", e);
    return { message: `Erreur lors de l'ajout de la tâche: ${e.message}`, success: false };
  }
}

async function refinePromptToolLogic(input: z.infer<typeof RefinePromptToolInputSchema>, userId: string): Promise<z.infer<typeof RefinePromptToolOutputSchema>> {
    try {
      const { data: logEntries, error: logError } = await supabase
        .from('prompt_log_entries')
        .select('original_prompt, refined_prompt')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (logError) console.warn("[ThesisAgent] Impossible de récupérer l'historique des prompts pour l'affinage:", logError.message);

      const historyPrompts = (logEntries || [])
        .map(p => p.refined_prompt || p.original_prompt)
        .filter(p => p && p.trim() !== '');
      
      const refineFlowInput: RefinePromptInput = {
        prompt: input.promptToRefine,
        promptHistory: historyPrompts,
      };
      
      const result: RefinePromptOutput = await refinePrompt(refineFlowInput);

      const newLogEntryPayload = {
        original_prompt: input.promptToRefine,
        refined_prompt: result.refinedPrompt,
        reasoning: result.reasoning,
        tags: ['affinage_par_agent'],
        user_id: userId,
      };
      const { error: insertError } = await supabase.from('prompt_log_entries').insert(newLogEntryPayload);
      if (insertError) throw insertError; 

      return { refinedPrompt: result.refinedPrompt, reasoning: result.reasoning, message: "Prompt affiné et consigné avec succès.", success: true };
    } catch (e: any) {
      console.error("[ThesisAgent] Erreur refinePromptToolLogic:", e);
      return { refinedPrompt: input.promptToRefine, reasoning: "", message: `Erreur lors de l'affinage du prompt: ${e.message}`, success: false };
    }
}

async function createThesisPlanToolLogic(input: z.infer<typeof CreateThesisPlanToolInputSchema>): Promise<z.infer<typeof CreateThesisPlanToolOutputSchema>> {
    try {
      const result: GenerateThesisPlanOutput = await generateThesisPlan({ topicOrInstructions: input.topicOrInstructions });
      if (result.plan) {
        return { plan: result.plan, message: `Plan de thèse généré pour "${input.topicOrInstructions.substring(0, 50)}...".`, success: true };
      } else {
        return { plan: "", message: "La génération du plan n'a pas retourné de contenu.", success: false };
      }
    } catch (e: any) {
      console.error("[ThesisAgent] Erreur createThesisPlanToolLogic:", e);
      return { plan: "", message: `Erreur lors de la génération du plan de thèse: ${e.message}`, success: false };
    }
}


// --- Définitions des Outils pour Genkit (pour la découverte par l'IA) ---
// La fonction d'implémentation ici est une coquille. L'appel réel se fera manuellement dans le flux.
const addChapterToolForAI = ai.defineTool(
  { name: 'addChapterTool', description: 'Ajoute un nouveau chapitre. (Input: { name: string }). Le user_id sera automatiquement lié.', inputSchema: AddChapterInputSchema, outputSchema: AddChapterOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux avec userId."); }
);
const addBrainDumpEntryToolForAI = ai.defineTool(
  { name: 'addBrainDumpEntryTool', description: 'Ajoute une note au vide-cerveau. (Input: { text: string, status?: "captured"|"task"|"idea" }). Le user_id sera automatiquement lié.', inputSchema: AddBrainDumpEntryInputSchema, outputSchema: AddBrainDumpEntryOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux avec userId."); }
);
const addDailyObjectiveToolForAI = ai.defineTool(
  { name: 'addDailyObjectiveTool', description: 'Ajoute un objectif au plan du jour. (Input: { text: string }). Le user_id sera automatiquement lié.', inputSchema: AddDailyObjectiveInputSchema, outputSchema: AddDailyObjectiveOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux avec userId."); }
);
const addSourceToolForAI = ai.defineTool(
  { name: 'addSourceTool', description: 'Enregistre une nouvelle source. (Input: { title: string, type: "pdf"|"website"|"interview"|"field_notes"|"other", source_link_or_path?: string, notes?: string }). Le user_id sera automatiquement lié.', inputSchema: AddSourceInputSchema, outputSchema: AddSourceOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux avec userId."); }
);
const addTaskToolForAI = ai.defineTool(
  { name: 'addTaskTool', description: 'Ajoute une tâche. Si l\'utilisateur mentionne "chrono" ou "pomodoro", le texte de la tâche doit être "Démarrer Pomodoro pour : [description]". (Input: { text: string, type?: "urgent"|"important"|"reading"|"chatgpt"|"secondary" }). Le user_id sera automatiquement lié.', inputSchema: AddTaskInputSchema, outputSchema: AddTaskOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux avec userId."); }
);
const refinePromptToolForAI = ai.defineTool(
  { name: 'refinePromptTool', description: 'Améliore un prompt fourni par l\'utilisateur. (Input: { promptToRefine: string }). Cette action enregistre également le prompt original et affiné.', inputSchema: RefinePromptToolInputSchema, outputSchema: RefinePromptToolOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux."); }
);
const createThesisPlanToolForAI = ai.defineTool(
  { name: 'createThesisPlanTool', description: 'Génère un plan de thèse ou de mémoire structuré. (Input: { topicOrInstructions: string }).', inputSchema: CreateThesisPlanToolInputSchema, outputSchema: CreateThesisPlanToolOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux."); }
);


// --- Schéma d'Entrée/Sortie pour l'Agent Principal ---
export const ThesisAgentInputSchema = z.object({
  userRequest: z.string().describe("La requête de l'utilisateur en langage naturel."),
});
export type ThesisAgentInput = z.infer<typeof ThesisAgentInputSchema>;

export const ThesisAgentOutputSchema = z.object({
  responseMessage: z.string().describe("La réponse de l'agent IA à l'utilisateur, résumant les actions entreprises ou fournissant des informations."),
  actionsTaken: z.array(z.object({
    toolName: z.string(),
    toolInput: z.any(),
    toolOutput: z.any(),
  })).optional().describe("Détails des outils utilisés et leurs sorties, le cas échéant."),
});
export type ThesisAgentOutput = z.infer<typeof ThesisAgentOutputSchema>;

// --- Prompt Principal de l'Agent ---
const thesisAgentMainPrompt = ai.definePrompt({
  name: 'thesisAgentMainPrompt',
  input: { schema: ThesisAgentInputSchema }, // L'IA ne voit que la requête utilisateur
  output: { schema: ThesisAgentOutputSchema },
  tools: [
    addChapterToolForAI,
    addBrainDumpEntryToolForAI,
    addDailyObjectiveToolForAI,
    addSourceToolForAI,
    addTaskToolForAI,
    refinePromptToolForAI,
    createThesisPlanToolForAI
  ],
  prompt: `Tu es ThesisBot, un assistant IA expert intégré à l'application ThesisFlow360. Ton rôle est d'aider les étudiants à organiser et à progresser dans la rédaction de leur thèse ou mémoire. Tu dois comprendre leurs requêtes en langage naturel (français) et utiliser les outils mis à ta disposition pour effectuer des actions concrètes dans l'application ou fournir des informations pertinentes. Toutes les actions de création de données (chapitres, tâches, etc.) doivent être associées à l'utilisateur qui fait la requête ; tu n'as pas besoin de demander son ID, il sera géré automatiquement par le système lors de l'exécution de l'outil.

**Contexte de l'Application ThesisFlow360 :**

L'application permet de gérer :
* **Chapitres de la thèse** : Suivi de la progression, commentaires du superviseur.
* **Tâches** : Listes de choses à faire, classées par type (urgent, important, lecture, etc.).
* **Objectifs Journaliers** : Cibles quotidiennes pour rester concentré.
* **Vide-Cerveau (Brain Dump)** : Capture rapide d'idées brutes, de notes, de citations.
* **Sources** : Bibliothèque de références (PDF, sites web, entretiens).
* **Sessions Pomodoro** : Suivi du temps de travail focalisé.
* **Prompts IA** : Historique et affinage de prompts pour interagir avec d'autres IA.

**Tes Capacités (Outils Disponibles) :**
* \`addChapterTool\` : Ajoute un nouveau chapitre. (Input: \`{ name: string }\`). Le \`user_id\` sera automatiquement lié.
* \`addBrainDumpEntryTool\` : Ajoute une note au vide-cerveau. (Input: \`{ text: string, status?: "captured"|"task"|"idea" }\`). Le \`user_id\` sera automatiquement lié.
* \`addDailyObjectiveTool\` : Ajoute un objectif au plan du jour. (Input: \`{ text: string }\`). Le \`user_id\` sera automatiquement lié.
* \`addSourceTool\` : Enregistre une nouvelle source. (Input: \`{ title: string, type: "pdf"|"website"|"interview"|"field_notes"|"other", source_link_or_path?: string, notes?: string }\`). Le \`user_id\` sera automatiquement lié.
* \`addTaskTool\` : Ajoute une tâche. Si l'utilisateur mentionne "chrono" ou "pomodoro", le texte de la tâche doit être "Démarrer Pomodoro pour : [description]". (Input: \`{ text: string, type?: "urgent"|"important"|"reading"|"chatgpt"|"secondary" }\`). Le \`user_id\` sera automatiquement lié.
* \`refinePromptTool\` : Améliore un prompt fourni par l'utilisateur. (Input: \`{ promptToRefine: string }\`). Cette action enregistre également le prompt original et affiné.
* \`createThesisPlanTool\` : Génère un plan de thèse ou de mémoire structuré. (Input: \`{ topicOrInstructions: string }\`).
    * **Note Spéciale pour \`createThesisPlanTool\`** : Si cet outil est utilisé avec succès, ta \`responseMessage\` principale DOIT être le plan généré par l'outil.

**Instructions Générales pour Interagir :**

1.  **Analyse la Requête** : Comprends l'intention principale de l'utilisateur. Cherche des mots-clés relatifs aux fonctionnalités de ThesisFlow360 (chapitre, tâche, idée, source, plan, etc.).
2.  **Sélection de l'Outil** : Choisis l'outil le plus approprié. Si la requête est vague, demande des clarifications. N'invente pas d'actions ou d'outils.
3.  **Extraction des Paramètres** : Extrais les informations nécessaires de la requête pour les passer en input à l'outil. Sois attentif aux détails (nom du chapitre, description de la tâche, type de source, etc.). Pour \`addTaskTool\` et les demandes de Pomodoro, formate le texte de la tâche comme "Démarrer Pomodoro pour : [activité]".
4.  **Exécution de l'Outil et Réponse** : Le système exécutera l'outil pour toi (en gérant le \`user_id\`). Tu recevras le résultat.
    * Formule une \`responseMessage\` claire et concise confirmant l'action et incluant les informations clés du résultat de l'outil (ex: "J'ai ajouté le chapitre nommé 'Revue de Littérature'." ou "Voici le plan de thèse que j'ai généré : \n\n[Plan de l'outil ici]").
    * Si l'outil a échoué (indiqué dans son résultat), explique l'échec à l'utilisateur.
    * Si aucun outil n'est approprié ou si la requête est trop ambiguë même après clarification, réponds poliment en expliquant tes limites.
5.  **Format de Sortie JSON** : Ta réponse FINALE DOIT être un objet JSON valide avec \`responseMessage\` (string) et optionnellement \`actionsTaken\` (array d'objets détaillant les appels aux outils).

**Exemples d'Interactions Attendues (le \`user_id\` est géré en arrière-plan) :**
* Utilisateur: "Ajoute un chapitre sur la discussion des résultats."
    * ThesisBot (réponse JSON attendue de ta part après que le système ait appelé l'outil pour toi) : \`{ "responseMessage": "Le chapitre 'Discussion des résultats' a été ajouté avec succès.", "actionsTaken": [{ "toolName": "addChapterTool", "input": {"name": "Discussion des résultats"}, "toolOutput": {"chapterId": "uuid-ici", "message": "Chapitre 'Discussion des résultats' ajouté avec succès.", "success": true} }] }\`
* Utilisateur: "Crée-moi un plan de thèse sur l'éthique de l'IA générative."
    * ThesisBot (réponse JSON attendue) : \`{ "responseMessage": "Voici un plan de thèse pour 'éthique de l'IA générative' :\\n\\n1. Introduction\\n   [... reste du plan généré par l'outil ...]", "actionsTaken": [{ "toolName": "createThesisPlanTool", "input": {"topicOrInstructions": "éthique de l'IA générative"}, "toolOutput": {"plan": "1. Introduction...", "message": "Plan de thèse généré...", "success": true} }] }\`

Requête actuelle de l'utilisateur :
{{{userRequest}}}
`,
});


// --- Flux Principal de l'Agent ---
const thesisAgentFlow = ai.defineFlow(
  {
    name: 'thesisAgentFlow',
    inputSchema: z.object({ // Le flux prendra le userId en plus de la requête
      userRequest: z.string(),
      userId: z.string(),
    }),
    outputSchema: ThesisAgentOutputSchema,
  },
  async (flowInput) => {
    const { userRequest, userId } = flowInput;
    console.log(`[ThesisAgentFlow] Début du flux pour userId: ${userId}, requête: "${userRequest}"`);

    let llmResponse = await thesisAgentMainPrompt({ userRequest }); // Premier appel à l'IA
    let finalResponseMessage = "";
    const actionsTakenDetails: NonNullable<ThesisAgentOutput['actionsTaken']> = [];

    // Gérer les appels d'outils si l'IA en demande
    if (llmResponse.toolRequests && llmResponse.toolRequests.length > 0) {
      const toolResponsesPromises = llmResponse.toolRequests.map(async (toolRequest) => {
        let toolOutput: any;
        console.log(`[ThesisAgentFlow] Appel de l'outil demandé par l'IA: ${toolRequest.toolName} avec input:`, toolRequest.input);

        // Appel manuel des fonctions logiques avec injection de userId
        // L'input ici est celui généré par le LLM, SANS userId.
        switch (toolRequest.toolName) {
          case 'addChapterTool':
            toolOutput = await addChapterToolLogic(toolRequest.input as z.infer<typeof AddChapterInputSchema>, userId);
            break;
          case 'addTaskTool':
            toolOutput = await addTaskToolLogic(toolRequest.input as z.infer<typeof AddTaskInputSchema>, userId);
            break;
          case 'addBrainDumpEntryTool':
            toolOutput = await addBrainDumpEntryToolLogic(toolRequest.input as z.infer<typeof AddBrainDumpEntryInputSchema>, userId);
            break;
          case 'addDailyObjectiveTool':
            toolOutput = await addDailyObjectiveToolLogic(toolRequest.input as z.infer<typeof AddDailyObjectiveInputSchema>, userId);
            break;
          case 'addSourceTool':
            toolOutput = await addSourceToolLogic(toolRequest.input as z.infer<typeof AddSourceInputSchema>, userId);
            break;
          case 'refinePromptTool':
            // Note: refinePromptToolLogic a besoin de userId pour logger, pas pour sa logique principale d'affinage.
            toolOutput = await refinePromptToolLogic(toolRequest.input as z.infer<typeof RefinePromptToolInputSchema>, userId);
            break;
          case 'createThesisPlanTool':
            // createThesisPlanToolLogic n'a pas besoin de userId pour sa logique principale
            toolOutput = await createThesisPlanToolLogic(toolRequest.input as z.infer<typeof CreateThesisPlanToolInputSchema>);
            break;
          default:
            console.warn(`[ThesisAgentFlow] Outil inconnu demandé: ${toolRequest.toolName}`);
            toolOutput = { message: `Outil ${toolRequest.toolName} non reconnu ou non géré manuellement.`, success: false };
        }
        
        actionsTakenDetails.push({
          toolName: toolRequest.toolName,
          toolInput: toolRequest.input, // Input original de l'IA
          toolOutput: toolOutput,
        });
        return ai.toolResponse(toolRequest.ref, toolOutput); // Construire la réponse de l'outil pour Genkit
      });

      const toolResponses = await Promise.all(toolResponsesPromises);

      // Deuxième appel au LLM avec les réponses des outils pour obtenir une réponse finale
      console.log("[ThesisAgentFlow] Envoi des résultats des outils au LLM pour réponse finale.");
      llmResponse = await thesisAgentMainPrompt({
        // userRequest, // Peut-être pas nécessaire, l'historique suffit
        history: [
          ai.userMessage(userRequest),
          llmResponse.candidates[0].message, // Premier message du LLM (qui incluait les toolRequests)
          ...toolResponses // Réponses des outils formatées par ai.toolResponse
        ],
      });
    }

    // Construire la réponse finale
    if (llmResponse.output?.responseMessage) {
        finalResponseMessage = llmResponse.output.responseMessage;
    } else if (actionsTakenDetails.length > 0) {
        // Fallback si le LLM ne fournit pas de message final après les outils
        const firstSuccessfulAction = actionsTakenDetails.find(a => a.toolOutput?.success);
        if (firstSuccessfulAction?.toolOutput?.plan && firstSuccessfulAction.toolName === 'createThesisPlanTool') {
             finalResponseMessage = `Voici le plan que j'ai généré pour vous :\n\n${firstSuccessfulAction.toolOutput.plan}`;
        } else if (firstSuccessfulAction?.toolOutput?.message) {
            finalResponseMessage = firstSuccessfulAction.toolOutput.message;
        } else {
            const firstAction = actionsTakenDetails[0];
            if (firstAction.toolOutput?.message) {
                finalResponseMessage = firstAction.toolOutput.message;
            } else {
                finalResponseMessage = "J'ai effectué les actions demandées.";
            }
        }
    } else {
        finalResponseMessage = llmResponse.text || "Je ne suis pas sûr de comprendre. Pouvez-vous reformuler ?";
    }
    
    console.log("[ThesisAgentFlow] Réponse finale construite:", finalResponseMessage);
    return {
      responseMessage: finalResponseMessage,
      actionsTaken: actionsTakenDetails.length > 0 ? actionsTakenDetails : (llmResponse.output?.actionsTaken || undefined),
    };
  }
);

// --- Fonction Principale Exportée (Server Action) ---
export async function processUserRequest(input: ThesisAgentInput): Promise<ThesisAgentOutput> {
  'use server';

  const cookieStore = cookies();
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { 
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
      }
    }
  );
  const { data: { session } } = await supabaseServer.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    console.warn("[processUserRequest] Tentative d'action sans utilisateur authentifié.");
    return { responseMessage: "Erreur d'authentification : Utilisateur non identifié. Veuillez vous connecter." };
  }

  console.log(`[processUserRequest] Requête de l'utilisateur: "${input.userRequest}" pour userId: ${userId}`);

  try {
    const result = await thesisAgentFlow({ userRequest: input.userRequest, userId });
    console.log("[processUserRequest] Réponse du flux de l'agent:", JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error("[processUserRequest] Erreur critique dans le flux de l'agent:", error);
    return { responseMessage: `Une erreur majeure est survenue lors du traitement de votre demande: ${error.message || 'Erreur inconnue du serveur'}` };
  }
}

    
