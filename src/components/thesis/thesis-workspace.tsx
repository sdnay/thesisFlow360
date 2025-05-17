// src/components/thesis/thesis-workspace.tsx
// Ce composant n'est plus utilisé comme conteneur à onglets principal
// pour les sections Tâches, Vide-Cerveau, etc., car elles sont maintenant
// des pages dédiées. La page d'accueil (`/`) utilise directement `ThesisDashboardSection`.
// Ce fichier peut être supprimé ou laissé vide s'il n'a plus d'autre utilité.

// Pour éviter des erreurs d'importation si quelque chose y faisait encore référence,
// on peut exporter un composant vide ou simplement le supprimer du projet si plus utilisé.

/**
 * @deprecated Ce composant n'est plus utilisé. Les sections sont maintenant des pages dédiées.
 * La page d'accueil utilise directement ThesisDashboardSection.
 */
export function ThesisWorkspace() {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <p>L'Espace de Travail principal est maintenant intégré différemment.</p>
      <p>Le tableau de bord est visible sur la page d'accueil à côté de l'assistant IA.</p>
      <p>Les autres modules (Tâches, Vide-Cerveau, etc.) sont accessibles via leurs propres pages dédiées depuis la barre latérale.</p>
    </div>
  );
}

// Si vous êtes sûr qu'il n'est plus importé nulle part, vous pouvez supprimer ce fichier.
// Pour l'instant, je le laisse avec un message indiquant sa désuétude.
