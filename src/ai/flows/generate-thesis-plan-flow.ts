
'use server';
/**
 * @fileOverview Génère un plan de thèse détaillé pour un sujet donné.
 *
 * - generateThesisPlan - Une fonction qui génère un plan de thèse.
 * - GenerateThesisPlanInput - Le type d'entrée pour la fonction generateThesisPlan.
 * - GenerateThesisPlanOutput - Le type de retour pour la fonction generateThesisPlan.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateThesisPlanInputSchema = z.object({
  topicOrInstructions: z.string().describe('Le sujet de la thèse ou des instructions spécifiques pour générer le plan.'),
});
export type GenerateThesisPlanInput = z.infer<typeof GenerateThesisPlanInputSchema>;

const GenerateThesisPlanOutputSchema = z.object({
  plan: z.string().describe('Le plan de thèse détaillé généré, formaté en Markdown ou texte structuré.'),
});
export type GenerateThesisPlanOutput = z.infer<typeof GenerateThesisPlanOutputSchema>;

export async function generateThesisPlan(input: GenerateThesisPlanInput): Promise<GenerateThesisPlanOutput> {
  return generateThesisPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateThesisPlanPrompt',
  input: { schema: GenerateThesisPlanInputSchema },
  output: { schema: GenerateThesisPlanOutputSchema },
  prompt: `Tu es un assistant expert en méthodologie de recherche et rédaction académique.
  Ta tâche est de générer un plan de thèse (ou de mémoire) détaillé et structuré à partir du sujet ou des instructions fournies par l'utilisateur.
  Le plan doit être clair, logique, et couvrir les sections typiques d'un travail académique (par exemple : Introduction, Revue de Littérature / Cadre Théorique, Méthodologie, Résultats Attendus/Obtenus, Discussion, Conclusion, Bibliographie indicative).
  Pour chaque section principale, propose des sous-sections pertinentes et concises.
  Fournis le plan sous une forme bien structurée, idéalement en utilisant des titres et des listes à puces (Markdown).

  Sujet/Instructions de l'utilisateur : {{{topicOrInstructions}}}

  Plan de thèse généré :`,
});

const generateThesisPlanFlow = ai.defineFlow(
  {
    name: 'generateThesisPlanFlow',
    inputSchema: GenerateThesisPlanInputSchema,
    outputSchema: GenerateThesisPlanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output?.plan) {
        // Fallback si l'IA ne retourne pas un plan structuré correctement
        return { plan: "Désolé, je n'ai pas pu générer un plan structuré pour le moment. Veuillez réessayer ou reformuler votre demande." };
    }
    return output;
  }
);
