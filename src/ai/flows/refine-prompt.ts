'use server';

/**
 * @fileOverview Ce flux affine les prompts en fonction des prompts efficaces passés et de leurs reformulations.
 *
 * - refinePrompt - Une fonction qui suggère des améliorations à un prompt donné en fonction d'un historique de prompts efficaces.
 * - RefinePromptInput - Le type d'entrée pour la fonction refinePrompt.
 * - RefinePromptOutput - Le type de retour pour la fonction refinePrompt.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefinePromptInputSchema = z.object({
  prompt: z.string().describe('Le prompt à affiner.'),
  promptHistory: z
    .array(z.string())
    .describe("Un historique des prompts efficaces et de leurs reformulations."),
});
export type RefinePromptInput = z.infer<typeof RefinePromptInputSchema>;

const RefinePromptOutputSchema = z.object({
  refinedPrompt: z
    .string()
    .describe("Le prompt affiné, intégrant les enseignements des prompts efficaces passés."),
  reasoning: z
    .string()
    .describe("Explication de la raison pour laquelle le prompt a été affiné de cette manière."),
});
export type RefinePromptOutput = z.infer<typeof RefinePromptOutputSchema>;

export async function refinePrompt(input: RefinePromptInput): Promise<RefinePromptOutput> {
  return refinePromptFlow(input);
}

const refinePromptPrompt = ai.definePrompt({
  name: 'refinePromptPrompt',
  input: {schema: RefinePromptInputSchema},
  output: {schema: RefinePromptOutputSchema},
  prompt: `Vous êtes un optimiseur de prompts IA. Étant donné le prompt actuel et un historique de prompts efficaces, suggérez des améliorations au prompt actuel pour améliorer son efficacité.\n\nPrompt Actuel : {{{prompt}}}\n\nHistorique des Prompts Efficaces :\n{{#each promptHistory}}- {{{this}}}\n{{/each}}\n\nPrompt Affiné :`, 
});

const refinePromptFlow = ai.defineFlow(
  {
    name: 'refinePromptFlow',
    inputSchema: RefinePromptInputSchema,
    outputSchema: RefinePromptOutputSchema,
  },
  async input => {
    const {output} = await refinePromptPrompt(input);
    return output!;
  }
);
