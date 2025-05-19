
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
  try {
    const { data, error } = await supabase
      .from('chapters')
      .insert([{ name: input.name, user_id: userId, progress: 0, status: 'Non commencé', supervisor_comments: [] }])
      .select('id') // Seulement l'ID est nécessaire ici pour le retour
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
      .select('id')
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
      .select('id')
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
      .select('id')
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
      .select('id')
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
      // Récupérer l'historique des prompts depuis Supabase pour l'utilisateur
      const { data: logEntries, error: logError } = await supabase
        .from('prompt_log_entries')
        .select('original_prompt, refined_prompt')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (logError) console.warn("[ThesisAgent] Impossible de récupérer l'historique des prompts pour l'affinage:", logError.message);

      const historyPrompts = (logEntries || [])
        .map(p => p.refined_prompt || p.original_prompt)
        .filter(p => !!p && p.trim() !== '') as string[];

      const refineFlowInput: RefinePromptInput = {
        prompt: input.promptToRefine,
        promptHistory: historyPrompts,
      };

      const result: RefinePromptOutput = await refinePrompt(refineFlowInput);

      // Enregistrer le prompt affiné dans le journal
      const newLogEntryPayload = {
        original_prompt: input.promptToRefine,
        refined_prompt: result.refinedPrompt,
        reasoning: result.reasoning,
        tags: ['affinage_par_agent'],
        user_id: userId, // Assurer que user_id est inclus
      };
      const { error: insertError } = await supabase.from('prompt_log_entries').insert(newLogEntryPayload);
      if (insertError) {
          console.error("[ThesisAgent] Erreur lors de l'enregistrement du prompt affiné:", insertError);
          // Ne pas faire échouer toute l'opération juste pour un log, mais notifier.
          return { refinedPrompt: result.refinedPrompt, reasoning: result.reasoning, message: "Prompt affiné, mais erreur lors de la consignation.", success: true };
      }

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
// Ces schémas d'input NE contiennent PAS user_id.
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
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux."); } // La logique interne prendra userId
);
const createThesisPlanToolForAI = ai.defineTool(
  { name: 'createThesisPlanTool', description: 'Génère un plan de thèse ou de mémoire structuré. (Input: { topicOrInstructions: string }).', inputSchema: CreateThesisPlanToolInputSchema, outputSchema: CreateThesisPlanToolOutputSchema },
  async (input) => { throw new Error("Cet outil doit être appelé via la logique du flux."); }
);


// --- Schémas d'Entrée/Sortie pour l'Agent ---

// Ce que le CLIENT envoie à la Server Action processUserRequest
const ProcessUserRequestInputSchema = z.object({
  userRequest: z.string().describe("La requête de l'utilisateur en langage naturel."),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'agent']), // 'agent' pour ThesisBot dans l'historique client
    content: z.string(),
    // Les actions_taken sont pour l'affichage client, pas pour l'IA.
  })).nullable().optional().describe("L'historique des messages de la session de chat actuelle, formaté par le client."),
});
export type ThesisAgentInput = z.infer<typeof ProcessUserRequestInputSchema>;

// Ce que le FLUX thesisAgentFlow reçoit (après que processUserRequest ait ajouté userId, etc.)
const ThesisAgentFlowInputSchema = z.object({
  userRequest: z.string(),
  userId: z.string(),
  userNameForAgent: z.string().optional(),
  chatHistoryForLLM: z.array(z.object({ // Format attendu par Genkit pour l'historique
      role: z.enum(['user', 'model']), // 'model' pour le rôle de l'IA dans l'historique Genkit
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
  input: { schema: ThesisAgentPromptInputSchema }, // Utilise l'input préparé par le flux
  output: { schema: ThesisAgentOutputSchema },
  tools: [ // L'IA utilise ces définitions pour savoir quels outils sont disponibles et leur schéma d'input
    addChapterToolForAI,
    addBrainDumpEntryToolForAI,
    addDailyObjectiveToolForAI,
    addSourceToolForAI,
    addTaskToolForAI,
    refinePromptToolForAI,
    createThesisPlanToolForAI
  ],
  prompt: `Tu es ThesisBot, un assistant IA expert intégré à l'application ThesisFlow360. Ton rôle est d'aider les étudiants à organiser et à progresser dans la rédaction de leur thèse ou mémoire. Tu dois comprendre leurs requêtes en langage naturel (français) et utiliser les outils mis à ta disposition pour effectuer des actions concrètes dans l'application ou fournir des informations pertinentes. Toutes les actions de création de données (chapitres, tâches, etc.) doivent être associées à l'utilisateur qui fait la requête ; tu n'as pas besoin de demander son ID, il sera géré automatiquement par le système lors de l'exécution de l'outil.

**Informations sur l'Utilisateur Actuel :**
{{#if userNameForAgent}}Nom/Identifiant : {{{userNameForAgent}}}{{/if}}

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

0.  **Personnalisation** : Si le nom de l'utilisateur ({{{userNameForAgent}}}) est fourni, commence ta première réponse par une salutation personnalisée (ex: "Bonjour {{{userNameForAgent}}}, en quoi puis-je vous aider aujourd'hui ?"). Pour les réponses suivantes dans une conversation, une personnalisation n'est pas nécessaire à chaque fois.
1.  **Analyse la Requête** : Comprends l'intention principale de l'utilisateur. Cherche des mots-clés relatifs aux fonctionnalités de ThesisFlow360 (chapitre, tâche, idée, source, plan, etc.). Prends en compte l'historique de la conversation (si fourni et pertinent) pour mieux comprendre le contexte.
2.  **Sélection de l'Outil** : Choisis l'outil le plus approprié pour répondre à la requête.
    * Si la requête est vague (ex: "aide-moi avec mon intro"), demande des clarifications avant de choisir un outil (ex: "Que souhaites-tu faire avec ton introduction ? Créer un chapitre, ajouter une tâche, ou noter une idée ?").
    * Si l'utilisateur veut créer quelque chose, utilise l'outil "add" correspondant.
    * Si l'utilisateur veut de l'aide pour structurer son travail, comme un plan de thèse, utilise \`createThesisPlanTool\`.
    * Si l'utilisateur demande d'améliorer un prompt pour une autre IA, utilise \`refinePromptTool\`.
3.  **Extraction des Paramètres** : Extrais les informations nécessaires de la requête pour les passer en input à l'outil. Sois attentif aux détails (nom du chapitre, description de la tâche, type de source, etc.). N'inclus PAS de user_id, il sera géré par le système.
    * Pour \`addTaskTool\`, si l'utilisateur dit "chrono pour relire mon chapitre 2", le \`text\` de la tâche sera "Démarrer Pomodoro pour : relire le chapitre 2".
    * Pour \`addBrainDumpEntryTool\`, si le statut n'est pas spécifié, utilise "captured" par défaut.
    * Pour \`addSourceTool\`, si le type n'est pas clair, demande une clarification ou utilise "other" et suggère à l'utilisateur de le préciser plus tard.
4.  **Exécution de l'Outil et Réponse** :
    * Si l'outil est exécuté avec succès, formule une \`responseMessage\` claire et concise confirmant l'action et incluant les informations clés retournées par l'outil (ex: "J'ai ajouté le chapitre nommé 'Revue de Littérature'." ou "Voici le plan de thèse que j'ai généré : \n\n[Plan de l'outil ici]").
    * Si l'outil échoue, explique l'échec à l'utilisateur en te basant sur le message d'erreur de l'outil.
    * Si aucun outil n'est approprié ou si la requête est trop ambiguë, réponds poliment en demandant plus de précisions ou en expliquant tes limites actuelles.
5.  **Format de Sortie JSON** : Ta réponse FINALE DOIT être un objet JSON valide avec \`responseMessage\` (string) et optionnellement \`actionsTaken\` (array d'objets détaillant les appels aux outils).

**Exemples d'Interactions Attendues (le \`user_id\` est géré en arrière-plan) :**
* Utilisateur: "Ajoute un chapitre sur la discussion des résultats."
    * ThesisBot (réponse JSON) : \`{ "responseMessage": "Le chapitre 'Discussion des résultats' a été ajouté avec succès.", "actionsTaken": [{ "toolName": "addChapterTool", "input": {"name": "Discussion des résultats"}, "toolOutput": {"chapterId": "uuid-ici", "message": "Chapitre 'Discussion des résultats' ajouté avec succès.", "success": true} }] }\`
* Utilisateur: "Crée-moi un plan de thèse sur l'éthique de l'IA générative."
    * ThesisBot (réponse JSON) : \`{ "responseMessage": "Voici un plan de thèse pour 'éthique de l'IA générative' :\\n\\n1. Introduction\\n   [... reste du plan généré par l'outil ...]", "actionsTaken": [{ "toolName": "createThesisPlanTool", "input": {"topicOrInstructions": "éthique de l'IA générative"}, "toolOutput": {"plan": "1. Introduction...", "message": "Plan de thèse généré...", "success": true} }] }\`

Requête actuelle de l'utilisateur :
{{{userRequest}}}
`,
});


// --- Flux Principal de l'Agent ---
const thesisAgentFlow = ai.defineFlow(
  {
    name: 'thesisAgentFlow',
    inputSchema: ThesisAgentFlowInputSchema, // Utilise l'input enrichi par processUserRequest
    outputSchema: ThesisAgentOutputSchema,
  },
  async (flowInput) => {
    const { userRequest, userId, userNameForAgent, chatHistoryForLLM } = flowInput;
    console.log(`[ThesisAgentFlow] Début du flux pour userId: ${userId}, nom: ${userNameForAgent}, requête: "${userRequest}"`);
    if (chatHistoryForLLM && chatHistoryForLLM.length > 0) {
      console.log(`[ThesisAgentFlow] Historique de chat (format LLM) reçu: ${chatHistoryForLLM.length} messages`);
    }

    // Premier appel au LLM avec la requête utilisateur et l'historique formaté
    let llmResponse = await thesisAgentMainPrompt({ 
        userRequest, 
        userNameForAgent,
        history: chatHistoryForLLM // Passe l'historique formaté pour le LLM
    });

    const actionsTakenDetails: NonNullable<ThesisAgentOutput['actionsTaken']> = [];

    // Gérer les demandes d'outils
    if (llmResponse.toolRequests && llmResponse.toolRequests.length > 0) {
      console.log(`[ThesisAgentFlow] ${llmResponse.toolRequests.length} demande(s) d'outil(s) reçue(s) du LLM.`);
      const toolExecutionPromises = llmResponse.toolRequests.map(async (toolRequest) => {
        let toolLogicOutput: any;
        console.log(`[ThesisAgentFlow] Appel de l'outil demandé par l'IA: ${toolRequest.toolName} avec input:`, JSON.stringify(toolRequest.input, null, 2));

        // Appel manuel de la fonction logique de l'outil avec injection de userId
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
            toolLogicOutput = await refinePromptToolLogic(toolRequest.input as z.infer<typeof RefinePromptToolInputSchema>, userId); // userId est passé ici
            break;
          case 'createThesisPlanTool':
            toolLogicOutput = await createThesisPlanToolLogic(toolRequest.input as z.infer<typeof CreateThesisPlanToolInputSchema>);
            break;
          default:
            console.warn(`[ThesisAgentFlow] Outil inconnu demandé: ${toolRequest.toolName}`);
            toolLogicOutput = { message: `Outil ${toolRequest.toolName} non reconnu.`, success: false };
        }

        actionsTakenDetails.push({
          toolName: toolRequest.toolName,
          toolInput: toolRequest.input, // Ce que l'IA a demandé
          toolOutput: toolLogicOutput,  // Le résultat de notre fonction logique
        });
        // Fournir la réponse de l'outil à Genkit pour le prochain tour de LLM
        return ai.toolResponse(toolRequest.ref, toolLogicOutput);
      });

      const toolResponses = await Promise.all(toolExecutionPromises);

      console.log("[ThesisAgentFlow] Envoi des résultats des outils au LLM pour réponse finale.");
      // Deuxième appel au LLM, incluant l'historique original, la première réponse du LLM (qui contenait les toolRequests), et les réponses des outils
      llmResponse = await thesisAgentMainPrompt({
        userRequest, // Peut être utile de le repasser, ou se fier à l'historique
        userNameForAgent,
        history: [ // Construction de l'historique pour le deuxième appel
          ...(chatHistoryForLLM || []),
          ai.userMessage(userRequest),      // Requête initiale de l'utilisateur
          llmResponse.candidates[0].message, // La réponse du LLM qui a demandé les outils
          ...toolResponses                   // Les réponses des outils exécutés
        ],
      });
    }

    // Construction de la réponse finale à partir de la sortie du LLM (après exécution des outils si nécessaire)
    let finalResponseMessage = llmResponse.output?.responseMessage;

    if (!finalResponseMessage) {
        // Fallback si le LLM ne fournit pas de responseMessage explicite après les outils
        if (actionsTakenDetails.length > 0) {
            const firstSuccessfulAction = actionsTakenDetails.find(a => a.toolOutput?.success);
            if (firstSuccessfulAction) {
                if (firstSuccessfulAction.toolName === 'createThesisPlanTool' && firstSuccessfulAction.toolOutput?.plan) {
                    finalResponseMessage = `Voici le plan que j'ai généré pour vous :\n\n${firstSuccessfulAction.toolOutput.plan}`;
                } else if (firstSuccessfulAction.toolOutput?.message) {
                    finalResponseMessage = firstSuccessfulAction.toolOutput.message;
                } else {
                     finalResponseMessage = `L'action '${firstSuccessfulAction.toolName}' a été effectuée avec succès.`;
                }
            } else if (actionsTakenDetails.length > 0) { // Si au moins une action a été tentée mais a échoué
                finalResponseMessage = actionsTakenDetails[0].toolOutput?.message || "J'ai tenté d'effectuer une action mais j'ai rencontré un problème.";
            } else {
                 finalResponseMessage = "Je ne suis pas sûr de comprendre. Pouvez-vous reformuler ?";
            }
        } else if (llmResponse.text) { // Fallback au texte brut si aucune sortie structurée et aucune action
            finalResponseMessage = llmResponse.text;
        } else {
            finalResponseMessage = "Je ne suis pas sûr de comprendre. Pouvez-vous reformuler ?";
        }
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
  console.log(`[ThesisAgent ServerAction] Reçu input du client:`, JSON.stringify(input, null, 2));
  
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
  let userNameForAgent: string | undefined;

  if (session?.user) {
    userNameForAgent = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || session.user.email;
  }

  if (!userId) {
    console.warn("[ThesisAgent ServerAction] Tentative d'action sans utilisateur authentifié.");
    return { responseMessage: "Erreur d'authentification : Utilisateur non identifié. Veuillez vous connecter." };
  }

  console.log(`[ThesisAgent ServerAction] Requête de l'utilisateur: "${input.userRequest}" pour userId: ${userId}, nom pour agent: ${userNameForAgent}`);
  
  // Formatage de l'historique du chat client pour le format attendu par Genkit LLM
  const chatHistoryForLLM = input.chatHistory?.map(msg => ({
    role: msg.role === 'agent' ? 'model' : 'user', // 'agent' (de l'UI) devient 'model' pour le LLM
    parts: [{ text: msg.content }], // Assurer que content est bien une string
  })) as Array<{role: 'user' | 'model'; parts: {text: string}[]}> | undefined;
  
  console.log('[ThesisAgent ServerAction] Historique formaté pour LLM:', JSON.stringify(chatHistoryForLLM, null, 2));

  try {
    const result = await thesisAgentFlow({ 
      userRequest: input.userRequest, 
      userId, 
      userNameForAgent,
      chatHistoryForLLM // Transmettre l'historique formaté au flux
    });
    console.log("[ThesisAgent ServerAction] Réponse du flux de l'agent:", JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error("[ThesisAgent ServerAction] Erreur critique dans le flux de l'agent:", error);
    // Transmettre l'erreur au client de manière plus structurée
    if (error.name === 'GenkitError' && error.details?.parseErrors) {
        return { responseMessage: `Une erreur majeure est survenue lors du traitement de votre demande: ${error.message}. Détails de validation: ${JSON.stringify(error.details.parseErrors)}`};
    }
    return { responseMessage: `Une erreur majeure est survenue lors du traitement de votre demande: ${error.message || 'Erreur inconnue du serveur'}` };
  }
}

    