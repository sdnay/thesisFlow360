'use server';

/**
 * @fileOverview This flow refines prompts based on past effective prompts and reformulations.
 *
 * - refinePrompt - A function that suggests refinements to a given prompt based on a history of effective prompts.
 * - RefinePromptInput - The input type for the refinePrompt function.
 * - RefinePromptOutput - The return type for the refinePrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefinePromptInputSchema = z.object({
  prompt: z.string().describe('The prompt to be refined.'),
  promptHistory: z
    .array(z.string())
    .describe('A history of effective prompts and reformulations.'),
});
export type RefinePromptInput = z.infer<typeof RefinePromptInputSchema>;

const RefinePromptOutputSchema = z.object({
  refinedPrompt: z
    .string()
    .describe('The refined prompt, incorporating insights from past effective prompts.'),
  reasoning: z
    .string()
    .describe('Explanation of why the prompt was refined in this way.'),
});
export type RefinePromptOutput = z.infer<typeof RefinePromptOutputSchema>;

export async function refinePrompt(input: RefinePromptInput): Promise<RefinePromptOutput> {
  return refinePromptFlow(input);
}

const refinePromptPrompt = ai.definePrompt({
  name: 'refinePromptPrompt',
  input: {schema: RefinePromptInputSchema},
  output: {schema: RefinePromptOutputSchema},
  prompt: `You are an AI prompt optimizer. Given the current prompt and a history of effective prompts, suggest refinements to the current prompt to improve its effectiveness.\n\nCurrent Prompt: {{{prompt}}}\n\nEffective Prompt History:\n{{#each promptHistory}}- {{{this}}}\n{{/each}}\n\nRefined Prompt:`, // Handlebars syntax is correct here
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
