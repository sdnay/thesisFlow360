// modify-task-list.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for modifying a task list based on user instructions.
 *
 * - modifyTaskList - A function that takes user instructions and a task list, and returns a modified task list.
 * - ModifyTaskListInput - The input type for the modifyTaskList function.
 * - ModifyTaskListOutput - The return type for the modifyTaskList function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ModifyTaskListInputSchema = z.object({
  instructions: z
    .string()
    .describe('Instructions for modifying the task list, e.g., add a task, mark a task as complete, prioritize tasks.'),
  taskList: z.array(z.string()).describe('The current task list.'),
});

export type ModifyTaskListInput = z.infer<typeof ModifyTaskListInputSchema>;

const ModifyTaskListOutputSchema = z.object({
  modifiedTaskList: z.array(z.string()).describe('The modified task list.'),
  reasoning: z.string().describe('The AI agent\'s reasoning for the changes made to the task list.'),
});

export type ModifyTaskListOutput = z.infer<typeof ModifyTaskListOutputSchema>;

export async function modifyTaskList(input: ModifyTaskListInput): Promise<ModifyTaskListOutput> {
  return modifyTaskListFlow(input);
}

const modifyTaskListPrompt = ai.definePrompt({
  name: 'modifyTaskListPrompt',
  input: {schema: ModifyTaskListInputSchema},
  output: {schema: ModifyTaskListOutputSchema},
  prompt: `You are an AI agent responsible for managing a user's task list.

  The user will provide instructions on how to modify the task list.  Your goal is to modify the task list according to the user's instructions and explain the changes you made.

  Here is the current task list:
  {{#each taskList}}
  - {{this}}
  {{/each}}

  Here are the instructions:
  {{instructions}}

  Based on the instructions, generate a modified task list and explain your reasoning for the changes.

  Make sure to return the modified task list in the modifiedTaskList field.
  Explain your reasoning in the reasoning field.
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
