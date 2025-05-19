
'use server';
/**
 * @fileOverview Un agent IA capable de gérer divers aspects du flux de travail d'une thèse
 * et d'interagir avec les différentes sections de l'application ThesisFlow360.
 *
 * - processUserRequest - Fonction principale (Server Action) pour traiter les requêtes de l'utilisateur.
 * - ThesisAgentInput - Type d'entrée pour processUserRequest (ce qui vient du client).
 * - ThesisAgentOutput - Type de sortie pour processUserRequest.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { supabase } from '@/lib/supabaseClient'; // Utilisé pour les fonctions logiques des outils

// Import des flux et types nécessaires
import { refinePrompt, type RefinePromptInput, type RefinePromptOutput } from '@/ai/flows/refine-prompt';
import { generateThesisPlan, type GenerateThesisPlanInput, type GenerateThesisPlanOutput } from '@/ai/flows/generate-thesis-plan-flow';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// --- Schémas d'Input/Output pour les OUTILS (ce que l'IA voit et génère pour les arguments) ---
// Ces schémas NE CONTIENNENT PAS user_id.
const AddChapterInputSchema = z.object({
  name: z.string().describe("Le nom du chapitre à ajouter."),
});
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


// --- Fonctions Logiques des Outils (prennent l'input de l'IA ET userId) ---
async function addChapterToolLogic(input: z.infer<typeof AddChapterInputSchema>, userId: string): Promise<z.infer<typeof AddChapterOutputSchema>> {
  console.log(`[ThesisAgentToolLogic] addChapterToolLogic - Input:`, input, `UserId: ${userId}`);
  try {
    const { data, error } = await supabase
      .from('chapters')
      .insert([{ name: input.name, user_id: userId, progress: 0, status: 'Non commencé', supervisor_comments: [] }])
      .select('id')
      .single();
    if (error) throw error;
    return { chapterId: data.id, message: `Chapitre "${input.name}" ajouté avec succès.`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgentToolLogic] Erreur addChapterToolLogic:", e.message);
    return { message: `Erreur lors de l'ajout du chapitre: ${e.message}`, success: false };
  }
}

async function addBrainDumpEntryToolLogic(input: z.infer<typeof AddBrainDumpEntryInputSchema>, userId: string): Promise<z.infer<typeof AddBrainDumpEntryOutputSchema>> {
  console.log(`[ThesisAgentToolLogic] addBrainDumpEntryToolLogic - Input:`, input, `UserId: ${userId}`);
  try {
    const { data, error } = await supabase
      .from('brain_dump_entries')
      .insert([{ text: input.text, status: input.status || 'captured', user_id: userId, chapter_id: null }]) // Assurez-vous que chapter_id est géré
      .select('id')
      .single();
    if (error) throw error;
    return { entryId: data.id, message: `Note ajoutée au vide-cerveau: "${input.text.substring(0,30)}...".`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgentToolLogic] Erreur addBrainDumpEntryToolLogic:", e.message);
    return { message: `Erreur lors de l'ajout au vide-cerveau: ${e.message}`, success: false };
  }
}

async function addDailyObjectiveToolLogic(input: z.infer<typeof AddDailyObjectiveInputSchema>, userId: string): Promise<z.infer<typeof AddDailyObjectiveOutputSchema>> {
  console.log(`[ThesisAgentToolLogic] addDailyObjectiveToolLogic - Input:`, input, `UserId: ${userId}`);
  try {
    const { data, error } = await supabase
      .from('daily_objectives')
      .insert([{ text: input.text, completed: false, user_id: userId, objective_date: new Date().toISOString().split('T')[0] , chapter_id: null}]) // Assurez-vous que chapter_id est géré
      .select('id')
      .single();
    if (error) throw error;
    return { objectiveId: data.id, message: `Objectif du jour ajouté: "${input.text}".`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgentToolLogic] Erreur addDailyObjectiveToolLogic:", e.message);
    return { message: `Erreur lors de l'ajout de l'objectif du jour: ${e.message}`, success: false };
  }
}

async function addSourceToolLogic(input: z.infer<typeof AddSourceInputSchema>, userId: string): Promise<z.infer<typeof AddSourceOutputSchema>> {
  console.log(`[ThesisAgentToolLogic] addSourceToolLogic - Input:`, input, `UserId: ${userId}`);
  try {
    const { data, error } = await supabase
      .from('sources')
      .insert([{ title: input.title, type: input.type, source_link_or_path: input.source_link_or_path, notes: input.notes, user_id: userId }])
      .select('id')
      .single();
    if (error) throw error;
    return { sourceId: data.id, message: `Source "${input.title}" ajoutée à la bibliothèque.`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgentToolLogic] Erreur addSourceToolLogic:", e.message);
    return { message: `Erreur lors de l'ajout de la source: ${e.message}`, success: false };
  }
}

async function addTaskToolLogic(input: z.infer<typeof AddTaskInputSchema>, userId: string): Promise<z.infer<typeof AddTaskOutputSchema>> {
  console.log(`[ThesisAgentToolLogic] addTaskToolLogic - Input:`, input, `UserId: ${userId}`);
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ text: input.text, type: input.type || 'secondary', completed: false, user_id: userId, chapter_id: null }]) // Assurez-vous que chapter_id est géré
      .select('id')
      .single();
    if (error) throw error;
    return { taskId: data.id, message: `Tâche ajoutée : "${input.text}".`, success: true };
  } catch (e: any) {
    console.error("[ThesisAgentToolLogic] Erreur addTaskToolLogic:", e.message);
    return { message: `Erreur lors de l'ajout de la tâche: ${e.message}`, success: false };
  }
}

async function refinePromptToolLogic(input: z.infer<typeof RefinePromptToolInputSchema>, userId: string): Promise<z.infer<typeof RefinePromptToolOutputSchema>> {
    console.log(`[ThesisAgentToolLogic] refinePromptToolLogic - Input:`, input, `UserId: ${userId}`);
    try {
      const { data: logEntries, error: logError } = await supabase
        .from('prompt_log_entries')
        .select('original_prompt, refined_prompt')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (logError) console.warn("[ThesisAgentToolLogic] Impossible de récupérer l'historique des prompts pour l'affinage:", logError.message);

      const historyPrompts = (logEntries || [])
        .map(p => p.refined_prompt || p.original_prompt)
        .filter(p => !!p && p.trim() !== '') as string[];

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
      if (insertError) {
          console.error("[ThesisAgentToolLogic] Erreur lors de l'enregistrement du prompt affiné:", insertError);
          return { refinedPrompt: result.refinedPrompt, reasoning: result.reasoning, message: "Prompt affiné, mais erreur lors de la consignation.", success: true };
      }

      return { refinedPrompt: result.refinedPrompt, reasoning: result.reasoning, message: "Prompt affiné et consigné avec succès.", success: true };
    } catch (e: any) {
      console.error("[ThesisAgentToolLogic] Erreur refinePromptToolLogic:", e.message);
      return { refinedPrompt: input.promptToRefine, reasoning: "", message: `Erreur lors de l'affinage du prompt: ${e.message}`, success: false };
    }
}

async function createThesisPlanToolLogic(input: z.infer<typeof CreateThesisPlanToolInputSchema>): Promise<z.infer<typeof CreateThesisPlanToolOutputSchema>> {
    console.log(`[ThesisAgentToolLogic] createThesisPlanToolLogic - Input:`, input);
    try {
      const result: GenerateThesisPlanOutput = await generateThesisPlan({ topicOrInstructions: input.topicOrInstructions });
      if (result.plan) {
        return { plan: result.plan, message: `Plan de thèse généré pour "${input.topicOrInstructions.substring(0, 50)}...".`, success: true };
      } else {
        return { plan: "", message: "La génération du plan n'a pas retourné de contenu.", success: false };
      }
    } catch (e: any) {
      console.error("[ThesisAgentToolLogic] Erreur createThesisPlanToolLogic:", e.message);
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
  { name: 'addTaskTool', description: "Ajoute une tâche. Si l'utilisateur mentionne \"chrono\" ou \"pomodoro\", le texte de la tâche doit être \"Démarrer Pomodoro pour : [description]\". (Input: { text: string, type?: \"urgent\"|\"important\"|\"reading\"|\"chatgpt\"|\"secondary\" }). Le user_id sera automatiquement lié.", inputSchema: AddTaskInputSchema, outputSchema: AddTaskOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux avec userId."); }
);
const refinePromptToolForAI = ai.defineTool(
  { name: 'refinePromptTool', description: "Améliore un prompt fourni par l'utilisateur. (Input: { promptToRefine: string }). Cette action enregistre également le prompt original et affiné.", inputSchema: RefinePromptToolInputSchema, outputSchema: RefinePromptToolOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux."); }
);
const createThesisPlanToolForAI = ai.defineTool(
  { name: 'createThesisPlanTool', description: 'Génère un plan de thèse ou de mémoire structuré. (Input: { topicOrInstructions: string }).', inputSchema: CreateThesisPlanToolInputSchema, outputSchema: CreateThesisPlanToolOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux."); }
);


// --- Schémas d'Entrée/Sortie pour l'Agent ---

// Ce que le CLIENT envoie à la Server Action processUserRequest
const ProcessUserRequestInputSchema = z.object({
  userRequest: z.string().describe("La requête de l'utilisateur en langage naturel."),
  chatHistory: z.array(z.object({ // Doit correspondre à ce que le client envoie
    role: z.enum(['user', 'agent']), // 'agent' pour ThesisBot dans l'historique client
    content: z.string(), // Simplement 'content' ici, sera transformé en 'parts' sur le serveur
  })).nullable().optional().describe("L'historique des messages de la session de chat actuelle, envoyé par le client."),
});
export type ThesisAgentInput = z.infer<typeof ProcessUserRequestInputSchema>;


// Ce que le FLUX thesisAgentFlow reçoit (après que processUserRequest ait ajouté userId, userNameForAgent etc.)
const ThesisAgentFlowInputSchema = z.object({
  userRequest: z.string(),
  userId: z.string(),
  userNameForAgent: z.string().optional(),
  chatHistoryForLLM: z.array(z.object({ // Format attendu par Genkit pour l'historique
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() }))
  })).optional(),
});

// Ce que le PROMPT thesisAgentMainPrompt reçoit
const ThesisAgentPromptInputSchema = z.object({
  userRequest: z.string().describe("La requête de l'utilisateur en langage naturel."),
  userNameForAgent: z.string().optional().describe("Nom/Identifiant de l'utilisateur pour personnaliser la salutation."),
  history: z.array(z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() }))
  })).optional(),
});

// Ce que le FLUX et le PROMPT retournent (et donc processUserRequest)
const ThesisAgentOutputSchema = z.object({
  responseMessage: z.string().describe("La réponse de l'agent IA à l'utilisateur."),
  actionsTaken: z.array(
    z.object({
      toolName: z.string(),
      toolInput: z.any().describe("L'input fourni à l'outil par l'IA."),
      toolOutput: z.any().describe("Le résultat retourné par l'outil."),
    })
  ).optional().describe("Détails des outils utilisés et leurs sorties, le cas échéant."),
});
export type ThesisAgentOutput = z.infer<typeof ThesisAgentOutputSchema>;


// --- Prompt Principal de l'Agent ---
const thesisAgentMainPrompt = ai.definePrompt({
  name: 'thesisAgentMainPrompt',
  input: { schema: ThesisAgentPromptInputSchema }, // Utilise le schéma avec userNameForAgent et history formaté
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
  prompt: `Tu es ThesisBot, un assistant IA expert intégré à l'application ThesisFlow360. Ton rôle est d'aider les étudiants à organiser et à progresser dans la rédaction de leur thèse ou mémoire. Tu dois comprendre leurs requêtes en langage naturel (français) et utiliser les outils mis à ta disposition pour effectuer des actions concrètes dans l'application ou fournir des informations pertinentes. Toutes les actions de création de données (chapitres, tâches, etc.) seront automatiquement associées à l'utilisateur qui fait la requête via le système ; tu n'as pas besoin de demander son ID ou de le manipuler.

**Informations sur l'Utilisateur Actuel (Si fournies au prompt) :**
{{#if userNameForAgent}}Nom/Identifiant : {{{userNameForAgent}}}{{else}}Utilisateur{{/if}}

**Contexte de l'Application ThesisFlow360 :**
L'application permet de gérer : Chapitres, Tâches (urgent, important, lecture, etc.), Objectifs Journaliers, Vide-Cerveau (notes, idées), Sources bibliographiques, Sessions Pomodoro, Prompts IA.

**Tes Capacités (Outils Disponibles) :**
* \`addChapterTool\`: Ajoute un nouveau chapitre. (Input: \`{ name: string }\`). Si l'utilisateur dit 'ajoute chapitre X' où X est un numéro, considère 'chapitre X' comme le nom littéral.
* \`addBrainDumpEntryTool\`: Ajoute une note au vide-cerveau. (Input: \`{ text: string, status?: "captured"|"task"|"idea" }\`). Statut par défaut: "captured".
* \`addDailyObjectiveTool\`: Ajoute un objectif au plan du jour. (Input: \`{ text: string }\`).
* \`addSourceTool\`: Enregistre une nouvelle source. (Input: \`{ title: string, type: "pdf"|"website"|"interview"|"field_notes"|"other", source_link_or_path?: string, notes?: string }\`). Si type non clair, demande ou utilise "other".
* \`addTaskTool\`: Ajoute une tâche. Si l'utilisateur mentionne "chrono" ou "pomodoro", le texte de la tâche doit être "Démarrer Pomodoro pour : [description]". (Input: \`{ text: string, type?: "urgent"|"important"|"reading"|"chatgpt"|"secondary" }\`). Type par défaut: "secondary".
* \`refinePromptTool\`: Améliore un prompt fourni. (Input: \`{ promptToRefine: string }\`).
* \`createThesisPlanTool\`: Utilise cet outil pour **générer un nouveau plan de thèse** basé sur un sujet ou des instructions, OU pour **aider à structurer ou reformater un plan existant fourni par l'utilisateur**. (Input: \`{ topicOrInstructions: string }`).
    * **Note Spéciale pour \`createThesisPlanTool\`** : Si cet outil est utilisé, ta \`responseMessage\` principale DOIT être le plan généré/traité ou un message confirmant le traitement du plan fourni.

**Instructions Générales pour Interagir :**
0.  **Personnalisation**: Si {{{userNameForAgent}}} est disponible, utilise-le pour une salutation personnalisée lors de la première réponse. Exemple: "Bonjour {{{userNameForAgent}}}, comment puis-je vous aider ?"
1.  **Analyse la Requête** : Comprends l'intention. Cherche des mots-clés. Prends en compte l'historique de la conversation (fourni dans \`history\`).
2.  **Sélection de l'Outil** : Choisis l'outil approprié. Si vague, demande des clarifications (ex: "Que souhaites-tu faire avec ton introduction ?").
3.  **Extraction des Paramètres** : Extrais les infos pour l'input de l'outil. N'invente PAS de \`user_id\`.
4.  **Exécution de l'Outil et Réponse** : Si un outil est appelé, le système l'exécutera. Ta tâche sera de formuler une \`responseMessage\` basée sur le résultat de l'outil. Si l'outil a réussi, confirme l'action (ex: "Chapitre 'X' ajouté."). Si l'outil échoue, explique l'échec en te basant sur le message d'erreur de l'outil.
5.  **Interaction Conversationnelle** : Si aucun outil n'est directement applicable ou si plus d'informations sont nécessaires, pose une question pertinente à l'utilisateur.
6.  **Gestion des Plans Fournis par l'Utilisateur** : Si l'utilisateur fournit un plan de thèse complet, ne te contente pas de l'ignorer. Propose d'utiliser \`createThesisPlanTool\` pour le "traiter" ou le "structurer", ou suggère d'ajouter les chapitres individuellement avec \`addChapterTool\`, ou de sauvegarder le texte brut dans le vide-cerveau avec \`addBrainDumpEntryTool\`. Demande clairement à l'utilisateur ce qu'il souhaite faire avec le plan fourni.
7.  **Confirmation et Exécution d'Actions** : Si TU proposes une action spécifique (surtout si elle implique un outil) et que l'utilisateur répond affirmativement (ex: "oui", "ok", "d'accord", "vasy", etc.), TU DOIS ensuite initier l'appel à l'outil correspondant avec les informations contextuelles. Ne reviens pas à une question générale si l'utilisateur vient de confirmer une action que tu as suggérée. Par exemple, si tu demandes "Souhaitez-vous que je crée ce chapitre ?" et que l'utilisateur dit "oui", appelle \`addChapterTool\`. Si tu demandes "Souhaitez-vous que je traite/structure ce plan ?" et qu'il dit "oui", appelle \`createThesisPlanTool\` avec le plan.
8.  **Si Confus** : Si tu es perdu ou si l'utilisateur semble frustré par tes réponses, réponds par : "Je suis désolé, je crois que je me suis un peu perdu. Pourriez-vous s'il vous plaît reformuler votre dernière demande clairement ?" et N'appelle PAS d'outil.

**RAPPEL CRUCIAL SUR LE FORMAT DE SORTIE JSON :**
Ta réponse FINALE DOIT TOUJOURS être un objet JSON valide avec au minimum la clé \`responseMessage\` (string). Si des outils sont appelés par toi et exécutés par le système, le système te fournira leurs résultats pour que tu formules ta \`responseMessage\` finale. N'inclus \`actionsTaken\` que si le système le requiert explicitement pour le formatage de ta réponse (ce qui n'est pas le cas ici, concentre-toi sur \`responseMessage\` après que les outils aient été appelés par le système). Si tu ne sais pas quoi faire ou si aucun outil n'est approprié, retourne un JSON comme \`{ "responseMessage": "Je ne suis pas sûr de comment vous aider avec cela. Pouvez-vous préciser ?" }\`.

Historique de la conversation (si disponible) :
{{#if history}}
{{#each history}}
{{#if (eq role "user")}}Utilisateur : {{parts.0.text}}{{/if}}
{{#if (eq role "model")}}ThesisBot : {{parts.0.text}}{{/if}}
{{/each}}
{{/if}}

Requête actuelle de l'utilisateur :
{{{userRequest}}}
`,
});


// --- Flux Principal de l'Agent ---
const thesisAgentFlow = ai.defineFlow(
  {
    name: 'thesisAgentFlow',
    inputSchema: ThesisAgentFlowInputSchema,
    outputSchema: ThesisAgentOutputSchema,
  },
  async (flowInput) => {
    const { userRequest, userId, userNameForAgent, chatHistoryForLLM } = flowInput;
    console.log(`[ThesisAgentFlow - Flow Start] UserRequest: "${userRequest}", UserId: ${userId}, UserName: ${userNameForAgent}`);
    if (chatHistoryForLLM) {
      console.log(`[ThesisAgentFlow - Flow Start] ChatHistoryForLLM:`, JSON.stringify(chatHistoryForLLM, null, 2));
    }

    // Premier appel au LLM avec la requête utilisateur et l'historique formaté
    let llmResponse = await thesisAgentMainPrompt({
        userRequest,
        userNameForAgent,
        history: chatHistoryForLLM,
    });
    console.log(`[ThesisAgentFlow] Réponse initiale du LLM (avant exécution outils):`, JSON.stringify(llmResponse.candidates[0], null, 2));

    const actionsTakenDetails: NonNullable<ThesisAgentOutput['actionsTaken']> = [];

    // Gérer les demandes d'outils si présentes
    if (llmResponse.toolRequests && llmResponse.toolRequests.length > 0) {
      console.log(`[ThesisAgentFlow] ${llmResponse.toolRequests.length} demande(s) d'outil(s) reçue(s) du LLM.`);
      const toolExecutionPromises = llmResponse.toolRequests.map(async (toolRequest) => {
        let toolLogicOutput: any;
        console.log(`[ThesisAgentFlow] Appel de l'outil demandé par l'IA: ${toolRequest.toolName} avec input:`, JSON.stringify(toolRequest.input, null, 2));

        switch (toolRequest.toolName) {
          case 'addChapterTool':
            toolLogicOutput = await addChapterToolLogic(toolRequest.input as z.infer<typeof AddChapterInputSchema>, userId);
            break;
          case 'addTaskTool':
            toolLogicOutput = await addTaskToolLogic(toolRequest.input as z.infer<typeof AddTaskInputSchema>, userId);
            break;
          case 'addBrainDumpEntryTool':
            toolLogicOutput = await addBrainDumpEntryToolLogic(toolRequest.input as z.infer<typeof AddBrainDumpEntryInputSchema>, userId);
            break;
          case 'addDailyObjectiveTool':
            toolLogicOutput = await addDailyObjectiveToolLogic(toolRequest.input as z.infer<typeof AddDailyObjectiveInputSchema>, userId);
            break;
          case 'addSourceTool':
            toolLogicOutput = await addSourceToolLogic(toolRequest.input as z.infer<typeof AddSourceInputSchema>, userId);
            break;
          case 'refinePromptTool':
            toolLogicOutput = await refinePromptToolLogic(toolRequest.input as z.infer<typeof RefinePromptToolInputSchema>, userId);
            break;
          case 'createThesisPlanTool':
            toolLogicOutput = await createThesisPlanToolLogic(toolRequest.input as z.infer<typeof CreateThesisPlanToolInputSchema>);
            break;
          default:
            console.warn(`[ThesisAgentFlow] Outil inconnu demandé: ${toolRequest.toolName}`);
            toolLogicOutput = { message: `Outil ${toolRequest.toolName} non reconnu.`, success: false };
        }
        console.log(`[ThesisAgentFlow] Résultat de l'outil ${toolRequest.toolName}:`, toolLogicOutput);
        actionsTakenDetails.push({
          toolName: toolRequest.toolName,
          toolInput: toolRequest.input,
          toolOutput: toolLogicOutput,
        });
        return ai.toolResponse(toolRequest.ref, toolLogicOutput);
      });

      const toolResponses = await Promise.all(toolExecutionPromises);

      console.log("[ThesisAgentFlow] Envoi des résultats des outils au LLM pour réponse finale. ToolResponses:", JSON.stringify(toolResponses, null, 2));
      llmResponse = await thesisAgentMainPrompt({
        userRequest, // Peut être utile de le repasser, ou se fier à l'historique
        userNameForAgent,
        history: [ // Construction de l'historique pour le 2eme appel
          ...(chatHistoryForLLM || []),
          { role: 'user', parts: [{ text: userRequest }] }, // Message original de l'utilisateur
          llmResponse.candidates[0].message, // Le message du LLM qui a demandé les outils
          ...toolResponses // Les réponses des outils
        ],
      });
      console.log(`[ThesisAgentFlow] Réponse finale du LLM (après exécution outils):`, JSON.stringify(llmResponse.candidates[0], null, 2));
    }

    let finalResponseMessage: string;
    const llmOutput = llmResponse.output;

    if (!llmOutput || typeof llmOutput.responseMessage !== 'string' || llmOutput.responseMessage.trim() === "") {
      console.warn("[ThesisAgentFlow] Sortie LLM invalide ou responseMessage vide. Tentative de fallback. LLM Output:", llmOutput);
      if (actionsTakenDetails.length > 0) {
        const lastAction = actionsTakenDetails[actionsTakenDetails.length - 1];
        if (lastAction.toolName === 'createThesisPlanTool' && lastAction.toolOutput?.success && lastAction.toolOutput?.plan) {
          finalResponseMessage = `Voici le plan que j'ai traité/généré pour vous :\n\n${lastAction.toolOutput.plan}`;
        } else if (lastAction.toolOutput?.message) {
          finalResponseMessage = lastAction.toolOutput.message;
        } else {
          finalResponseMessage = `L'action '${lastAction.toolName}' a été effectuée.`;
        }
      } else {
        finalResponseMessage = "Je suis désolé, je n'ai pas pu traiter votre demande. Pourriez-vous essayer de reformuler ?";
      }
      console.warn(`[ThesisAgentFlow] Fallback responseMessage: "${finalResponseMessage}"`);
    } else {
      finalResponseMessage = llmOutput.responseMessage;
    }
    
    console.log("[ThesisAgentFlow] Réponse finale construite:", finalResponseMessage);
    return {
      responseMessage: finalResponseMessage,
      actionsTaken: actionsTakenDetails.length > 0 ? actionsTakenDetails : undefined,
    };
  }
);


// --- Fonction Principale Exportée (Server Action) ---
export async function processUserRequest(clientInput: ThesisAgentInput): Promise<ThesisAgentOutput> {
  'use server';
  console.log('[ThesisAgentFlow - processUserRequest] Received client input:', JSON.stringify(clientInput, null, 2));
  
  const cookieStore = cookies();
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error('[ThesisAgentFlow - processUserRequest] Error setting cookie:', error); }
        },
        remove: (name: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error('[ThesisAgentFlow - processUserRequest] Error removing cookie:', error); }
        },
      }
    }
  );
  const { data: { session } } = await supabaseServer.auth.getSession();
  const userId = session?.user?.id;
  let userNameForAgent: string | undefined;

  if (session?.user) {
    userNameForAgent = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || session.user.email;
  }

  if (!userId) {
    console.warn("[ThesisAgentFlow - processUserRequest] Utilisateur non authentifié.");
    return { responseMessage: "Erreur d'authentification : Utilisateur non identifié. Veuillez vous connecter." };
  }

  console.log(`[ThesisAgentFlow - processUserRequest] Processing for userId: ${userId}, userNameForAgent: ${userNameForAgent}`);
  
  // Transform clientInput.chatHistory (from client) to chatHistoryForLLM (Genkit format)
  const chatHistoryForLLM = clientInput.chatHistory?.map(msg => {
    const textContent = msg.content || ""; 
    console.log(`[ThesisAgentFlow - processUserRequest] Mapping client msg to LLM history. Role: ${msg.role}, Original client content: "${msg.content}", Text for LLM part: "${textContent}"`);
    return {
      role: msg.role === 'agent' ? 'model' : 'user',
      parts: [{ text: textContent }],
    };
  }).filter(
    entry => entry.parts && entry.parts.length > 0 && typeof entry.parts[0].text === 'string'
  ) as Array<{role: 'user' | 'model'; parts: {text: string}[]}> | undefined;

  console.log('[ThesisAgentFlow - processUserRequest] chatHistoryForLLM (format LLM) préparé pour le flux:', JSON.stringify(chatHistoryForLLM, null, 2));

  try {
    const result = await thesisAgentFlow({ 
      userRequest: clientInput.userRequest, 
      userId, 
      userNameForAgent,
      chatHistoryForLLM
    });
    // S'assurer que le résultat du flux est valide avant de le retourner
    if (!result || typeof result.responseMessage !== 'string') {
        console.error("[ThesisAgentFlow - processUserRequest] Le flux thesisAgentFlow a retourné un résultat invalide:", result);
        return { responseMessage: "L'agent IA a rencontré une difficulté interne. Veuillez réessayer." };
    }
    console.log("[ThesisAgentFlow - processUserRequest] Réponse du flux de l'agent:", JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error("[ThesisAgentFlow - processUserRequest] Erreur critique dans le flux de l'agent:", error);
    let errorMessage = "Une erreur majeure est survenue lors du traitement de votre demande.";
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    if (error.name === 'GenkitError' && error.details?.parseErrors) {
        errorMessage += `. Détails de validation: ${JSON.stringify(error.details.parseErrors)}`;
    }
    return { responseMessage: errorMessage };
  }
}

