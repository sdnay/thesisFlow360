// modify-task-list.ts
'use server';

/**
 * @fileOverview Ce fichier définit un flux Genkit pour modifier une liste de tâches en fonction des instructions de l'utilisateur.
 *
 * - modifyTaskList - Une fonction qui prend les instructions de l'utilisateur et une liste de tâches, et retourne une liste de tâches modifiée.
 * - ModifyTaskListInput - Le type d'entrée pour la fonction modifyTaskList.
 * - ModifyTaskListOutput - Le type de retour pour la fonction modifyTaskList.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ModifyTaskListInputSchema = z.object({
  instructions: z
    .string()
    .describe("Instructions pour modifier la liste des tâches, ex : ajouter une tâche, marquer une tâche comme terminée, prioriser les tâches."),
  taskList: z.array(z.string()).describe("La liste des tâches actuelle."),
});

export type ModifyTaskListInput = z.infer<typeof ModifyTaskListInputSchema>;

const ModifyTaskListOutputSchema = z.object({
  modifiedTaskList: z.array(z.string()).describe("La liste des tâches modifiée."),
  reasoning: z.string().describe("Le raisonnement de l'agent IA pour les modifications apportées à la liste des tâches."),
});

export type ModifyTaskListOutput = z.infer<typeof ModifyTaskListOutputSchema>;

export async function modifyTaskList(input: ModifyTaskListInput): Promise<ModifyTaskListOutput> {
  return modifyTaskListFlow(input);
}

const modifyTaskListPrompt = ai.definePrompt({
  name: 'modifyTaskListPrompt',
  input: {schema: ModifyTaskListInputSchema},
  output: {schema: ModifyTaskListOutputSchema},
  prompt: `Vous êtes un agent IA responsable de la gestion de la liste de tâches d'un utilisateur.

  L'utilisateur fournira des instructions sur la manière de modifier la liste des tâches. Votre objectif est de modifier la liste des tâches conformément aux instructions de l'utilisateur et d'expliquer les modifications que vous avez apportées.

  Voici la liste de tâches actuelle :
  {{#each taskList}}
  - {{this}}
  {{/each}}

  Voici les instructions :
  {{instructions}}

  En fonction des instructions, générez une liste de tâches modifiée et expliquez votre raisonnement pour les modifications.
  Assurez-vous de retourner la liste de tâches modifiée dans le champ modifiedTaskList.
  Expliquez votre raisonnement dans le champ reasoning.
  Le type de la tâche dans la liste modifiée doit correspondre à l'une des valeurs suivantes : 'urgent', 'important', 'reading', 'chatgpt', 'secondary'.
  `,
});

const modifyTaskListFlow = ai.defineFlow(
  {
    name: 'modifyTaskListFlow',
    inputSchema: ModifyTaskListInputSchema,
    outputSchema: ModifyTaskListOutputSchema,
  },
  async input => {
    const {output} = await modifyTaskListPrompt(input);
    return output!;
  }
);
