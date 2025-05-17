
"use client"; // Nécessaire car nous allons utiliser useAuth

import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/hooks/useAuth'; // Import du hook
import { useRouter } from 'next/navigation'; // Pour la redirection
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      // Si le chargement est terminé et qu'il n'y a pas de session active,
      // rediriger vers la page de connexion.
      // Le middleware devrait déjà gérer cela, mais c'est une sécurité supplémentaire côté client.
      router.replace('/auth/login');
    }
  }, [isLoading, session, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Chargement de la session...</p>
      </div>
    );
  }

  if (!session) {
    // Affiche un état de chargement ou rien en attendant la redirection
    // (ou un message "Redirection vers la connexion...")
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Redirection...</p>
      </div>
    );
  }

  // Si l'utilisateur est connecté, afficher le layout de l'application
  return <AppLayout>{children}</AppLayout>;
}
