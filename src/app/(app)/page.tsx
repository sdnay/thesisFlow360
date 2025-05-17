// src/app/(app)/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirige vers la page du tableau de bord par défaut
  redirect('/dashboard');
  // Le contenu précédent avec ThesisWorkspace et ChatGPTPromptLogPanel est supprimé
  // car chaque section a maintenant sa propre page.
  // return null; // La redirection s'en chargera
}
